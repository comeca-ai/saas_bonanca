import "dotenv/config";
import { and, count, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  activities,
  auditEvents,
  businessUnits,
  dataCatalogFields,
  dataDiscrepancies,
  dataRecords,
  documents,
  domains,
  economicEntries,
  fieldConfigs,
  inputMovements,
  inputs,
  kpiDefinitions,
  livestockLots,
  lotEvents,
  organizationMembers,
  organizations,
  qualityAlerts,
  qualityRules,
  recordLinks,
  resultCenters,
  users,
} from "../drizzle/schema";
import { hashPassword } from "./auth";
import { closeDb, getDb } from "./db";
import { ENV } from "./_core/env";

export async function seedDatabase() {
  const db = await getDb();
  if (!db) return { seeded: false, reason: "database_unavailable" };

  const existing = await db.select({ value: count() }).from(organizations);
  if (Number(existing[0]?.value ?? 0) > 0) {
    if (ENV.platformAdminEmail) {
      await db.update(users).set({ platformRole: "super_admin" }).where(and(eq(users.email, ENV.platformAdminEmail), eq(users.status, "active")));
    }
    return { seeded: false, reason: "already_seeded", platformAdminBootstrapped: Boolean(ENV.platformAdminEmail) };
  }

  const now = new Date();
  const organizationId = randomUUID();
  const groupUnitId = randomUUID();
  const propertyUnitId = randomUUID();
  const domainId = randomUUID();
  const activityId = randomUUID();
  const resultCenterId = randomUUID();
  const operationId = randomUUID();
  const lotAId = randomUUID();
  const lotBId = randomUUID();
  const feedId = randomUUID();
  const mineralId = randomUUID();
  const qualityRuleId = randomUUID();
  const confirmedConsumptionId = randomUUID();
  const candidateConsumptionId = randomUUID();
  const adminPassword = ENV.seedAdminPassword;
  if (!adminPassword) throw new Error("SEED_ADMIN_PASSWORD deve ser configurado antes de criar a base inicial");
  const isPlatformAdmin = Boolean(ENV.platformAdminEmail && ENV.platformAdminEmail === ENV.seedAdminEmail.trim().toLowerCase());

  const adminOpenId = `local:${randomUUID().slice(0, 18)}`;
  await db.insert(users).values({
    openId: adminOpenId,
    name: "Administrador Bonança",
    email: ENV.seedAdminEmail,
    passwordHash: hashPassword(adminPassword),
    loginMethod: "password",
    role: "user",
    platformRole: isPlatformAdmin ? "super_admin" : "none",
    status: "active",
    lastSignedIn: now,
  });
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.openId, adminOpenId)).limit(1);
  if (!admin) throw new Error("Seed admin user was not created");

  await db.insert(organizations).values({ id: organizationId, name: "Bonança Demo", slug: "bonanca-demo", plan: "trial", billingStatus: "trialing", seatLimit: 25, trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000) });
  await db.insert(organizationMembers).values({ id: randomUUID(), organizationId, userId: admin.id, role: "owner", status: "active" });
  await db.insert(businessUnits).values([
    { id: groupUnitId, organizationId, code: "GRP", name: "Grupo Bonança", unitType: "group", status: "active", notes: "Unidade raiz do tenant demo." },
    { id: propertyUnitId, organizationId, parentId: groupUnitId, code: "PRD-01", name: "Unidade produtiva 01", unitType: "property", status: "active", notes: "Base operacional anonimizada para demonstração." },
  ]);
  await db.insert(domains).values({ id: domainId, organizationId, code: "LIVESTOCK", name: "Pecuária", description: "Recria, engorda, confinamento e atividades satélites.", enabled: 1, configVersion: 1 });
  await db.insert(activities).values({ id: activityId, organizationId, domainId, code: "FEEDLOT", name: "Confinamento de gado", status: "active", configVersion: 1 });
  await db.insert(resultCenters).values({ id: resultCenterId, organizationId, businessUnitId: propertyUnitId, code: "PEC-001", name: "Pecuária · Operação", centerType: "result", status: "active" });
  await db.insert((await import("../drizzle/schema")).operations).values({ id: operationId, organizationId, businessUnitId: propertyUnitId, domainId, activityId, resultCenterId, code: "CICLO-2026-A", name: "Ciclo de engorda · demonstração", startDate: "2026-01-12", endDate: null, status: "active" });

  await db.insert(livestockLots).values([
    { id: lotAId, organizationId, businessUnitId: propertyUnitId, operationId, lotCode: "L-026-A", regime: "feedlot", headCount: 486, entryDate: "2026-01-12", expectedExitDate: "2026-05-28", actualExitDate: null, status: "active", dataStatus: "verified", notes: "Entrada documentada; peso médio de entrada aguardando reconciliação." },
    { id: lotBId, organizationId, businessUnitId: propertyUnitId, operationId, lotCode: "L-026-B", regime: "semi_intensive", headCount: 312, entryDate: "2026-02-03", expectedExitDate: "2026-06-19", actualExitDate: null, status: "active", dataStatus: "partial", notes: "Consumo parcialmente lançado pela operação." },
  ]);
  await db.insert(lotEvents).values([
    { id: randomUUID(), organizationId, lotId: lotAId, eventType: "entry", eventDate: "2026-01-12", quantity: "486", unit: "cabeças", originType: "primary_document", sourceReference: "Romaneio anonimizado · entrada 012", status: "realized", quality: "high", notes: "Conferido pelo documento de entrada.", createdByUserId: admin.id },
    { id: randomUUID(), organizationId, lotId: lotAId, eventType: "weighing", eventDate: "2026-01-13", quantity: "312.4", unit: "kg/cab", originType: "consolidated", sourceReference: "Planilha de pesagem · versão 3", status: "to_confirm", quality: "medium", notes: "Há outra leitura para o mesmo evento.", createdByUserId: admin.id },
    { id: randomUUID(), organizationId, lotId: lotBId, eventType: "entry", eventDate: "2026-02-03", quantity: "312", unit: "cabeças", originType: "manual", sourceReference: "Apontamento de campo", status: "estimated", quality: "medium", notes: "Entrada registrada na tela de operação.", createdByUserId: admin.id },
  ]);
  await db.insert(inputs).values([
    { id: feedId, organizationId, sku: "INS-RAC-001", name: "Ração de engorda · fase 1", category: "feed", unit: "kg", active: 1 },
    { id: mineralId, organizationId, sku: "INS-MIN-004", name: "Núcleo mineral · demonstração", category: "supplement", unit: "kg", active: 1 },
  ]);
  await db.insert(inputMovements).values([
    { id: confirmedConsumptionId, organizationId, inputId: feedId, lotId: lotAId, movementType: "consumption", movementDate: "2026-03-07", quantity: "18420", unitCost: "1.87", linkStatus: "confirmed", originType: "primary_document", sourceReference: "Boletim de consumo · semana 09", status: "realized", notes: "Vínculo confirmado com boletim de campo.", createdByUserId: admin.id },
    { id: candidateConsumptionId, organizationId, inputId: mineralId, lotId: lotBId, movementType: "consumption", movementDate: "2026-03-08", quantity: "740", unitCost: "4.2", linkStatus: "candidate", originType: "spreadsheet", sourceReference: "Planilha de insumos · aba consumo", status: "to_confirm", notes: "Candidato até confirmação do lote.", createdByUserId: admin.id },
  ]);
  await db.insert(economicEntries).values([
    { id: randomUUID(), organizationId, businessUnitId: propertyUnitId, resultCenterId, lotId: lotAId, inputMovementId: confirmedConsumptionId, entryType: "cost", entryDate: "2026-03-07", amount: "34445.40", currency: "BRL", originType: "primary_document", sourceReference: "NF-e anonimizada · fornecedor 07", status: "realized", notes: "Custo apurado com documento.", createdByUserId: admin.id },
    { id: randomUUID(), organizationId, businessUnitId: propertyUnitId, resultCenterId, lotId: lotBId, inputMovementId: null, entryType: "cost", entryDate: "2026-03-08", amount: "3108.00", currency: "BRL", originType: "estimate", sourceReference: "Planilha de insumos · aba consumo", status: "estimated", notes: "Não compõe custo confirmado.", createdByUserId: admin.id },
  ]);
  await db.insert(documents).values([
    { id: randomUUID(), organizationId, businessUnitId: propertyUnitId, documentType: "Romaneio de entrada", title: "Entrada de lote L-026-A", reference: "romaneio://demo/012", status: "available", originType: "primary_document", notes: "Documento de demonstração." },
    { id: randomUUID(), organizationId, businessUnitId: propertyUnitId, documentType: "Planilha operacional", title: "Consumo de insumos · março", reference: "spreadsheet://demo/insumos-marco", status: "pending", originType: "consolidated", notes: "Aguardando reconciliação contra documentos." },
  ]);

  const weightRecordId = randomUUID();
  const inputRecordId = randomUUID();
  await db.insert(dataRecords).values([
    { id: weightRecordId, organizationId, entityType: "livestock_lot", entityId: lotAId, fieldKey: "entry_weight", label: "Peso médio de entrada", value: "312.4", numericValue: "312.4", unit: "kg/cab", originType: "consolidated", sourceReference: "Planilha de pesagem · versão 3", acquisitionMethod: "spreadsheet", status: "to_confirm", quality: "medium", approvalStatus: "pending", notes: "Existe uma segunda leitura para o mesmo evento.", createdByUserId: admin.id },
    { id: inputRecordId, organizationId, entityType: "input_movement", entityId: candidateConsumptionId, fieldKey: "consumption_link", label: "Vínculo do consumo de núcleo mineral", value: "L-026-B", originType: "consolidated", sourceReference: "Planilha de insumos · aba consumo", acquisitionMethod: "spreadsheet", status: "to_confirm", quality: "low", approvalStatus: "pending", notes: "Candidato até confirmação direta.", createdByUserId: admin.id },
  ]);
  const discrepancyId = randomUUID();
  await db.insert(dataDiscrepancies).values({ id: discrepancyId, organizationId, dataRecordId: weightRecordId, title: "Peso de entrada com duas leituras", originalReading: "312,4 kg/cab · planilha versão 3", proposedCorrection: "311,8 kg/cab · romaneio consolidado", justification: "As fontes ainda não foram reconciliadas.", status: "open", createdByUserId: admin.id });
  await db.insert(recordLinks).values({ id: randomUUID(), organizationId, fromType: "input_movement", fromId: candidateConsumptionId, toType: "livestock_lot", toId: lotBId, linkType: "consumption_of", status: "candidate", evidenceNote: "Coincidência de período e código; falta confirmação direta.", });

  await db.insert(dataCatalogFields).values([
    { id: randomUUID(), organizationId, fieldKey: "livestock_lot.entry_weight", label: "Peso médio de entrada", definition: "Peso médio por cabeça no momento de entrada do lote.", owner: "Operação pecuária", expectedSource: "Romaneio/ticket de pesagem", lineage: "Documento de pesagem → evento do lote → KPI de ganho de peso", domain: "Pecuária", sensitivity: "internal" },
    { id: randomUUID(), organizationId, fieldKey: "input_movement.quantity", label: "Quantidade consumida", definition: "Volume de insumo efetivamente consumido em um período.", owner: "Suprimentos + Operação", expectedSource: "Boletim de consumo ou ERP", lineage: "Documento/lançamento → movimentação → custo por lote", domain: "Insumos", sensitivity: "internal" },
    { id: randomUUID(), organizationId, fieldKey: "economic_entry.amount", label: "Valor econômico", definition: "Custo, receita ou ajuste na moeda da organização.", owner: "Controladoria", expectedSource: "NF-e/extrato/ERP", lineage: "Documento financeiro → lançamento → margem por lote", domain: "Financeiro", sensitivity: "restricted" },
  ]);
  await db.insert(kpiDefinitions).values([
    { id: randomUUID(), organizationId, code: "COST_PER_HEAD", name: "Custo apurado por cabeça", definition: "Custos realizados com vínculo confirmado divididos pelas cabeças do lote.", formula: "SUM(custos realizados confirmados) / head_count", unit: "BRL/cabeça", sources: "economic_entries + livestock_lots + record_links", version: 1, status: "active" },
    { id: randomUUID(), organizationId, code: "LOT_DATA_COVERAGE", name: "Cobertura de dados do lote", definition: "Percentual de campos críticos com origem e aprovação definidas.", formula: "campos aprovados / campos críticos", unit: "%", sources: "data_records", version: 1, status: "active" },
    { id: randomUUID(), organizationId, code: "FEED_CONVERSION", name: "Conversão alimentar", definition: "Quilo de matéria consumida por quilo de ganho, após reconciliação.", formula: "consumo confirmado / ganho de peso confirmado", unit: "kg/kg", sources: "input_movements + lot_events", version: 1, status: "draft" },
  ]);
  await db.insert(qualityRules).values([
    { id: qualityRuleId, organizationId, code: "MISSING_SOURCE", name: "Fonte obrigatória ausente", description: "Dado relevante sem referência de origem não pode ser aprovado.", severity: "high", scope: "data_records", condition: "sourceReference IS NULL AND approvalStatus = approved", active: 1 },
    { id: randomUUID(), organizationId, code: "CANDIDATE_STALE", name: "Vínculo candidato parado", description: "Vínculo candidato sem decisão por mais de 30 dias.", severity: "medium", scope: "record_links", condition: "status = candidate AND age > 30d", active: 1 },
    { id: randomUUID(), organizationId, code: "WEIGHT_RANGE", name: "Peso fora da faixa", description: "Pesagem fora da faixa esperada precisa de revisão.", severity: "medium", scope: "lot_events", condition: "quantity < 80 OR quantity > 800", active: 1 },
  ]);
  await db.insert(qualityAlerts).values({ id: randomUUID(), organizationId, ruleId: qualityRuleId, entityType: "data_record", entityId: weightRecordId, message: "A leitura de peso ainda não possui aprovação reconciliada.", severity: "medium", status: "open" });
  await db.insert(fieldConfigs).values({ id: randomUUID(), organizationId, domainId, fieldKey: "entry_weight", fieldLabel: "Peso médio de entrada", fieldType: "number", configVersion: 1, required: 1, status: "active" });
  await db.insert(auditEvents).values({ id: randomUUID(), organizationId, entityType: "organization", entityId: organizationId, action: "seeded", actorUserId: admin.id, newValue: JSON.stringify({ source: "bonanca_demo_seed", version: 1 }), reason: "Base demonstrativa inicial" });

  return { seeded: true, email: ENV.seedAdminEmail, password: adminPassword, platformAdminBootstrapped: isPlatformAdmin };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().then(result => {
    console.log(`[Bonança] Seed result: ${JSON.stringify({ ...result, password: result.password ? "[configured]" : undefined })}`);
  }).catch(error => {
    console.error("[Bonança] Seed failed", error);
    process.exitCode = 1;
  }).finally(async () => {
    await closeDb();
  });
}
