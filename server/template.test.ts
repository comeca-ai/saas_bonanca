import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { autoMapping } from "./imports";

const templatePath = fileURLToPath(new URL("../client/public/templates/Template_Dados_Bonanca.xlsx", import.meta.url));
const expectedSheets = ["Comece aqui", "Dicionario", "Unidades", "Lotes", "Movimentos", "Pesagens", "Consumo", "Financeiro", "Metas", "Acoes"];

function workbook() {
  return XLSX.read(readFileSync(templatePath), { type: "buffer", cellDates: false, cellFormula: true });
}

function headers(sheetName: string) {
  const sheet = workbook().Sheets[sheetName];
  return (XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false })[0] ?? []) as string[];
}

describe("template oficial de dados", () => {
  it("preserva as dez abas oficiais e suas instruções", () => {
    const file = readFileSync(templatePath);
    expect(file.length).toBeGreaterThan(10_000);
    expect(workbook().SheetNames).toEqual(expectedSheets);
    expect(String(XLSX.utils.sheet_to_json(workbook().Sheets["Comece aqui"], { header: 1 })[0])).toContain("Bonança");
    expect(headers("Dicionario")).toEqual(["Aba", "Campo", "Tipo", "Obrigatório", "Exemplo fictício", "Regra / significado"]);
  });

  it("reconhece os cabeçalhos das abas operacionais", () => {
    const lots = autoMapping("livestock_lot", headers("Lotes"));
    expect(lots).toMatchObject({
      lotCode: "lote_id",
      businessUnitId: "unidade_id",
      regime: "fase",
      headCount: "cabecas_iniciais",
      entryDate: "data_abertura",
    });

    const movements = autoMapping("lot_event", headers("Movimentos"));
    expect(movements).toMatchObject({
      lotId: "lote_id",
      eventType: "tipo_evento",
      eventDate: "data_evento",
      quantity: "cabecas",
      sourceReference: "documento_ref",
    });

    const weighings = autoMapping("lot_event", headers("Pesagens"));
    expect(weighings).toMatchObject({ lotId: "lote_id", eventDate: "data_pesagem" });
    expect(["cabecas_pesadas", "peso_vivo_total_kg"]).toContain(weighings.quantity);

    const consumption = autoMapping("input_movement", headers("Consumo"));
    expect(consumption).toMatchObject({ inputId: "item_id", movementDate: "data_consumo", quantity: "quantidade_kg" });

    const finance = autoMapping("economic_entry", headers("Financeiro"));
    expect(finance).toMatchObject({ businessUnitId: "unidade_id", lotId: "lote_id", entryDate: "data_competencia", amount: "valor_previsto_brl", sourceReference: "documento_ref" });
  });

  it("mantém Metas e Acoes como abas preparadas para fases futuras", () => {
    expect(headers("Metas")).toContain("indicador");
    expect(headers("Acoes")).toContain("problema");
    expect(headers("Acoes")).toContain("evidencia_resultado");
  });
});
