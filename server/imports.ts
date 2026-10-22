import { createHash } from "node:crypto";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { businessUnits, economicEntries, inputMovements, inputs, livestockLots, lotEvents } from "../drizzle/schema";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_COLUMNS = 100;
export const MAX_IMPORT_CELL_LENGTH = 10_000;

export const importTargets = ["livestock_lot", "lot_event", "input_movement", "economic_entry"] as const;
export type ImportTarget = typeof importTargets[number];

export const targetFields: Record<ImportTarget, Array<{ key: string; label: string; required?: boolean }>> = {
  livestock_lot: [
    { key: "lotCode", label: "Código do lote", required: true },
    { key: "businessUnitId", label: "ID da unidade" },
    { key: "businessUnitCode", label: "Código da unidade" },
    { key: "regime", label: "Regime" },
    { key: "headCount", label: "Cabeças" },
    { key: "entryDate", label: "Data de entrada" },
    { key: "expectedExitDate", label: "Saída prevista" },
    { key: "notes", label: "Observações" },
  ],
  lot_event: [
    { key: "lotId", label: "ID do lote" },
    { key: "lotCode", label: "Código do lote" },
    { key: "eventType", label: "Tipo do evento", required: true },
    { key: "eventDate", label: "Data do evento", required: true },
    { key: "quantity", label: "Quantidade" },
    { key: "unit", label: "Unidade" },
    { key: "status", label: "Status do dado" },
    { key: "quality", label: "Qualidade" },
    { key: "sourceReference", label: "Referência da origem" },
    { key: "notes", label: "Observações" },
  ],
  input_movement: [
    { key: "inputId", label: "ID do insumo" },
    { key: "inputSku", label: "SKU do insumo" },
    { key: "lotId", label: "ID do lote" },
    { key: "lotCode", label: "Código do lote" },
    { key: "movementType", label: "Tipo do movimento", required: true },
    { key: "movementDate", label: "Data do movimento", required: true },
    { key: "quantity", label: "Quantidade", required: true },
    { key: "unitCost", label: "Custo unitário" },
    { key: "sourceReference", label: "Referência da origem" },
    { key: "notes", label: "Observações" },
  ],
  economic_entry: [
    { key: "businessUnitId", label: "ID da unidade" },
    { key: "businessUnitCode", label: "Código da unidade" },
    { key: "lotId", label: "ID do lote" },
    { key: "lotCode", label: "Código do lote" },
    { key: "inputMovementId", label: "ID do movimento" },
    { key: "entryType", label: "Tipo do lançamento", required: true },
    { key: "entryDate", label: "Data do lançamento", required: true },
    { key: "amount", label: "Valor", required: true },
    { key: "currency", label: "Moeda" },
    { key: "sourceReference", label: "Referência da origem" },
    { key: "notes", label: "Observações" },
  ],
};

const aliasMap: Record<ImportTarget, Record<string, string[]>> = {
  livestock_lot: {
    lotCode: ["lotcode", "lote", "codigolote", "codigo", "loteid"],
    businessUnitId: ["businessunitid", "unidadeid", "fazendaid"],
    businessUnitCode: ["businessunitcode", "unidade", "codigounidade", "fazenda", "propriedade"],
    regime: ["regime", "sistema", "tipolote"],
    headCount: ["headcount", "cabecas", "animais", "quantidadeanimais", "efetivo"],
    entryDate: ["entrydate", "entrada", "datadeentrada", "dataentrada", "data"],
    expectedExitDate: ["expectedexitdate", "saidaprevista", "previsaosaida"],
    notes: ["notes", "observacoes", "observacao", "notas"],
  },
  lot_event: {
    lotId: ["lotid", "loteid", "id lote"],
    lotCode: ["lotcode", "lote", "codigolote", "codigo"],
    eventType: ["eventtype", "evento", "tipoevento", "tipo"],
    eventDate: ["eventdate", "data", "dataevento", "datapesagem", "datamanejo"],
    quantity: ["quantity", "quantidade", "peso", "pesokg", "kg", "valor"],
    unit: ["unit", "unidade", "medida"],
    status: ["status", "statusdado", "situacao"],
    quality: ["quality", "qualidade", "confianca"],
    sourceReference: ["sourcereference", "origem", "referencia", "documento", "romaneio"],
    notes: ["notes", "observacoes", "observacao", "notas"],
  },
  input_movement: {
    inputId: ["inputid", "insumoid"],
    inputSku: ["inputsku", "sku", "codigoinsumo", "codigo"],
    lotId: ["lotid", "loteid"],
    lotCode: ["lotcode", "lote", "codigolote"],
    movementType: ["movementtype", "tipomovimento", "tipo", "movimento"],
    movementDate: ["movementdate", "data", "datamovimento", "competencia"],
    quantity: ["quantity", "quantidade", "qtd", "volume", "kg"],
    unitCost: ["unitcost", "custounitario", "custokg", "valorunitario"],
    sourceReference: ["sourcereference", "origem", "referencia", "documento", "nota"],
    notes: ["notes", "observacoes", "observacao", "notas"],
  },
  economic_entry: {
    businessUnitId: ["businessunitid", "unidadeid", "fazendaid"],
    businessUnitCode: ["businessunitcode", "unidade", "codigounidade", "fazenda", "propriedade"],
    lotId: ["lotid", "loteid"],
    lotCode: ["lotcode", "lote", "codigolote"],
    inputMovementId: ["inputmovementid", "movimentoid", "idmovimento"],
    entryType: ["entrytype", "tipolancamento", "tipo", "natureza"],
    entryDate: ["entrydate", "data", "datalancamento", "competencia"],
    amount: ["amount", "valor", "total", "montante"],
    currency: ["currency", "moeda"],
    sourceReference: ["sourcereference", "origem", "referencia", "documento", "nota"],
    notes: ["notes", "observacoes", "observacao", "notas"],
  },
};

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanBase64(value: string) {
  const raw = value.replace(/^data:[^;]+;base64,/, "").replace(/\s/g, "");
  if (!raw || !/^[a-z0-9+/]*={0,2}$/i.test(raw)) throw new Error("Conteúdo do arquivo não está em base64 válido.");
  return raw;
}

export function decodeImportContent(contentBase64: string) {
  const raw = cleanBase64(contentBase64);
  const buffer = Buffer.from(raw, "base64");
  if (!buffer.length) throw new Error("O arquivo está vazio.");
  if (buffer.length > MAX_IMPORT_BYTES) throw new Error("O arquivo excede o limite de 5 MB.");
  return buffer;
}

function safeHeaders(values: unknown[]) {
  const used = new Set<string>();
  return values.map((value, index) => {
    const base = String(value ?? "").trim() || `coluna_${index + 1}`;
    let header = base;
    let suffix = 2;
    while (used.has(header)) header = `${base}_${suffix++}`;
    used.add(header);
    return header;
  });
}

function assertTabularShape(headers: string[], rows: Array<Record<string, unknown>>) {
  if (headers.length > MAX_IMPORT_COLUMNS) throw new Error("O arquivo excede o limite de 100 colunas.");
  if (headers.some(header => header.length > MAX_IMPORT_CELL_LENGTH)) throw new Error("Um cabeçalho excede o limite de 10.000 caracteres.");
  for (const row of rows) for (const value of Object.values(row)) if (String(value ?? "").length > MAX_IMPORT_CELL_LENGTH) throw new Error("Uma célula excede o limite de 10.000 caracteres.");
}

function parseJsonBuffer(buffer: Buffer) {
  const parsed = JSON.parse(buffer.toString("utf8"));
  if (!Array.isArray(parsed) || !parsed.length || parsed.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("JSON deve ser uma lista de objetos com uma linha por registro.");
  }
  if (parsed.some(row => Object.values(row as Record<string, unknown>).some(value => value !== null && typeof value === "object"))) throw new Error("JSON deve conter valores escalares por célula.");
  if (parsed.length > MAX_IMPORT_ROWS) throw new Error("O arquivo excede o limite de 5.000 linhas.");
  const headers = safeHeaders(Array.from(new Set(parsed.flatMap(row => Object.keys(row)))));
  const rows = parsed.map(row => Object.fromEntries(headers.map(header => [header, (row as Record<string, unknown>)[header] ?? null])));
  assertTabularShape(headers, rows);
  return { headers, rows, rowNumbers: parsed.map((_, index) => index + 2) };
}

export function parseTabularFile(filename: string, buffer: Buffer) {
  const extension = path.extname(filename).toLowerCase().replace(".", "");
  if (!(extension === "csv" || extension === "xls" || extension === "xlsx" || extension === "json")) {
    throw new Error("Formato não suportado. Use CSV, XLS, XLSX ou JSON.");
  }
  if (extension === "json") return { format: extension as "json", ...parseJsonBuffer(buffer) };
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "buffer", cellDates: false, cellFormula: true, WTF: false });
  } catch {
    throw new Error("Não foi possível ler o arquivo. Verifique o formato e o conteúdo.");
  }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("O arquivo não possui uma aba legível.");
  const sheet = workbook.Sheets[sheetName];
  for (const key of Object.keys(sheet)) {
    if (!key.startsWith("!") && sheet[key]?.f) throw new Error("Arquivos com fórmulas não são aceitos. Exporte os valores antes de importar.");
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: true });
  if (!matrix.length) throw new Error("A primeira aba não possui linhas.");
  const headers = safeHeaders((matrix.shift() ?? []) as unknown[]);
  if (!headers.length || headers.every(header => /^coluna_\d+$/.test(header))) throw new Error("A primeira linha deve conter os nomes das colunas.");
  const rowEntries = matrix.map((row, index) => ({ row, rowNumber: index + 2 })).filter(entry => (entry.row as unknown[]).some(value => String(value ?? "").trim()));
  const rows = rowEntries.map(({ row }) => Object.fromEntries(headers.map((header, index) => [header, String((row as unknown[])[index] ?? "")])));
  if (!rows.length) throw new Error("O arquivo não possui registros após o cabeçalho.");
  if (rows.length > MAX_IMPORT_ROWS) throw new Error("O arquivo excede o limite de 5.000 linhas.");
  assertTabularShape(headers, rows);
  return { format: extension as "csv" | "xls" | "xlsx", headers, rows, rowNumbers: rowEntries.map(entry => entry.rowNumber) };
}

export function hashImport(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function autoMapping(target: ImportTarget, headers: string[]) {
  const normalized = new Map(headers.map(header => [normalizeHeader(header), header]));
  const mapping: Record<string, string> = {};
  for (const field of targetFields[target]) {
    const candidates = [field.key, ...(aliasMap[target][field.key] ?? [])];
    const found = candidates.map(normalizeHeader).map(value => normalized.get(value)).find(Boolean);
    if (found) mapping[field.key] = found;
  }
  return mapping;
}

function rawValue(row: Record<string, string>, mapping: Record<string, string>, field: string) {
  const source = mapping[field];
  return source ? String(row[source] ?? "").trim() : "";
}

function boundedText(value: string, label: string, max: number) {
  if (value.length > max) throw new Error(`${label} excede o limite de ${max} caracteres.`);
  return value;
}

function parseNumber(value: string, label: string, options: { positive?: boolean; maxIntegerDigits?: number; maxFractionDigits?: number } = {}) {
  if (!value) return undefined;
  const clean = value.replace(/\s/g, "");
  let normalized = clean;
  if (clean.includes(",") && clean.includes(".")) {
    if (/^-?\d{1,3}(\.\d{3})*,\d+$/.test(clean)) normalized = clean.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(,\d{3})*\.\d+$/.test(clean)) normalized = clean.replace(/,/g, "");
    else throw new Error(`${label} usa separadores de milhar/decimal inválidos.`);
  } else if (clean.includes(",")) {
    if (!/^-?\d+,\d+$/.test(clean)) throw new Error(`${label} usa separadores decimais inválidos.`);
    normalized = clean.replace(",", ".");
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) throw new Error(`${label} deve ser um número decimal simples.`);
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || (options.positive ? parsed <= 0 : parsed < 0)) throw new Error(`${label} deve ser um número válido${options.positive ? " maior que zero" : ""}.`);
  const [integerPart, fractionPart = ""] = normalized.replace(/^-/, "").split(".");
  const integerDigits = integerPart.replace(/^0+/, "").length || 1;
  if (integerDigits > (options.maxIntegerDigits ?? 12) || fractionPart.length > (options.maxFractionDigits ?? 4)) throw new Error(`${label} excede a precisão suportada pelo sistema.`);
  return parsed;
}

function parseInteger(value: string, label: string) {
  if (!value) return 0;
  const clean = value.replace(/\s/g, "");
  if (clean.includes(",") || !/^-?\d+(?:\.\d{3})*$/.test(clean)) throw new Error(`${label} deve ser um número inteiro; decimais não são aceitos.`);
  const parsed = Number(clean.replace(/\./g, ""));
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) throw new Error(`${label} deve ser um número inteiro maior ou igual a zero dentro do limite suportado.`);
  return parsed;
}

function parseDate(value: string, label: string) {
  if (!value) return undefined;
  const br = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  const iso = br ? `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}` : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error(`${label} deve estar no formato AAAA-MM-DD ou DD/MM/AAAA.`);
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) throw new Error(`${label} não é uma data válida.`);
  return iso;
}

function normalizeEnum(value: string, map: Record<string, string>, label: string, fallback?: string) {
  if (!value && fallback) return fallback;
  const key = normalizeHeader(value);
  const result = map[key] ?? (Object.values(map).includes(value) ? value : undefined);
  if (!result) throw new Error(`${label} não reconhecido: ${value}.`);
  return result;
}

function sourceFields(row: Record<string, string>, mapping: Record<string, string>) {
  return {
    sourceReference: boundedText(rawValue(row, mapping, "sourceReference"), "Referência da origem", 240) || undefined,
    notes: boundedText(rawValue(row, mapping, "notes"), "Observações", 10_000) || undefined,
  };
}

export function normalizeRow(target: ImportTarget, row: Record<string, string>, mapping: Record<string, string>, defaults: { businessUnitId?: string } = {}) {
  const common = sourceFields(row, mapping);
  if (target === "livestock_lot") {
    const lotCode = boundedText(rawValue(row, mapping, "lotCode"), "Código do lote", 60);
    if (!lotCode) throw new Error("Código do lote é obrigatório.");
    const regime = normalizeEnum(rawValue(row, mapping, "regime"), { pasto: "pasture", pasture: "pasture", semiintensivo: "semi_intensive", semintensive: "semi_intensive", confinado: "feedlot", feedlot: "feedlot" }, "Regime", "feedlot");
    return { ...common, lotCode, businessUnitId: rawValue(row, mapping, "businessUnitId") || defaults.businessUnitId, businessUnitCode: rawValue(row, mapping, "businessUnitCode") || undefined, regime, headCount: parseInteger(rawValue(row, mapping, "headCount"), "Cabeças"), entryDate: parseDate(rawValue(row, mapping, "entryDate"), "Data de entrada"), expectedExitDate: parseDate(rawValue(row, mapping, "expectedExitDate"), "Saída prevista") };
  }
  if (target === "lot_event") {
    const eventType = normalizeEnum(rawValue(row, mapping, "eventType"), { entrada: "entry", pesagem: "weighing", manejo: "handling", transferencia: "transfer", saida: "exit", nota: "note", entry: "entry", weighing: "weighing", handling: "handling", transfer: "transfer", exit: "exit", note: "note" }, "Tipo do evento");
    const lotId = rawValue(row, mapping, "lotId") || undefined;
    const lotCode = boundedText(rawValue(row, mapping, "lotCode"), "Código do lote", 60) || undefined;
    if (!lotId && !lotCode) throw new Error("Informe o ID ou o código do lote.");
    const eventDate = parseDate(rawValue(row, mapping, "eventDate"), "Data do evento");
    if (!eventDate) throw new Error("Data do evento é obrigatória.");
    return { ...common, lotId, lotCode, eventType, eventDate, quantity: parseNumber(rawValue(row, mapping, "quantity"), "Quantidade"), unit: boundedText(rawValue(row, mapping, "unit"), "Unidade", 30) || undefined, status: normalizeEnum(rawValue(row, mapping, "status"), { realizado: "realized", realized: "realized", estimado: "estimated", estimated: "estimated", simulado: "simulated", simulated: "simulated", confirmar: "to_confirm", aconfirmar: "to_confirm", toconfirm: "to_confirm" }, "Status", "to_confirm"), quality: normalizeEnum(rawValue(row, mapping, "quality"), { alta: "high", high: "high", media: "medium", medium: "medium", baixa: "low", low: "low", desconhecida: "unknown", unknown: "unknown" }, "Qualidade", "unknown") };
  }
  if (target === "input_movement") {
    const inputId = rawValue(row, mapping, "inputId") || undefined;
    const inputSku = rawValue(row, mapping, "inputSku") || undefined;
    if (!inputId && !inputSku) throw new Error("Informe o ID ou o SKU do insumo.");
    const lotId = rawValue(row, mapping, "lotId") || undefined;
    const lotCode = rawValue(row, mapping, "lotCode") || undefined;
    const movementDate = parseDate(rawValue(row, mapping, "movementDate"), "Data do movimento");
    if (!movementDate) throw new Error("Data do movimento é obrigatória.");
    const quantity = parseNumber(rawValue(row, mapping, "quantity"), "Quantidade", { positive: true });
    if (quantity === undefined) throw new Error("Quantidade é obrigatória.");
    return { ...common, inputId, inputSku, lotId, lotCode, movementType: normalizeEnum(rawValue(row, mapping, "movementType"), { entrada: "inbound", inbound: "inbound", consumo: "consumption", consumption: "consumption", transferencia: "transfer", transfer: "transfer", ajuste: "adjustment", adjustment: "adjustment" }, "Tipo do movimento"), movementDate, quantity, unitCost: parseNumber(rawValue(row, mapping, "unitCost"), "Custo unitário") };
  }
  const businessUnitId = rawValue(row, mapping, "businessUnitId") || defaults.businessUnitId || undefined;
  const businessUnitCode = rawValue(row, mapping, "businessUnitCode") || undefined;
  if (!businessUnitId && !businessUnitCode) throw new Error("Informe o ID ou o código da unidade.");
  const entryDate = parseDate(rawValue(row, mapping, "entryDate"), "Data do lançamento");
  if (!entryDate) throw new Error("Data do lançamento é obrigatória.");
  const amount = parseNumber(rawValue(row, mapping, "amount"), "Valor", { positive: true, maxIntegerDigits: 14, maxFractionDigits: 2 });
  if (amount === undefined) throw new Error("Valor é obrigatório.");
  return { ...common, businessUnitId, businessUnitCode, lotId: rawValue(row, mapping, "lotId") || undefined, lotCode: rawValue(row, mapping, "lotCode") || undefined, inputMovementId: rawValue(row, mapping, "inputMovementId") || undefined, entryType: normalizeEnum(rawValue(row, mapping, "entryType"), { custo: "cost", cost: "cost", receita: "revenue", revenue: "revenue", ajuste: "adjustment", adjustment: "adjustment" }, "Tipo do lançamento"), entryDate, amount, currency: (rawValue(row, mapping, "currency") || "BRL").toUpperCase().slice(0, 3) };
}

async function oneBy(query: Promise<any[]>, label: string): Promise<any | undefined> {
  const rows = await query;
  if (rows.length > 1) throw new Error(`${label} corresponde a mais de um registro.`);
  return rows[0];
}

export async function resolveAndValidateRow(db: any, organizationId: string, target: ImportTarget, normalized: Record<string, any>, defaults: { businessUnitId?: string } = {}) {
  const errors: string[] = [];
  const resolved = { ...normalized };
  try {
    if (target === "livestock_lot") {
      const unit = normalized.businessUnitId
        ? await oneBy(db.select().from(businessUnits).where(and(eq(businessUnits.id, normalized.businessUnitId), eq(businessUnits.organizationId, organizationId))).limit(2), "Unidade")
        : normalized.businessUnitCode
          ? await oneBy(db.select().from(businessUnits).where(and(eq(businessUnits.code, normalized.businessUnitCode), eq(businessUnits.organizationId, organizationId))).limit(2), "Unidade")
          : defaults.businessUnitId
            ? await oneBy(db.select().from(businessUnits).where(and(eq(businessUnits.id, defaults.businessUnitId), eq(businessUnits.organizationId, organizationId))).limit(2), "Unidade")
            : undefined;
      if (!unit) errors.push("Unidade não encontrada."); else resolved.businessUnitId = unit.id;
      const existing = await db.select({ id: livestockLots.id }).from(livestockLots).where(and(eq(livestockLots.organizationId, organizationId), eq(livestockLots.lotCode, normalized.lotCode))).limit(1);
      if (existing[0]) errors.push("Código do lote já existe nesta organização.");
    } else if (target === "lot_event") {
      const lot = normalized.lotId
        ? await oneBy(db.select().from(livestockLots).where(and(eq(livestockLots.id, normalized.lotId), eq(livestockLots.organizationId, organizationId))).limit(2), "Lote")
        : await oneBy(db.select().from(livestockLots).where(and(eq(livestockLots.lotCode, normalized.lotCode), eq(livestockLots.organizationId, organizationId))).limit(2), "Lote");
      if (!lot) errors.push("Lote não encontrado."); else resolved.lotId = lot.id;
      if (lot) {
        const duplicate = await db.select({ id: lotEvents.id }).from(lotEvents).where(and(eq(lotEvents.organizationId, organizationId), eq(lotEvents.lotId, lot.id), eq(lotEvents.eventType, normalized.eventType), eq(lotEvents.eventDate, normalized.eventDate))).limit(1);
        if (duplicate[0]) errors.push("Já existe evento do mesmo tipo e data para este lote.");
      }
    } else if (target === "input_movement") {
      const input = normalized.inputId
        ? await oneBy(db.select().from(inputs).where(and(eq(inputs.id, normalized.inputId), eq(inputs.organizationId, organizationId))).limit(2), "Insumo")
        : await oneBy(db.select().from(inputs).where(and(eq(inputs.sku, normalized.inputSku), eq(inputs.organizationId, organizationId))).limit(2), "Insumo");
      if (!input) errors.push("Insumo não encontrado."); else resolved.inputId = input.id;
      const lot = normalized.lotId
        ? await oneBy(db.select().from(livestockLots).where(and(eq(livestockLots.id, normalized.lotId), eq(livestockLots.organizationId, organizationId))).limit(2), "Lote")
        : normalized.lotCode
          ? await oneBy(db.select().from(livestockLots).where(and(eq(livestockLots.lotCode, normalized.lotCode), eq(livestockLots.organizationId, organizationId))).limit(2), "Lote")
          : undefined;
      if (normalized.lotId || normalized.lotCode) {
        if (!lot) errors.push("Lote não encontrado."); else resolved.lotId = lot.id;
      }
      if (input && normalized.sourceReference) {
        const duplicate = await db.select({ id: inputMovements.id }).from(inputMovements).where(and(eq(inputMovements.organizationId, organizationId), eq(inputMovements.inputId, input.id), eq(inputMovements.movementDate, normalized.movementDate), eq(inputMovements.movementType, normalized.movementType), eq(inputMovements.sourceReference, normalized.sourceReference))).limit(1);
        if (duplicate[0]) errors.push("Movimentação com a mesma origem já existe.");
      }
    } else {
      const unit = normalized.businessUnitId
        ? await oneBy(db.select().from(businessUnits).where(and(eq(businessUnits.id, normalized.businessUnitId), eq(businessUnits.organizationId, organizationId))).limit(2), "Unidade")
        : normalized.businessUnitCode
          ? await oneBy(db.select().from(businessUnits).where(and(eq(businessUnits.code, normalized.businessUnitCode), eq(businessUnits.organizationId, organizationId))).limit(2), "Unidade")
          : defaults.businessUnitId
            ? await oneBy(db.select().from(businessUnits).where(and(eq(businessUnits.id, defaults.businessUnitId), eq(businessUnits.organizationId, organizationId))).limit(2), "Unidade")
            : undefined;
      if (!unit) errors.push("Unidade não encontrada."); else resolved.businessUnitId = unit.id;
      const lot = normalized.lotId
        ? await oneBy(db.select().from(livestockLots).where(and(eq(livestockLots.id, normalized.lotId), eq(livestockLots.organizationId, organizationId))).limit(2), "Lote")
        : normalized.lotCode
          ? await oneBy(db.select().from(livestockLots).where(and(eq(livestockLots.lotCode, normalized.lotCode), eq(livestockLots.organizationId, organizationId))).limit(2), "Lote")
          : undefined;
      if (normalized.lotId || normalized.lotCode) {
        if (!lot) errors.push("Lote não encontrado."); else resolved.lotId = lot.id;
      }
      if (normalized.inputMovementId) {
        const movement = await db.select({ id: inputMovements.id }).from(inputMovements).where(and(eq(inputMovements.id, normalized.inputMovementId), eq(inputMovements.organizationId, organizationId))).limit(1);
        if (!movement[0]) errors.push("Movimentação de insumo não encontrada.");
      }
      if (resolved.businessUnitId && normalized.sourceReference) {
        const duplicate = await db.select({ id: economicEntries.id }).from(economicEntries).where(and(eq(economicEntries.organizationId, organizationId), eq(economicEntries.businessUnitId, resolved.businessUnitId), eq(economicEntries.entryDate, normalized.entryDate), eq(economicEntries.sourceReference, normalized.sourceReference))).limit(1);
        if (duplicate[0]) errors.push("Lançamento com a mesma origem já existe.");
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Não foi possível resolver referências.");
  }
  return { normalized: resolved, errors };
}

export function rowDedupeKey(target: ImportTarget, value: Record<string, any>) {
  if (target === "livestock_lot") return `${target}:${value.lotCode}`.toLowerCase();
  if (target === "lot_event") return `${target}:${value.lotId ?? value.lotCode}:${value.eventType}:${value.eventDate}`.toLowerCase();
  if (target === "input_movement") return `${target}:${value.inputId ?? value.inputSku}:${value.movementType}:${value.movementDate}:${value.sourceReference ?? ""}`.toLowerCase();
  return `${target}:${value.businessUnitId ?? value.businessUnitCode}:${value.entryType}:${value.entryDate}:${value.sourceReference ?? ""}`.toLowerCase();
}
