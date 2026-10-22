import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { getSessionUser, type SessionUser } from "../auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: SessionUser | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: SessionUser | null = null;
  try {
    user = await getSessionUser(opts.req);
  } catch (error) {
    console.warn("[Auth] Failed to resolve Bonança session", error);
  }
  return { req: opts.req, res: opts.res, user };
}
