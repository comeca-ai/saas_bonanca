import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";

type ModuleName = "pesagem" | "balanca";
type ModuleContext = { organizationId: string; actorUserId: number };

type RequestOptions = {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  idempotencyKey?: string;
};

function moduleConfig(module: ModuleName) {
  if (module === "pesagem") {
    return { url: ENV.pesagemServiceUrl, token: ENV.pesagemServiceToken, label: "Pesagem" };
  }
  return { url: ENV.balancaServiceUrl, token: ENV.balancaServiceToken, label: "Balança Misturadora" };
}

function moduleError(module: ModuleName, message: string, code: "SERVICE_UNAVAILABLE" | "BAD_REQUEST" | "CONFLICT" = "SERVICE_UNAVAILABLE"): never {
  throw new TRPCError({ code, message: `${moduleConfig(module).label}: ${message}` });
}

export async function callModule<T>(module: ModuleName, context: ModuleContext, path: string, options: RequestOptions = {}): Promise<T> {
  const config = moduleConfig(module);
  if (!config.token || config.token.length < 24 || /^troque-por-/i.test(config.token)) moduleError(module, "integração interna indisponível. Configure o token do serviço na instalação.");
  if (!path.startsWith("/api/")) moduleError(module, "rota interna inválida.", "BAD_REQUEST");
  try {
    const response = await fetch(`${config.url}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "X-Bonanca-Organization": context.organizationId,
        "X-Bonanca-User": String(context.actorUserId),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = String(payload.error ?? payload.message ?? `respondeu com HTTP ${response.status}`);
      moduleError(module, message, response.status === 409 ? "CONFLICT" : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "BAD_REQUEST");
    }
    return payload as T;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    moduleError(module, "não está respondendo. Verifique os containers e os healthchecks.");
  }
}

export async function moduleHealth(module: ModuleName): Promise<{ online: boolean; service: string; detail?: string }> {
  const config = moduleConfig(module);
  try {
    const response = await fetch(`${config.url}/api/health`, { signal: AbortSignal.timeout(2_500) });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    return { online: response.ok && payload.status === "ok", service: config.label, detail: response.ok ? undefined : `HTTP ${response.status}` };
  } catch {
    return { online: false, service: config.label, detail: "indisponível" };
  }
}
