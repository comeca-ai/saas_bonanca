import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, FileWarning, History, RefreshCw, Rows3, ShieldCheck, UploadCloud, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

const targetLabels: Record<string, string> = {
  livestock_lot: "Lotes de pecuária",
  lot_event: "Eventos e pesagens de lote",
  input_movement: "Movimentações de insumo",
  economic_entry: "Lançamentos econômicos",
};

const statusLabels: Record<string, string> = {
  uploaded: "Recebido",
  mapped: "Mapeado",
  validated: "Validado",
  processing: "Processando",
  completed: "Importado",
  partial: "Parcial",
  failed: "Falhou",
  cancelled: "Cancelado",
  pending: "Pendente",
  valid: "Válida",
  invalid: "Inválida",
  duplicate: "Duplicada",
  imported: "Importada",
};

function statusTone(status: string) {
  if (["completed", "valid", "imported"].includes(status)) return "good";
  if (["validated", "mapped", "uploaded", "pending"].includes(status)) return "warn";
  if (["invalid", "duplicate", "failed"].includes(status)) return "danger";
  return "neutral";
}

function StatusPill({ value }: { value: string }) {
  return <span className={`status-pill ${statusTone(value)}`}><span className="status-dot" />{statusLabels[value] ?? value}</span>;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

export default function ImportsView() {
  const [targetEntity, setTargetEntity] = useState("livestock_lot");
  const [businessUnitId, setBusinessUnitId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [activeId, setActiveId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const schema = trpc.imports.schema.useQuery();
  const batches = trpc.imports.list.useQuery();
  const units = trpc.core.units.useQuery();
  const detail = trpc.imports.detail.useQuery({ id: activeId }, { enabled: Boolean(activeId), refetchInterval: activeId ? 20_000 : false });
  const utils = trpc.useUtils();
  const upload = trpc.imports.upload.useMutation();
  const saveMapping = trpc.imports.map.useMutation();
  const validate = trpc.imports.validate.useMutation();
  const commit = trpc.imports.commit.useMutation();
  const cancel = trpc.imports.cancel.useMutation();

  const target = useMemo(() => schema.data?.targets.find(item => item.target === (detail.data?.targetEntity ?? targetEntity)), [schema.data?.targets, detail.data?.targetEntity, targetEntity]);
  const activeMapping = detail.data?.mapping as Record<string, string> | undefined;
  const selectedBatch = detail.data;

  useEffect(() => {
    if (activeMapping) setMapping(activeMapping);
  }, [detail.data?.id, activeMapping]);

  const refresh = () => {
    void batches.refetch();
    if (activeId) void detail.refetch();
    void utils.dashboard.summary.invalidate();
    void utils.dataControl.overview.invalidate();
  };

  const chooseBatch = (id: string) => {
    setActiveId(id);
    setNotice(null);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setNotice({ tone: "error", text: "Escolha um arquivo antes de enviar." });
      return;
    }
    try {
      const contentBase64 = await readFileAsBase64(file);
      const result = await upload.mutateAsync({ filename: file.name, mimeType: file.type || undefined, contentBase64, targetEntity: targetEntity as "livestock_lot" | "lot_event" | "input_movement" | "economic_entry", businessUnitId: businessUnitId || undefined });
      setActiveId(result.id);
      setMapping(result.mapping);
      setFile(null);
      setNotice({ tone: "success", text: `${result.totalRows} linhas recebidas. Revise o mapeamento antes de validar.` });
      refresh();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    }
  };

  const handleValidate = async () => {
    if (!activeId) return;
    try {
      await saveMapping.mutateAsync({ id: activeId, mapping });
      const result = await validate.mutateAsync({ id: activeId });
      setNotice({ tone: result.invalidRows ? "error" : "success", text: `${result.validRows} linhas válidas, ${result.invalidRows} inválidas e ${result.duplicateRows} duplicadas.` });
      refresh();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    }
  };

  const handleCommit = async () => {
    if (!activeId || !window.confirm("Aprovar as linhas válidas? Os registros entrarão no domínio com origem importada e status a confirmar.")) return;
    try {
      const result = await commit.mutateAsync({ id: activeId, confirm: true });
      setNotice({ tone: "success", text: `${result.imported} registros importados. ${result.skipped} linhas ficaram fora por erro ou duplicidade.` });
      refresh();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    }
  };

  const handleCancel = async () => {
    if (!activeId || !window.confirm("Cancelar este lote de importação? O arquivo será mantido para auditoria.")) return;
    try {
      await cancel.mutateAsync({ id: activeId });
      setNotice({ tone: "success", text: "Lote cancelado. O arquivo original permanece preservado." });
      refresh();
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error) });
    }
  };

  return <>
    <section className="import-hero">
      <div className="import-hero-icon"><UploadCloud size={22} /></div>
      <div><span className="eyebrow">Entrada controlada de dados</span><h2>Traga a base sem perder a origem.</h2><p>CSV, XLS, XLSX e JSON entram primeiro em uma área de conferência. O Bonança não grava uma planilha diretamente no domínio.</p></div>
      <div className="import-hero-rule"><ShieldCheck size={16} /><span>Arquivo original, hash, linha, usuário e decisão ficam auditáveis.</span></div>
    </section>

    <div className="import-layout">
      <section className="panel import-upload-card">
        <div className="panel-header"><div><span className="eyebrow">1 · Receber arquivo</span><h2>Nova importação</h2></div><div className="toolbar-actions"><a className="secondary-button" href="/templates/Template_Dados_Bonanca.xlsx" download="Template_Dados_Bonanca.xlsx"><Download size={14} />Modelo Excel</a><FileSpreadsheet size={18} className="panel-header-icon" /></div></div>
        <form onSubmit={handleUpload}>
          <label className="import-label">O que este arquivo representa<select value={targetEntity} onChange={event => setTargetEntity(event.target.value)}><option value="livestock_lot">Lotes de pecuária</option><option value="lot_event">Eventos e pesagens de lote</option><option value="input_movement">Movimentações de insumo</option><option value="economic_entry">Lançamentos econômicos</option></select></label>
          <label className="import-label">Unidade padrão <span className="field-hint">opcional, usada quando a planilha não traz a unidade</span><select value={businessUnitId} onChange={event => setBusinessUnitId(event.target.value)}><option value="">Não definir</option>{units.data?.map((unit: any) => <option key={unit.id} value={unit.id}>{unit.code} · {unit.name}</option>)}</select></label>
          <label className={`file-drop ${file ? "has-file" : ""}`}><input type="file" accept=".csv,.xls,.xlsx,.json" onChange={event => setFile(event.target.files?.[0] ?? null)} /><UploadCloud size={20} /><strong>{file ? file.name : "Selecione ou arraste um arquivo"}</strong><span>{file ? `${formatBytes(file.size)} · pronto para leitura` : "Até 5 MB · primeira aba · sem macros ou fórmulas"}</span></label>
          <div className="import-form-note"><FileWarning size={15} /><span>O arquivo original é preservado. Linhas inválidas não são descartadas nem corrigidas automaticamente.</span></div>
          <button className="primary-button import-submit" disabled={!file || upload.isPending}><UploadCloud size={16} />{upload.isPending ? "Lendo arquivo…" : "Receber e abrir prévia"}</button>
        </form>
        {notice && <div className={`import-notice ${notice.tone}`}><span>{notice.text}</span><button aria-label="Fechar aviso" onClick={() => setNotice(null)}><X size={14} /></button></div>}
      </section>

      <section className="panel import-history-card">
        <div className="panel-header"><div><span className="eyebrow">Histórico de lotes</span><h2>Importações recentes</h2></div><button className="icon-button" onClick={() => batches.refetch()} aria-label="Atualizar histórico"><RefreshCw size={15} /></button></div>
        {batches.isLoading ? <div className="loading-panel"><span className="spinner" /> Carregando histórico…</div> : batches.data?.length ? <div className="import-history-list">{batches.data.map((batch: any) => <button className={`import-history-row ${activeId === batch.id ? "selected" : ""}`} key={batch.id} onClick={() => chooseBatch(batch.id)}><span className="history-file-icon"><FileSpreadsheet size={15} /></span><span className="history-file-copy"><b>{batch.sourceFilename}</b><small>{targetLabels[batch.targetEntity]} · {batch.totalRows} linhas</small></span><span className="history-file-status"><StatusPill value={batch.status} /><small>{new Date(batch.createdAt).toLocaleDateString("pt-BR")}</small></span></button>)}</div> : <div className="import-empty"><History size={19} /><b>Nenhuma importação ainda</b><span>O histórico aparecerá depois do primeiro arquivo.</span></div>}
      </section>
    </div>

    {selectedBatch && <section className="panel import-workspace">
      <div className="import-workspace-header"><div><span className="eyebrow">2 · Conferência do lote</span><h2>{selectedBatch.sourceFilename}</h2><p>{targetLabels[selectedBatch.targetEntity]} · hash preservado · {formatBytes(selectedBatch.sourceSize)}</p></div><div className="toolbar-actions"><StatusPill value={selectedBatch.status} /><button className="secondary-button" onClick={handleCancel} disabled={selectedBatch.status === "completed" || selectedBatch.status === "cancelled"}><X size={14} /> Cancelar lote</button></div></div>
      <div className="import-steps"><span className="done"><CheckCircle2 size={15} />Arquivo recebido</span><ArrowRight size={14} /><span className={selectedBatch.status !== "uploaded" ? "done" : "active"}>Mapeamento</span><ArrowRight size={14} /><span className={selectedBatch.status === "validated" || selectedBatch.status === "completed" || selectedBatch.status === "partial" ? "done" : "active"}>Validação</span><ArrowRight size={14} /><span className={selectedBatch.status === "completed" || selectedBatch.status === "partial" ? "done" : "active"}>Aprovação</span></div>
      <div className="import-summary"><div><span>Total de linhas</span><strong>{selectedBatch.totalRows}</strong></div><div className="good"><span>Válidas</span><strong>{selectedBatch.validRows}</strong></div><div className="danger"><span>Inválidas</span><strong>{selectedBatch.invalidRows}</strong></div><div className="warn"><span>Duplicadas</span><strong>{selectedBatch.duplicateRows}</strong></div></div>

      <div className="import-mapping-grid"><div><div className="panel-header compact-header"><div><span className="eyebrow">Mapeamento de colunas</span><h3>De onde vem cada campo?</h3></div><Rows3 size={18} /></div><p className="import-help">O sistema sugere correspondências por nome. Revise antes de validar; campos sem correspondência permanecem vazios.</p><div className="mapping-list">{target?.fields.map((field: any) => <label className="mapping-row" key={field.key}><span><b>{field.label}</b>{field.required && <em>obrigatório</em>}<small>{field.key}</small></span><select value={mapping[field.key] ?? ""} onChange={event => setMapping({ ...mapping, [field.key]: event.target.value })}><option value="">Não mapear</option>{(selectedBatch.headers as string[]).map(header => <option key={header} value={header}>{header}</option>)}</select></label>)}</div><div className="modal-actions"><button className="primary-button" onClick={handleValidate} disabled={saveMapping.isPending || validate.isPending || selectedBatch.status === "completed" || selectedBatch.status === "cancelled"}><ShieldCheck size={15} />{validate.isPending ? "Validando…" : "Salvar mapeamento e validar"}</button>{(selectedBatch.status === "validated" || selectedBatch.status === "partial") && selectedBatch.pendingValidRows > 0 && <button className="secondary-button" onClick={handleCommit} disabled={commit.isPending}><CheckCircle2 size={15} />{commit.isPending ? "Importando…" : selectedBatch.status === "partial" ? "Retomar linhas válidas" : "Aprovar linhas válidas"}</button>}</div></div><div className="import-rules"><div className="panel-header compact-header"><div><span className="eyebrow">Regras aplicadas</span><h3>Sem limpeza silenciosa</h3></div><ShieldCheck size={18} /></div><ul><li>Hash impede receber o mesmo arquivo duas vezes.</li><li>Linhas preservam o conteúdo original e o número da linha.</li><li>Duplicidades e referências inexistentes ficam separadas.</li><li>Registros aprovados entram com origem importada e “a confirmar”.</li><li>Movimentos ligados a lotes viram vínculos candidatos.</li></ul></div></div>

      <div className="import-preview"><div className="panel-header compact-header"><div><span className="eyebrow">Prévia da conferência</span><h3>Linhas do arquivo</h3></div><span className="panel-meta">Mostrando até 120 linhas</span></div>{selectedBatch.rows?.length ? <div className="table-wrap"><table><thead><tr><th>Linha</th><th>Situação</th><th>Dados originais</th><th>Problemas</th></tr></thead><tbody>{selectedBatch.rows.map((row: any) => <tr key={row.id}><td className="mono">{row.rowNumber}</td><td><StatusPill value={row.status} /></td><td><div className="preview-values">{Object.entries(row.sourceData as Record<string, unknown>).slice(0, 5).map(([key, value]) => <span key={key}><b>{key}</b>{String(value || "—")}</span>)}</div></td><td>{Array.isArray(row.errors) && row.errors.length ? <div className="row-errors">{row.errors.map((error: string) => <span key={error}>{error}</span>)}</div> : <span className="muted-text">Sem problemas</span>}</td></tr>)}</tbody></table></div> : <div className="loading-panel"><span className="spinner" /> Carregando prévia…</div>}</div>
    </section>}
  </>;
}
