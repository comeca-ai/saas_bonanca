import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { organizations, organizationMembers, sessions, users } from "../drizzle/schema";
import { getDb, getUserByEmail } from "./db";
import { ENV } from "./_core/env";

export const BONANCA_SESSION_COOKIE = "bonanca_session";
const SESSION_DAYS = 30;
const developmentSessionSecret = process.env.NODE_ENV === "production" ? "" : randomBytes(32).toString("hex");

export type SessionUser = typeof users.$inferSelect & {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  organizationRole: "owner" | "admin" | "analyst" | "operator" | "viewer";
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
  const [, salt, expected] = storedHash.split("$");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function hashToken(token: string) {
  const secret = ENV.sessionSecret || developmentSessionSecret;
  if (!secret) throw new Error("SESSION_SECRET não configurado");
  return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

function cookieOptions(req: Request) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const secure = process.env.COOKIE_SECURE === "true" || forwardedProto === "https" || req.protocol === "https";
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" as const : "lax" as const,
    secure,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

function readToken(req: Request) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  return cookies[BONANCA_SESSION_COOKIE] ?? null;
}

export async function establishSession(req: Request, res: Response, userId: number, organizationId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: nanoid(),
    tokenHash: hashToken(token),
    userId,
    organizationId,
    expiresAt,
  });
  res.cookie(BONANCA_SESSION_COOKIE, token, cookieOptions(req));
}

export async function clearSession(req: Request, res: Response) {
  const db = await getDb();
  const token = readToken(req);
  if (db && token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  res.clearCookie(BONANCA_SESSION_COOKIE, { ...cookieOptions(req), maxAge: -1 });
}

export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const db = await getDb();
  const token = readToken(req);
  if (!db || !token) return null;

  const rows = await db
    .select({ user: users, member: organizationMembers, organization: organizations })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(organizationMembers, and(eq(organizationMembers.userId, users.id), eq(organizationMembers.organizationId, sessions.organizationId)))
    .innerJoin(organizations, eq(organizations.id, sessions.organizationId))
    .where(eq(sessions.tokenHash, hashToken(token)))
    .limit(1);

  const row = rows[0];
  if (!row || row.user.status !== "active" || row.member.status !== "active" || row.organization.status !== "active") return null;
  if (row.user.passwordHash === null || row.member.organizationId !== row.organization.id) return null;
  const session = await db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(eq(sessions.tokenHash, hashToken(token))).limit(1);
  if (!session[0] || new Date(session[0].expiresAt).getTime() <= Date.now()) return null;
  return {
    ...row.user,
    organizationId: row.organization.id,
    organizationName: row.organization.name,
    organizationSlug: row.organization.slug,
    organizationRole: row.member.role as SessionUser["organizationRole"],
  };
}

export async function loginUser(req: Request, res: Response, email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const user = await getUserByEmail(normalizeEmail(email));
  if (!user || !verifyPassword(password, user.passwordHash)) return null;

  const membership = await db
    .select({ member: organizationMembers, organization: organizations })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
    .where(and(eq(organizationMembers.userId, user.id), eq(organizationMembers.status, "active"), eq(organizations.status, "active")))
    .limit(1);
  const firstMembership = membership[0];
  if (!firstMembership) return null;

  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  await establishSession(req, res, user.id, firstMembership.organization.id);
  return { user, organization: firstMembership.organization, role: firstMembership.member.role };
}

export async function registerUser(req: Request, res: Response, name: string, email: string, password: string, organizationName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedEmail = normalizeEmail(email);
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres");
  if (await getUserByEmail(normalizedEmail)) throw new Error("Este e-mail já está cadastrado");

  const userOpenId = `local:${nanoid(16)}`;
  const organizationId = nanoid();
  const memberId = nanoid();
  const userResult = await db.insert(users).values({
    openId: userOpenId,
    name: name.trim() || "Administrador",
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    loginMethod: "password",
    role: "admin",
    status: "active",
  });
  const userId = Number(userResult[0].insertId);
  const slugBase = organizationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "organizacao";
  const slug = `${slugBase}-${nanoid(5).toLowerCase()}`;
  await db.insert(organizations).values({ id: organizationId, name: organizationName.trim() || "Minha organização", slug });
  await db.insert(organizationMembers).values({ id: memberId, organizationId, userId, role: "owner", status: "active" });
  await establishSession(req, res, userId, organizationId);
  return { userId, organizationId };
}

export function sessionCookieName() {
  return BONANCA_SESSION_COOKIE;
}
