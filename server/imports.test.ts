import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { autoMapping, normalizeRow, parseTabularFile } from "./imports";

describe("import parser", () => {
  it("lê CSV, sugere o mapeamento e normaliza datas brasileiras", () => {
    const file = Buffer.from("lote,fazenda,regime,cabecas,data\nL-001,FAZ-01,confinado,120,22/10/2026\n", "utf8");
    const parsed = parseTabularFile("lotes.csv", file);
    const mapping = autoMapping("livestock_lot", parsed.headers);
    const row = normalizeRow("livestock_lot", parsed.rows[0] as Record<string, string>, mapping, {}) as any;
    expect(row.lotCode).toBe("L-001");
    expect(row.businessUnitCode).toBe("FAZ-01");
    expect(row.entryDate).toBe("2026-10-22");
    expect(row.headCount).toBe(120);
  });

  it("lê JSON tabular", () => {
    const parsed = parseTabularFile("movimentos.json", Buffer.from(JSON.stringify([{ sku: "MILHO", quantidade: 12 }, { sku: "FARELO", quantidade: 8 }])));
    expect(parsed.headers).toEqual(["sku", "quantidade"]);
    expect(parsed.rows).toHaveLength(2);
  });

  it("rejeita JSON acima do limite operacional", () => {
    const rows = Array.from({ length: 5001 }, (_, index) => ({ sku: `SKU-${index}` }));
    expect(() => parseTabularFile("movimentos.json", Buffer.from(JSON.stringify(rows)))).toThrow("5.000 linhas");
  });

  it("não converte decimais malformados em quantidade inteira", () => {
    const mapping = { lotCode: "lote", headCount: "cabecas" };
    expect(() => normalizeRow("livestock_lot", { lote: "L-004", cabecas: "1.2" }, mapping, {})).toThrow("número inteiro");
    expect(() => normalizeRow("livestock_lot", { lote: "L-004", cabecas: "1.23.4" }, mapping, {})).toThrow("número inteiro");
  });

  it("lê a primeira aba de uma planilha XLSX", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["lote", "cabecas"], ["L-002", 85]]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Dados");
    const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    const parsed = parseTabularFile("lotes.xlsx", file);
    expect(parsed.rows[0].lote).toBe("L-002");
    expect(parsed.rows[0].cabecas).toBe("85");
    const legacyFile = XLSX.write(workbook, { bookType: "biff8", type: "buffer" });
    const legacyParsed = parseTabularFile("lotes.xls", legacyFile);
    expect(legacyParsed.rows[0].lote).toBe("L-002");
  });

  it("rejeita células com fórmula para preservar somente valores de origem", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([["lote", "cabecas"], ["L-003", 1]]);
    sheet.B2 = { t: "n", f: "1+1", v: 2 };
    XLSX.utils.book_append_sheet(workbook, sheet, "Dados");
    const file = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    expect(() => parseTabularFile("lotes.xlsx", file)).toThrow("fórmulas");
  });
});
