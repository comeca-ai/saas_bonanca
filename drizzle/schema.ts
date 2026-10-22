import { decimal, int, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

const id = (name = "id") => varchar(name, { length: 36 });
const enumText = (name: string, _values?: readonly string[]) => varchar(name, { length: 40 });
const createdAt = () => timestamp("createdAt").defaultNow().notNull();
const updatedAt = () => timestamp("updatedAt").defaultNow().notNull();

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: enumText("role", ["user", "admin"]).default("user").notNull(),
  status: enumText("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const organizations = mysqlTable("organizations", {
  id: id().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  status: enumText("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const organizationMembers = mysqlTable("organization_members", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  userId: int("userId").notNull(),
  role: enumText("role", ["owner", "admin", "analyst", "operator", "viewer"]).default("viewer").notNull(),
  status: enumText("status", ["active", "invited", "inactive"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = mysqlTable("sessions", {
  id: id().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  userId: int("userId").notNull(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: createdAt(),
});

export const businessUnits = mysqlTable("business_units", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  parentId: varchar("parentId", { length: 36 }),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  unitType: enumText("unitType", ["group", "company", "property", "holding", "spe", "operation", "other"]).default("operation").notNull(),
  status: enumText("status", ["active", "inactive"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const domains = mysqlTable("domains", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  enabled: int("enabled").default(1).notNull(),
  configVersion: int("configVersion").default(1).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const activities = mysqlTable("activities", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  domainId: varchar("domainId", { length: 36 }).notNull(),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  status: enumText("status", ["active", "planned", "archived"]).default("active").notNull(),
  configVersion: int("configVersion").default(1).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const counterparties = mysqlTable("counterparties", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  counterpartyType: enumText("counterpartyType", ["supplier", "customer", "investor", "partner", "person", "other"]).default("other").notNull(),
  status: enumText("status", ["active", "inactive"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const resultCenters = mysqlTable("result_centers", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }),
  code: varchar("code", { length: 40 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  centerType: enumText("centerType", ["cost", "revenue", "result"]).default("result").notNull(),
  status: enumText("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const operations = mysqlTable("operations", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }).notNull(),
  domainId: varchar("domainId", { length: 36 }).notNull(),
  activityId: varchar("activityId", { length: 36 }),
  resultCenterId: varchar("resultCenterId", { length: 36 }),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  startDate: varchar("startDate", { length: 10 }),
  endDate: varchar("endDate", { length: 10 }),
  status: enumText("status", ["planned", "active", "closed", "to_confirm"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const assets = mysqlTable("assets", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }),
  operationId: varchar("operationId", { length: 36 }),
  assetType: varchar("assetType", { length: 80 }).notNull(),
  name: varchar("name", { length: 180 }).notNull(),
  status: enumText("status", ["active", "inactive", "to_confirm"]).default("active").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contracts = mysqlTable("contracts", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }),
  operationId: varchar("operationId", { length: 36 }),
  counterpartyId: varchar("counterpartyId", { length: 36 }),
  code: varchar("code", { length: 80 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  startDate: varchar("startDate", { length: 10 }),
  endDate: varchar("endDate", { length: 10 }),
  status: enumText("status", ["draft", "active", "expired", "to_confirm"]).default("draft").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const documents = mysqlTable("documents", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }),
  documentType: varchar("documentType", { length: 100 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  reference: varchar("reference", { length: 240 }),
  status: enumText("status", ["available", "pending", "to_confirm"]).default("pending").notNull(),
  originType: enumText("originType", ["primary_document", "consolidated", "estimate", "simulation", "manual"]).default("primary_document").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dataRecords = mysqlTable("data_records", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 36 }).notNull(),
  fieldKey: varchar("fieldKey", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  value: text("value"),
  numericValue: decimal("numericValue", { precision: 16, scale: 4 }),
  unit: varchar("unit", { length: 30 }),
  originType: enumText("originType", ["primary_document", "consolidated", "estimate", "simulation", "manual"]).default("manual").notNull(),
  sourceReference: varchar("sourceReference", { length: 240 }),
  acquisitionMethod: enumText("acquisitionMethod", ["document", "spreadsheet", "manual_entry", "calculation", "import", "simulation"]).default("manual_entry").notNull(),
  status: enumText("status", ["realized", "estimated", "simulated", "to_confirm"]).default("to_confirm").notNull(),
  quality: enumText("quality", ["high", "medium", "low", "unknown"]).default("unknown").notNull(),
  approvalStatus: enumText("approvalStatus", ["approved", "pending", "rejected"]).default("pending").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dataDiscrepancies = mysqlTable("data_discrepancies", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  dataRecordId: varchar("dataRecordId", { length: 36 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  originalReading: text("originalReading").notNull(),
  proposedCorrection: text("proposedCorrection"),
  justification: text("justification"),
  status: enumText("status", ["open", "in_review", "resolved", "dismissed"]).default("open").notNull(),
  resolutionNote: text("resolutionNote"),
  createdByUserId: int("createdByUserId"),
  resolvedByUserId: int("resolvedByUserId"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const recordLinks = mysqlTable("record_links", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  fromType: varchar("fromType", { length: 80 }).notNull(),
  fromId: varchar("fromId", { length: 36 }).notNull(),
  toType: varchar("toType", { length: 80 }).notNull(),
  toId: varchar("toId", { length: 36 }).notNull(),
  linkType: varchar("linkType", { length: 80 }).notNull(),
  status: enumText("status", ["candidate", "confirmed", "rejected"]).default("candidate").notNull(),
  evidenceNote: text("evidenceNote"),
  confirmedByUserId: int("confirmedByUserId"),
  confirmedAt: timestamp("confirmedAt"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 36 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  actorUserId: int("actorUserId"),
  previousValue: text("previousValue"),
  newValue: text("newValue"),
  reason: text("reason"),
  createdAt: createdAt(),
});

export const livestockLots = mysqlTable("livestock_lots", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }).notNull(),
  operationId: varchar("operationId", { length: 36 }),
  lotCode: varchar("lotCode", { length: 60 }).notNull(),
  regime: enumText("regime", ["pasture", "semi_intensive", "feedlot"]).default("feedlot").notNull(),
  headCount: int("headCount").default(0).notNull(),
  entryDate: varchar("entryDate", { length: 10 }),
  expectedExitDate: varchar("expectedExitDate", { length: 10 }),
  actualExitDate: varchar("actualExitDate", { length: 10 }),
  status: enumText("status", ["planned", "active", "closed", "to_confirm"]).default("active").notNull(),
  dataStatus: enumText("dataStatus", ["verified", "partial", "to_confirm"]).default("partial").notNull(),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const lotEvents = mysqlTable("lot_events", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  lotId: varchar("lotId", { length: 36 }).notNull(),
  eventType: enumText("eventType", ["entry", "weighing", "handling", "transfer", "exit", "note"]).notNull(),
  eventDate: varchar("eventDate", { length: 10 }).notNull(),
  quantity: decimal("quantity", { precision: 16, scale: 4 }),
  unit: varchar("unit", { length: 30 }),
  originType: enumText("originType", ["primary_document", "consolidated", "estimate", "simulation", "manual"]).default("manual").notNull(),
  sourceReference: varchar("sourceReference", { length: 240 }),
  status: enumText("status", ["realized", "estimated", "simulated", "to_confirm"]).default("to_confirm").notNull(),
  quality: enumText("quality", ["high", "medium", "low", "unknown"]).default("unknown").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: createdAt(),
});

export const inputs = mysqlTable("inputs", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  sku: varchar("sku", { length: 60 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  category: enumText("category", ["feed", "supplement", "medicine", "fuel", "other"]).default("other").notNull(),
  unit: varchar("unit", { length: 30 }).notNull(),
  active: int("active").default(1).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inputMovements = mysqlTable("input_movements", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  inputId: varchar("inputId", { length: 36 }).notNull(),
  lotId: varchar("lotId", { length: 36 }),
  movementType: enumText("movementType", ["inbound", "consumption", "transfer", "adjustment"]).notNull(),
  movementDate: varchar("movementDate", { length: 10 }).notNull(),
  quantity: decimal("quantity", { precision: 16, scale: 4 }).notNull(),
  unitCost: decimal("unitCost", { precision: 16, scale: 4 }),
  linkStatus: enumText("linkStatus", ["unlinked", "candidate", "confirmed"]).default("unlinked").notNull(),
  originType: enumText("originType", ["primary_document", "consolidated", "estimate", "simulation", "manual"]).default("manual").notNull(),
  sourceReference: varchar("sourceReference", { length: 240 }),
  status: enumText("status", ["realized", "estimated", "simulated", "to_confirm"]).default("to_confirm").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: createdAt(),
});

export const economicEntries = mysqlTable("economic_entries", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  businessUnitId: varchar("businessUnitId", { length: 36 }).notNull(),
  resultCenterId: varchar("resultCenterId", { length: 36 }),
  lotId: varchar("lotId", { length: 36 }),
  inputMovementId: varchar("inputMovementId", { length: 36 }),
  entryType: enumText("entryType", ["cost", "revenue", "adjustment"]).notNull(),
  entryDate: varchar("entryDate", { length: 10 }).notNull(),
  amount: decimal("amount", { precision: 16, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BRL").notNull(),
  originType: enumText("originType", ["primary_document", "consolidated", "estimate", "simulation", "manual"]).default("manual").notNull(),
  sourceReference: varchar("sourceReference", { length: 240 }),
  status: enumText("status", ["realized", "estimated", "simulated", "to_confirm"]).default("to_confirm").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const fieldConfigs = mysqlTable("field_configs", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  domainId: varchar("domainId", { length: 36 }).notNull(),
  fieldKey: varchar("fieldKey", { length: 80 }).notNull(),
  fieldLabel: varchar("fieldLabel", { length: 160 }).notNull(),
  fieldType: enumText("fieldType", ["text", "number", "date", "select", "boolean"]).default("text").notNull(),
  configVersion: int("configVersion").default(1).notNull(),
  required: int("required").default(0).notNull(),
  status: enumText("status", ["active", "archived"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const dataCatalogFields = mysqlTable("data_catalog_fields", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  fieldKey: varchar("fieldKey", { length: 80 }).notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  definition: text("definition").notNull(),
  owner: varchar("owner", { length: 120 }).notNull(),
  expectedSource: varchar("expectedSource", { length: 160 }).notNull(),
  lineage: text("lineage").notNull(),
  domain: varchar("domain", { length: 80 }).notNull(),
  sensitivity: enumText("sensitivity", ["public", "internal", "restricted"]).default("internal").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const kpiDefinitions = mysqlTable("kpi_definitions", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  definition: text("definition").notNull(),
  formula: text("formula").notNull(),
  unit: varchar("unit", { length: 40 }).notNull(),
  sources: text("sources").notNull(),
  version: int("version").default(1).notNull(),
  status: enumText("status", ["draft", "active", "archived"]).default("active").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const qualityRules = mysqlTable("quality_rules", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description").notNull(),
  severity: enumText("severity", ["low", "medium", "high"]).default("medium").notNull(),
  scope: varchar("scope", { length: 100 }).notNull(),
  condition: text("condition").notNull(),
  active: int("active").default(1).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const qualityAlerts = mysqlTable("quality_alerts", {
  id: id().primaryKey(),
  organizationId: varchar("organizationId", { length: 36 }).notNull(),
  ruleId: varchar("ruleId", { length: 36 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 36 }).notNull(),
  message: text("message").notNull(),
  severity: enumText("severity", ["low", "medium", "high"]).default("medium").notNull(),
  status: enumText("status", ["open", "acknowledged", "resolved"]).default("open").notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type BusinessUnit = typeof businessUnits.$inferSelect;
export type LivestockLot = typeof livestockLots.$inferSelect;
export type DataRecord = typeof dataRecords.$inferSelect;
