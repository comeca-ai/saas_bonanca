import { and, asc, count, desc, eq, isNotNull, like, sum } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
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
import { clearSession, loginUser, registerUser } from "./auth";
import { getDb } from "./db";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { clearFailedLogins, isLoginRateLimited, loginRateKey, registerFailedLogin } from "./security";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
  return db;
}

async function audit(
  db: Awaited<ReturnType<typeof getDb>>,
  input: {
    organizationId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorUserId: number;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string;
  },
) {
  if (!db) return;
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorUserId: input.actorUserId,
    previousValue: input.previousValue === undefined ? null : JSON.stringify(input.previousValue),
    newValue: input.newValue === undefined ? null : JSON.stringify(input.newValue),
    reason: input.reason ?? null,
  });
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(datePattern, "Use a data no formato AAAA-MM-DD");
const lotRegimes = ["pasture", "semi_intensive", "feedlot"] as const;
const lotStatuses = ["planned", "active", "closed", "to_confirm"] as const;
const eventTypes = ["entry", "weighing", "handling", "transfer", "exit", "note"] as const;
const dataStatuses = ["realized", "estimated", "simulated", "to_confirm"] as const;
const qualityLevels = ["high", "medium", "low", "unknown"] as const;

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { passwordHash: _passwordHash, ...safeUser } = ctx.user;
      return safeUser;
    }),
    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const forwardedFor = String(ctx.req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
        const key = loginRateKey(forwardedFor || ctx.req.ip, input.email);
        if (isLoginRateLimited(key)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." });
        const result = await loginUser(ctx.req, ctx.res, input.email, input.password);
        if (!result) {
          registerFailedLogin(key);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos" });
        }
        clearFailedLogins(key);
        return { success: true };
      }),
    register: publicProcedure
      .input(z.object({
        name: z.string().min(2).max(120),
        email: z.string().email(),
        password: z.string().min(8),
        organizationName: z.string().min(2).max(160),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          await registerUser(ctx.req, ctx.res, input.name, input.email, input.password, input.organizationName);
          return { success: true };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Não foi possível criar o acesso";
          throw new TRPCError({ code: "BAD_REQUEST", message });
        }
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await clearSession(ctx.req, ctx.res);
      return { success: true };
    }),
  }),

  dashboard: router({
    summary: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const orgId = ctx.user.organizationId;
      const [lots, heads, movements, costs, pending, discrepancies, candidates, pendingDocuments, alerts, units, recent, activeLotRows] = await Promise.all([
        db.select({ value: count() }).from(livestockLots).where(and(eq(livestockLots.organizationId, orgId), eq(livestockLots.status, "active"))),
        db.select({ value: sum(livestockLots.headCount) }).from(livestockLots).where(and(eq(livestockLots.organizationId, orgId), eq(livestockLots.status, "active"))),
        db.select({ value: sum(inputMovements.quantity) }).from(inputMovements).where(and(eq(inputMovements.organizationId, orgId), eq(inputMovements.movementType, "consumption"), eq(inputMovements.linkStatus, "confirmed"), eq(inputMovements.status, "realized"))),
        db.select({ value: sum(economicEntries.amount) }).from(economicEntries).where(and(eq(economicEntries.organizationId, orgId), eq(economicEntries.entryType, "cost"), eq(economicEntries.status, "realized"), isNotNull(economicEntries.sourceReference))),
        db.select({ value: count() }).from(dataRecords).where(and(eq(dataRecords.organizationId, orgId), eq(dataRecords.status, "to_confirm"))),
        db.select({ value: count() }).from(dataDiscrepancies).where(and(eq(dataDiscrepancies.organizationId, orgId), eq(dataDiscrepancies.status, "open"))),
        db.select({ value: count() }).from(recordLinks).where(and(eq(recordLinks.organizationId, orgId), eq(recordLinks.status, "candidate"))),
        db.select({ value: count() }).from(documents).where(and(eq(documents.organizationId, orgId), eq(documents.status, "pending"))),
        db.select({ value: count() }).from(qualityAlerts).where(and(eq(qualityAlerts.organizationId, orgId), eq(qualityAlerts.status, "open"))),
        db.select({ value: count() }).from(businessUnits).where(and(eq(businessUnits.organizationId, orgId), eq(businessUnits.status, "active"))),
        db.select().from(auditEvents).where(eq(auditEvents.organizationId, orgId)).orderBy(desc(auditEvents.createdAt)).limit(6),
        db.select({ lot: livestockLots, unit: businessUnits }).from(livestockLots).innerJoin(businessUnits, and(eq(businessUnits.id, livestockLots.businessUnitId), eq(businessUnits.organizationId, orgId))).where(and(eq(livestockLots.organizationId, orgId), eq(livestockLots.status, "active"))).orderBy(desc(livestockLots.createdAt)).limit(8),
      ]);
      return {
        activeLots: Number(lots[0]?.value ?? 0),
        heads: Number(heads[0]?.value ?? 0),
        consumedInput: Number(movements[0]?.value ?? 0),
        realizedCosts: Number(costs[0]?.value ?? 0),
        toConfirm: Number(pending[0]?.value ?? 0),
        openDiscrepancies: Number(discrepancies[0]?.value ?? 0),
        candidateLinks: Number(candidates[0]?.value ?? 0),
        pendingDocuments: Number(pendingDocuments[0]?.value ?? 0),
        qualityAlerts: Number(alerts[0]?.value ?? 0),
        activeUnits: Number(units[0]?.value ?? 0),
        recent,
        activeLotRows,
      };
    }),
  }),

  core: router({
    units: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(businessUnits).where(eq(businessUnits.organizationId, ctx.user.organizationId)).orderBy(asc(businessUnits.name));
    }),
    domains: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(domains).where(eq(domains.organizationId, ctx.user.organizationId)).orderBy(asc(domains.name));
    }),
    activities: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(activities).where(eq(activities.organizationId, ctx.user.organizationId)).orderBy(asc(activities.name));
    }),
    createUnit: protectedProcedure
      .input(z.object({ code: z.string().min(2).max(40), name: z.string().min(2).max(160), unitType: z.string().default("operation"), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!["owner", "admin"].includes(ctx.user.organizationRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem criar unidades" });
        const db = await requireDb();
        const id = randomUUID();
        await db.insert(businessUnits).values({ id, organizationId: ctx.user.organizationId, code: input.code, name: input.name, unitType: input.unitType, notes: input.notes ?? null });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "business_unit", entityId: id, action: "created", actorUserId: ctx.user.id, newValue: input });
        return { id };
      }),
  }),

  livestock: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), status: z.enum(lotStatuses).optional() }).optional())
      .query(async ({ ctx, input }) => {
        const db = await requireDb();
        const filters = [eq(livestockLots.organizationId, ctx.user.organizationId)];
        if (input?.status) filters.push(eq(livestockLots.status, input.status));
        if (input?.search) filters.push(like(livestockLots.lotCode, `%${input.search}%`));
        const rows = await db.select({ lot: livestockLots, unit: businessUnits }).from(livestockLots).innerJoin(businessUnits, and(eq(businessUnits.id, livestockLots.businessUnitId), eq(businessUnits.organizationId, ctx.user.organizationId))).where(and(...filters)).orderBy(desc(livestockLots.createdAt));
        return rows;
      }),
    detail: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const db = await requireDb();
      const lot = await db.select({ lot: livestockLots, unit: businessUnits }).from(livestockLots).innerJoin(businessUnits, and(eq(businessUnits.id, livestockLots.businessUnitId), eq(businessUnits.organizationId, ctx.user.organizationId))).where(and(eq(livestockLots.id, input.id), eq(livestockLots.organizationId, ctx.user.organizationId))).limit(1);
      if (!lot[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado" });
      const [events, movements, entries, records] = await Promise.all([
        db.select().from(lotEvents).where(and(eq(lotEvents.organizationId, ctx.user.organizationId), eq(lotEvents.lotId, input.id))).orderBy(desc(lotEvents.eventDate)),
        db.select({ movement: inputMovements, input: inputs }).from(inputMovements).innerJoin(inputs, and(eq(inputs.id, inputMovements.inputId), eq(inputs.organizationId, ctx.user.organizationId))).where(and(eq(inputMovements.organizationId, ctx.user.organizationId), eq(inputMovements.lotId, input.id))).orderBy(desc(inputMovements.movementDate)),
        db.select().from(economicEntries).where(and(eq(economicEntries.organizationId, ctx.user.organizationId), eq(economicEntries.lotId, input.id))).orderBy(desc(economicEntries.entryDate)),
        db.select().from(dataRecords).where(and(eq(dataRecords.organizationId, ctx.user.organizationId), eq(dataRecords.entityType, "livestock_lot"), eq(dataRecords.entityId, input.id))).orderBy(desc(dataRecords.createdAt)),
      ]);
      return { ...lot[0], events, movements, entries, records };
    }),
    create: protectedProcedure
      .input(z.object({ businessUnitId: z.string(), lotCode: z.string().min(2).max(60), regime: z.enum(lotRegimes), headCount: z.number().int().min(0), entryDate: dateString.optional(), expectedExitDate: dateString.optional(), status: z.enum(lotStatuses).default("active"), notes: z.string().max(4000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!["owner", "admin", "operator"].includes(ctx.user.organizationRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para criar lotes" });
        const db = await requireDb();
        const unit = await db.select().from(businessUnits).where(and(eq(businessUnits.id, input.businessUnitId), eq(businessUnits.organizationId, ctx.user.organizationId))).limit(1);
        if (!unit[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Unidade não encontrada" });
        const id = randomUUID();
        await db.insert(livestockLots).values({ id, organizationId: ctx.user.organizationId, businessUnitId: input.businessUnitId, lotCode: input.lotCode, regime: input.regime, headCount: input.headCount, entryDate: input.entryDate ?? null, expectedExitDate: input.expectedExitDate ?? null, status: input.status, dataStatus: "to_confirm", notes: input.notes ?? null, });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "livestock_lot", entityId: id, action: "created", actorUserId: ctx.user.id, newValue: input });
        return { id };
      }),
    addEvent: protectedProcedure
      .input(z.object({ lotId: z.string(), eventType: z.enum(eventTypes), eventDate: dateString, quantity: z.number().optional(), unit: z.string().max(30).optional(), status: z.enum(dataStatuses).default("to_confirm"), quality: z.enum(qualityLevels).default("unknown"), sourceReference: z.string().max(240).optional(), notes: z.string().max(4000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!["owner", "admin", "operator"].includes(ctx.user.organizationRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para registrar eventos" });
        const db = await requireDb();
        const lot = await db.select().from(livestockLots).where(and(eq(livestockLots.id, input.lotId), eq(livestockLots.organizationId, ctx.user.organizationId))).limit(1);
        if (!lot[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado" });
        const id = randomUUID();
        await db.insert(lotEvents).values({ id, organizationId: ctx.user.organizationId, lotId: input.lotId, eventType: input.eventType, eventDate: input.eventDate, quantity: input.quantity?.toString() ?? null, unit: input.unit ?? null, status: input.status, quality: input.quality, sourceReference: input.sourceReference ?? null, notes: input.notes ?? null, createdByUserId: ctx.user.id });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "lot_event", entityId: id, action: "created", actorUserId: ctx.user.id, newValue: input });
        return { id };
      }),
    inputs: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(inputs).where(and(eq(inputs.organizationId, ctx.user.organizationId), eq(inputs.active, 1))).orderBy(asc(inputs.name));
    }),
    createInput: protectedProcedure
      .input(z.object({ sku: z.string().min(2).max(60), name: z.string().min(2).max(160), category: z.enum(["feed", "supplement", "medicine", "fuel", "other"]), unit: z.string().min(1).max(30) }))
      .mutation(async ({ ctx, input }) => {
        if (!["owner", "admin", "operator"].includes(ctx.user.organizationRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para cadastrar insumos" });
        const db = await requireDb();
        const id = randomUUID();
        await db.insert(inputs).values({ id, organizationId: ctx.user.organizationId, ...input, active: 1 });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "input", entityId: id, action: "created", actorUserId: ctx.user.id, newValue: input });
        return { id };
      }),
    addMovement: protectedProcedure
      .input(z.object({ inputId: z.string(), lotId: z.string().optional(), movementType: z.enum(["inbound", "consumption", "transfer", "adjustment"]), movementDate: dateString, quantity: z.number().positive(), unitCost: z.number().nonnegative().optional(), sourceReference: z.string().max(240).optional(), notes: z.string().max(4000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!["owner", "admin", "operator"].includes(ctx.user.organizationRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para registrar movimentações" });
        const db = await requireDb();
        const [inputItem] = await db.select().from(inputs).where(and(eq(inputs.id, input.inputId), eq(inputs.organizationId, ctx.user.organizationId))).limit(1);
        if (!inputItem) throw new TRPCError({ code: "NOT_FOUND", message: "Insumo não encontrado" });
        if (input.lotId) {
          const [lot] = await db.select({ id: livestockLots.id }).from(livestockLots).where(and(eq(livestockLots.id, input.lotId), eq(livestockLots.organizationId, ctx.user.organizationId))).limit(1);
          if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado" });
        }
        const id = randomUUID();
        const linkStatus = input.lotId ? "candidate" : "unlinked";
        await db.transaction(async (tx: any) => {
          await tx.insert(inputMovements).values({ id, organizationId: ctx.user.organizationId, inputId: input.inputId, lotId: input.lotId ?? null, movementType: input.movementType, movementDate: input.movementDate, quantity: input.quantity.toString(), unitCost: input.unitCost?.toString() ?? null, linkStatus, originType: "manual", sourceReference: input.sourceReference ?? null, status: "to_confirm", notes: input.notes ?? null, createdByUserId: ctx.user.id });
          if (input.lotId) {
            await tx.insert(dataRecords).values({ id: randomUUID(), organizationId: ctx.user.organizationId, entityType: "input_movement", entityId: id, fieldKey: "consumption_link", label: `Vínculo de ${inputItem.name}`, value: input.lotId, unit: inputItem.unit, originType: "manual", sourceReference: input.sourceReference ?? null, acquisitionMethod: "manual_entry", status: "to_confirm", quality: "unknown", approvalStatus: "pending", notes: "Movimentação aguardando confirmação direta do vínculo ao lote.", createdByUserId: ctx.user.id });
            await tx.insert(recordLinks).values({ id: randomUUID(), organizationId: ctx.user.organizationId, fromType: "input_movement", fromId: id, toType: "livestock_lot", toId: input.lotId, linkType: "consumption_of", status: "candidate", evidenceNote: "Criado a partir de lançamento operacional; requer confirmação direta." });
          }
        });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "input_movement", entityId: id, action: "created", actorUserId: ctx.user.id, newValue: input });
        return { id };
      }),
    addEconomicEntry: protectedProcedure
      .input(z.object({ businessUnitId: z.string(), lotId: z.string().optional(), inputMovementId: z.string().optional(), entryType: z.enum(["cost", "revenue", "adjustment"]), entryDate: dateString, amount: z.number().positive(), sourceReference: z.string().max(240).optional(), notes: z.string().max(4000).optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!["owner", "admin", "operator"].includes(ctx.user.organizationRole)) throw new TRPCError({ code: "FORBIDDEN", message: "Sem permissão para registrar lançamentos" });
        const db = await requireDb();
        const [unit] = await db.select({ id: businessUnits.id }).from(businessUnits).where(and(eq(businessUnits.id, input.businessUnitId), eq(businessUnits.organizationId, ctx.user.organizationId))).limit(1);
        if (!unit) throw new TRPCError({ code: "NOT_FOUND", message: "Unidade não encontrada" });
        if (input.lotId) {
          const [lot] = await db.select({ id: livestockLots.id }).from(livestockLots).where(and(eq(livestockLots.id, input.lotId), eq(livestockLots.organizationId, ctx.user.organizationId))).limit(1);
          if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado" });
        }
        if (input.inputMovementId) {
          const [movement] = await db.select({ id: inputMovements.id }).from(inputMovements).where(and(eq(inputMovements.id, input.inputMovementId), eq(inputMovements.organizationId, ctx.user.organizationId))).limit(1);
          if (!movement) throw new TRPCError({ code: "NOT_FOUND", message: "Movimentação não encontrada" });
        }
        const id = randomUUID();
        await db.insert(economicEntries).values({ id, organizationId: ctx.user.organizationId, businessUnitId: input.businessUnitId, lotId: input.lotId ?? null, inputMovementId: input.inputMovementId ?? null, entryType: input.entryType, entryDate: input.entryDate, amount: input.amount.toString(), currency: "BRL", originType: "manual", sourceReference: input.sourceReference ?? null, status: "to_confirm", notes: input.notes ?? null, createdByUserId: ctx.user.id });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "economic_entry", entityId: id, action: "created", actorUserId: ctx.user.id, newValue: input });
        return { id };
      }),
  }),

  dataControl: router({
    overview: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      const orgId = ctx.user.organizationId;
      const [records, discrepancies, links, alerts] = await Promise.all([
        db.select().from(dataRecords).where(and(eq(dataRecords.organizationId, orgId), eq(dataRecords.status, "to_confirm"))).orderBy(desc(dataRecords.createdAt)).limit(20),
        db.select().from(dataDiscrepancies).where(and(eq(dataDiscrepancies.organizationId, orgId), eq(dataDiscrepancies.status, "open"))).orderBy(desc(dataDiscrepancies.createdAt)).limit(20),
        db.select().from(recordLinks).where(and(eq(recordLinks.organizationId, orgId), eq(recordLinks.status, "candidate"))).orderBy(desc(recordLinks.createdAt)).limit(20),
        db.select({ alert: qualityAlerts, rule: qualityRules }).from(qualityAlerts).innerJoin(qualityRules, and(eq(qualityRules.id, qualityAlerts.ruleId), eq(qualityRules.organizationId, orgId))).where(and(eq(qualityAlerts.organizationId, orgId), eq(qualityAlerts.status, "open"))).orderBy(desc(qualityAlerts.createdAt)).limit(20),
      ]);
      return { records, discrepancies, links, alerts };
    }),
    resolveDiscrepancy: adminProcedure
      .input(z.object({ id: z.string(), status: z.enum(["resolved", "dismissed", "in_review"]), proposedCorrection: z.string().optional(), justification: z.string().min(4), resolutionNote: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const current = await db.select().from(dataDiscrepancies).where(and(eq(dataDiscrepancies.id, input.id), eq(dataDiscrepancies.organizationId, ctx.user.organizationId))).limit(1);
        if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Divergência não encontrada" });
        await db.update(dataDiscrepancies).set({ status: input.status, proposedCorrection: input.proposedCorrection ?? current[0].proposedCorrection, justification: input.justification, resolutionNote: input.resolutionNote ?? null, resolvedByUserId: input.status === "resolved" || input.status === "dismissed" ? ctx.user.id : null, resolvedAt: input.status === "resolved" || input.status === "dismissed" ? new Date() : null }).where(eq(dataDiscrepancies.id, input.id));
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "data_discrepancy", entityId: input.id, action: input.status, actorUserId: ctx.user.id, previousValue: current[0], newValue: input, reason: input.justification });
        return { success: true };
      }),
    confirmLink: adminProcedure
      .input(z.object({ id: z.string(), evidenceNote: z.string().min(4) }))
      .mutation(async ({ ctx, input }) => {
        const db = await requireDb();
        const current = await db.select().from(recordLinks).where(and(eq(recordLinks.id, input.id), eq(recordLinks.organizationId, ctx.user.organizationId))).limit(1);
        if (!current[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Vínculo não encontrado" });
        await db.transaction(async (tx: any) => {
          await tx.update(recordLinks).set({ status: "confirmed", evidenceNote: input.evidenceNote, confirmedByUserId: ctx.user.id, confirmedAt: new Date() }).where(and(eq(recordLinks.id, input.id), eq(recordLinks.organizationId, ctx.user.organizationId)));
          if (current[0].fromType === "input_movement") {
            await tx.update(inputMovements).set({ linkStatus: "confirmed" }).where(and(eq(inputMovements.id, current[0].fromId), eq(inputMovements.organizationId, ctx.user.organizationId)));
          }
          await tx.update(dataRecords).set({ status: "realized", approvalStatus: "approved" }).where(and(eq(dataRecords.organizationId, ctx.user.organizationId), eq(dataRecords.entityType, current[0].fromType), eq(dataRecords.entityId, current[0].fromId)));
        });
        await audit(db, { organizationId: ctx.user.organizationId, entityType: "record_link", entityId: input.id, action: "confirmed", actorUserId: ctx.user.id, previousValue: current[0], newValue: { status: "confirmed", evidenceNote: input.evidenceNote }, reason: input.evidenceNote });
        return { success: true };
      }),
  }),

  catalog: router({
    fields: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(dataCatalogFields).where(eq(dataCatalogFields.organizationId, ctx.user.organizationId)).orderBy(asc(dataCatalogFields.domain), asc(dataCatalogFields.label));
    }),
    kpis: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select().from(kpiDefinitions).where(and(eq(kpiDefinitions.organizationId, ctx.user.organizationId), eq(kpiDefinitions.status, "active"))).orderBy(asc(kpiDefinitions.name));
    }),
    quality: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({ rule: qualityRules, openAlerts: count(qualityAlerts.id) }).from(qualityRules).leftJoin(qualityAlerts, and(eq(qualityAlerts.ruleId, qualityRules.id), eq(qualityAlerts.status, "open"))).where(eq(qualityRules.organizationId, ctx.user.organizationId)).groupBy(qualityRules.id).orderBy(asc(qualityRules.name));
    }),
    configs: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({ field: fieldConfigs, domain: domains }).from(fieldConfigs).innerJoin(domains, and(eq(domains.id, fieldConfigs.domainId), eq(domains.organizationId, ctx.user.organizationId))).where(eq(fieldConfigs.organizationId, ctx.user.organizationId)).orderBy(asc(fieldConfigs.fieldLabel));
    }),
  }),

  audit: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({ event: auditEvents, user: { id: users.id, name: users.name, email: users.email } }).from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorUserId)).where(eq(auditEvents.organizationId, ctx.user.organizationId)).orderBy(desc(auditEvents.createdAt)).limit(100);
    }),
  }),

  organization: router({
    members: adminProcedure.query(async ({ ctx }) => {
      const db = await requireDb();
      return db.select({ member: organizationMembers, user: { id: users.id, name: users.name, email: users.email, status: users.status } }).from(organizationMembers).innerJoin(users, eq(users.id, organizationMembers.userId)).where(eq(organizationMembers.organizationId, ctx.user.organizationId)).orderBy(asc(users.name));
    }),
  }),
});

export type AppRouter = typeof appRouter;
