// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.MANUS_PROJECT_ID ?? ""; },
  get cookieSecret() { return process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get oAuthServerUrl() { return process.env.MANUS_OAUTH_API_URL ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
  get seedAdminEmail() { return process.env.SEED_ADMIN_EMAIL ?? "admin@bonanca.local"; },
  get seedAdminPassword() { return process.env.SEED_ADMIN_PASSWORD ?? ""; },
  get sessionSecret() { return process.env.SESSION_SECRET ?? ""; },
  get appOrigin() { return process.env.APP_ORIGIN?.replace(/\/$/, "") ?? ""; },
  get pesagemServiceUrl() { return process.env.PESAGEM_SERVICE_URL?.replace(/\/$/, "") ?? (process.env.NODE_ENV === "production" ? "http://pesagem:8080" : "http://127.0.0.1:8081"); },
  get pesagemServiceToken() { return process.env.PESAGEM_SERVICE_TOKEN ?? ""; },
  get balancaServiceUrl() { return process.env.BALANCA_SERVICE_URL?.replace(/\/$/, "") ?? (process.env.NODE_ENV === "production" ? "http://balanca-misturadora:8080" : "http://127.0.0.1:8082"); },
  get balancaServiceToken() { return process.env.BALANCA_SERVICE_TOKEN ?? ""; },
};

export function assertProductionSecrets() {
  if (!ENV.isProduction) return;
  const required = ["SESSION_SECRET", "SEED_ADMIN_PASSWORD"] as const;
  for (const key of required) {
    const value = process.env[key]?.trim() ?? "";
    if (!value || value.startsWith("troque-por-") || value.length < 24) {
      throw new Error(`${key} deve estar definido com um segredo forte antes de iniciar em produção`);
    }
  }
}
