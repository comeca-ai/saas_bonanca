import { afterEach, describe, expect, test } from "vitest";
import { assertProductionSecrets, ENV } from "./_core/env";

const keys = ["NODE_ENV", "BONANCA_SELF_HOSTED", "BONANCA_SESSION_SECRET", "SESSION_SECRET", "SEED_ADMIN_PASSWORD"] as const;
const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));

afterEach(() => {
  for (const key of keys) {
    const value = original[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("política de sessão", () => {
  test("gera uma chave efêmera forte no SaaS gerenciado quando não há secret injetado", () => {
    process.env.NODE_ENV = "production";
    delete process.env.BONANCA_SELF_HOSTED;
    delete process.env.BONANCA_SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    delete process.env.SEED_ADMIN_PASSWORD;
    expect(ENV.sessionSecret.length).toBeGreaterThanOrEqual(64);
    expect(() => assertProductionSecrets()).not.toThrow();
  });

  test("mantém segredo de sessão e senha de seed obrigatórios no modo self-hosted", () => {
    process.env.NODE_ENV = "production";
    process.env.BONANCA_SELF_HOSTED = "true";
    delete process.env.BONANCA_SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    delete process.env.SEED_ADMIN_PASSWORD;
    expect(() => assertProductionSecrets()).toThrow("SESSION_SECRET");
    process.env.SESSION_SECRET = "s".repeat(32);
    process.env.SEED_ADMIN_PASSWORD = "p".repeat(32);
    expect(() => assertProductionSecrets()).not.toThrow();
  });
});
