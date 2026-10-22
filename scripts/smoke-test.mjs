#!/usr/bin/env node

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const email = process.env.SMOKE_EMAIL || process.env.SEED_ADMIN_EMAIL || "";
const password = process.env.SMOKE_PASSWORD || process.env.SEED_ADMIN_PASSWORD || "";

if (!email || !password) {
  console.error("Defina SMOKE_EMAIL/SMOKE_PASSWORD ou SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD para executar o smoke test.");
  process.exit(2);
}

let passed = 0;
let cookie = "";

function ok(label, condition, detail = "") {
  if (!condition) throw new Error(`${label}${detail ? `: ${detail}` : ""}`);
  passed += 1;
  console.log(`✓ ${label}`);
}

async function parseResponse(response, label) {
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${label}: resposta não é JSON (HTTP ${response.status})`);
  }
  ok(`${label} responde em formato JSON`, response.headers.get("content-type")?.includes("application/json"));
  if (text.includes("Unable to transform response from server")) {
    throw new Error(`${label}: resposta contém erro de transformação`);
  }
  return { body, text };
}

async function query(path, input = null, label = path) {
  const url = `${baseUrl}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`;
  const response = await fetch(url, { headers: cookie ? { cookie } : {} });
  const { body } = await parseResponse(response, label);
  ok(`${label} não retorna erro tRPC`, response.ok && !body.error, body.error?.json?.message);
  return body.result?.data?.json;
}

async function mutation(path, input, label = path, headers = {}) {
  const response = await fetch(`${baseUrl}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseUrl, ...(cookie ? { cookie } : {}), ...headers },
    body: JSON.stringify({ json: input }),
  });
  const { body } = await parseResponse(response, label);
  ok(`${label} não retorna erro tRPC`, response.ok && !body.error, body.error?.json?.message);
  return { body, response };
}

try {
  const health = await fetch(`${baseUrl}/api/health`);
  const { body: healthBody } = await parseResponse(health, "Healthcheck");
  ok("Healthcheck está saudável", health.ok && healthBody.status === "ok" && healthBody.database === true);

  const routesResponse = await fetch(`${baseUrl}/manus-routes.json`);
  const { body: routesBody } = await parseResponse(routesResponse, "Manifesto de rotas");
  const expectedRoutes = ["/", "/livestock", "/operations", "/imports", "/core", "/data-control", "/catalog", "/audit", "/settings", "/growth-calculator"];
  ok("Manifesto declara as páginas principais", expectedRoutes.every(route => routesBody.routes?.some(item => item.path === route)));

  const unauthenticated = await fetch(`${baseUrl}/api/trpc/dashboard.summary?input=${encodeURIComponent(JSON.stringify({ json: null }))}`);
  await parseResponse(unauthenticated, "Bloqueio sem sessão");
  ok("Dashboard bloqueia acesso sem sessão", unauthenticated.status === 401);

  const login = await mutation("auth.login", { email, password }, "Login");
  const setCookie = login.response.headers.get("set-cookie") || "";
  cookie = setCookie.split(";")[0];
  ok("Login cria cookie de sessão", Boolean(cookie));

  const me = await query("auth.me", null, "Sessão atual");
  ok("Sessão identifica o usuário e a organização", Boolean(me?.id && me?.organizationId && me?.organizationRole));

  const summary = await query("dashboard.summary", null, "Dashboard");
  ok("Dashboard retorna indicadores", Number.isFinite(summary?.activeLots) && Array.isArray(summary?.activeLotRows));

  await query("core.units", null, "Núcleo · unidades");
  await query("core.domains", null, "Núcleo · domínios");
  await query("core.activities", null, "Núcleo · atividades");

  const lots = await query("livestock.list", {}, "Pecuária · lista de lotes");
  ok("Pecuária retorna lotes", Array.isArray(lots));
  if (lots[0]?.lot?.id) {
    const detail = await query("livestock.detail", { id: lots[0].lot.id }, "Pecuária · ficha do lote");
    ok("Ficha do lote retorna cadeia operacional", Boolean(detail?.lot && Array.isArray(detail.events) && Array.isArray(detail.movements)));
  }
  await query("livestock.inputs", null, "Pecuária · insumos");
  const units = await query("core.units", null, "Importação · unidades");
  ok("Importação encontra unidade para teste", Array.isArray(units) && units.length > 0);
  const csv = `lotCode,businessUnitCode,regime,headCount,entryDate\nSMOKE-${Date.now()},${units[0].code},confinado,1,22/10/2026\n`;
  const uploaded = await mutation("imports.upload", { filename: "smoke-import.csv", mimeType: "text/csv", contentBase64: `data:text/csv;base64,${Buffer.from(csv).toString("base64")}`, targetEntity: "livestock_lot" }, "Importação · upload");
  const importBatch = uploaded.body.result?.data?.json;
  ok("Importação recebe o arquivo e conta as linhas", importBatch?.totalRows === 1);
  const importDetail = await query("imports.detail", { id: importBatch.id }, "Importação · detalhe");
  await mutation("imports.map", { id: importBatch.id, mapping: importDetail.mapping }, "Importação · mapeamento");
  const validation = await mutation("imports.validate", { id: importBatch.id }, "Importação · validação");
  ok("Importação valida uma linha de lote", validation.body.result?.data?.json?.validRows === 1);
  await mutation("imports.cancel", { id: importBatch.id }, "Importação · cancelamento");
  await query("dataControl.overview", null, "Controle de dados");
  await query("catalog.fields", null, "Catálogo · campos");
  await query("catalog.kpis", null, "Catálogo · KPIs");
  await query("catalog.quality", null, "Catálogo · qualidade");
  await query("audit.list", null, "Histórico");
  const members = await query("organization.members", null, "Configuração · membros");
  ok("Membros não expõem hashes ou identificadores internos", !JSON.stringify(members).includes("passwordHash") && !JSON.stringify(members).includes("openId"));

  await mutation("auth.logout", null, "Logout");
  console.log(`\nSmoke test concluído: ${passed} verificações aprovadas.`);
} catch (error) {
  console.error(`\nSmoke test interrompido após ${passed} verificações: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
