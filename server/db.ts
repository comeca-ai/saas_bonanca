import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { auditEvents, InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: any = null;
let _pool: mysql.Pool | null = null;

export async function getDb(): Promise<any> {
  if (!_db && ENV.databaseUrl) {
    try {
      _pool = mysql.createPool(ENV.databaseUrl);
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function closeDb() {
  if (_pool) await _pool.end();
  _pool = null;
  _db = null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (user.status !== undefined) {
    values.status = user.status;
    updateSet.status = user.status;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet as never });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getLatestAuditEvents(organizationId: string, limit = 8) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(auditEvents).where(eq(auditEvents.organizationId, organizationId)).orderBy(desc(auditEvents.createdAt)).limit(limit);
}

export async function ensureDatabaseAvailable() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_URL is not configured or the database is unavailable");
  return db;
}

export function isDatabaseConfigured() {
  return Boolean(ENV.databaseUrl);
}

export async function checkDatabaseHealth(timeoutMs = 2_500) {
  if (!ENV.databaseUrl) return false;
  if (!_pool) await getDb();
  if (!_pool) return false;
  try {
    await Promise.race([
      _pool.query("SELECT 1"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database healthcheck timeout")), timeoutMs)),
    ]);
    return true;
  } catch {
    return false;
  }
}
