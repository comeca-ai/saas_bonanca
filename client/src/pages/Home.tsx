import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Boxes,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Database,
  FileClock,
  FileText,
  Gauge,
  Layers3,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tractor,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import ImportsView from "./Imports";
import OperationsView from "./Operations";

const navItems = [
  { path: "/", label: "Visão geral", icon: BarChart3 },
  { path: "/livestock", label: "Pecuária", icon: Tractor },
  { path: "/operations", label: "Pesagem e alimentação", icon: Activity },
  { path: "/imports", label: "Importação", icon: UploadCloud },
  { path: "/core", label: "Núcleo comum", icon: Layers3 },
  { path: "/data-control", label: "Controle de dados", icon: ShieldCheck },
  { path: "/catalog", label: "Catálogo e KPIs", icon: BookOpen },
  { path: "/audit", label: "Histórico", icon: FileClock },
];

const viewMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
  "/": { eyebrow: "Visão geral", title: "O que precisa da sua atenção", description: "A operação em uma camada simples, com evidência antes de qualquer conclusão." },
  "/livestock": { eyebrow: "Pecuária", title: "Lotes e ciclos operacionais", description: "Acompanhe o que está em campo sem perder a origem do número." },
  "/operations": { eyebrow: "Operação integrada", title: "Pesagem e alimentação", description: "Os serviços especializados operam no mesmo contexto de organização e auditoria do Bonança." },
  "/imports": { eyebrow: "Entrada de dados", title: "Importar sem perder a origem", description: "Receba planilhas, revise o mapeamento e aprove somente o que fizer sentido para o domínio." },
  "/core": { eyebrow: "Núcleo comum", title: "Estrutura do grupo", description: "Unidades, atividades e operações que sustentam cada domínio." },
  "/data-control": { eyebrow: "Governança", title: "Controle dos dados", description: "Resolva o que precisa de confirmação antes de virar indicador." },
  "/catalog": { eyebrow: "Conhecimento", title: "Catálogo e KPIs", description: "Um significado único para cada campo e cada número de gestão." },
  "/audit": { eyebrow: "Rastreabilidade", title: "Histórico de alterações", description: "Nada importante muda sem deixar rastro." },
  "/settings": { eyebrow: "Administração", title: "Configuração do espaço", description: "Ajuste unidades, acesso e o que está habilitado no seu ambiente." },
  "/growth-calculator": { eyebrow: "Planejamento", title: "Quanto custa crescer", description: "Uma ordem de grandeza para conversar sobre o próximo passo." },
};

function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value || 0);
}

function statusLabel(value: string) {
  const map: Record<string, string> = { verified: "Verificado", partial: "Parcial", to_confirm: "A confirmar", realized: "Realizado", estimated: "Estimado", simulated: "Simulado", candidate: "Candidato", confirmed: "Confirmado", open: "Em aberto", resolved: "Resolvido", active: "Ativo", feedlot: "Confinado", semi_intensive: "Semi-intensivo", pasture: "Pasto" };
  return map[value] ?? value;
}

function StatusPill({ value, tone }: { value: string; tone?: "good" | "warn" | "danger" | "neutral" }) {
  const resolvedTone = tone ?? (value === "verified" || value === "realized" || value === "confirmed" ? "good" : value === "to_confirm" || value === "candidate" || value === "estimated" || value === "partial" ? "warn" : value === "open" ? "danger" : "neutral");
  return <span className={`status-pill ${resolvedTone}`}><span className="status-dot" />{statusLabel(value)}</span>;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof Database; title: string; description: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={19} /></div><div><strong>{title}</strong><p>{description}</p></div></div>;
}

function Shell({ children, currentPath }: { children: React.ReactNode; currentPath: string }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const me = trpc.auth.me.useQuery();
  const summary = trpc.dashboard.summary.useQuery(undefined, { enabled: Boolean(me.data), staleTime: 15_000 });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => window.location.reload() });
  const meta = viewMeta[currentPath] ?? viewMeta["/"];
  const user = me.data;
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
      <div className="sidebar-top">
        <div className="brand-lockup"><span className="brand-mark">B</span><span>bonança</span></div>
        <button className="mobile-close" onClick={() => setMobileOpen(false)}><X size={19} /></button>
        <div className="workspace-switcher"><span className="workspace-avatar">BD</span><span><b>{user?.organizationName ?? "Bonança Demo"}</b><small>Workspace principal</small></span><ChevronRight size={15} /></div>
      </div>
      <nav className="main-nav">
        <span className="nav-label">Operação</span>
        {navItems.slice(0, 6).map((item: any) => <Link key={item.path} href={item.path} className={`nav-item ${currentPath === item.path ? "active" : ""}`} onClick={() => setMobileOpen(false)}><item.icon size={17} /><span>{item.label}</span>{item.path === "/data-control" && summary.data && <span className="nav-count">{summary.data.toConfirm + summary.data.openDiscrepancies + summary.data.candidateLinks}</span>}</Link>)}
        <span className="nav-label nav-label-space">Conhecimento</span>
        {navItems.slice(6).map((item: any) => <Link key={item.path} href={item.path} className={`nav-item ${currentPath === item.path ? "active" : ""}`} onClick={() => setMobileOpen(false)}><item.icon size={17} /><span>{item.label}</span></Link>)}
        <span className="nav-label nav-label-space">Planejamento</span>
        <Link href="/growth-calculator" className={`nav-item ${currentPath === "/growth-calculator" ? "active" : ""}`} onClick={() => setMobileOpen(false)}><Gauge size={17} /><span>Quanto custa crescer</span></Link>
      </nav>
      <div className="sidebar-bottom">
        <Link href="/settings" className={`nav-item ${currentPath === "/settings" ? "active" : ""}`}><Settings2 size={17} /><span>Configuração</span></Link>
        <div className="user-card"><div className="user-avatar">{(user?.name ?? "A").slice(0, 1).toUpperCase()}</div><div className="user-copy"><b>{user?.name ?? "Administrador"}</b><small>{user?.organizationRole === "owner" ? "Owner" : "Administrador"}</small></div><button aria-label="Sair" onClick={() => logout.mutate()}><LogOut size={15} /></button></div>
      </div>
    </aside>
    {mobileOpen && <button className="mobile-overlay" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}
    <main className="main-content">
      <header className="topbar"><button className="mobile-menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="topbar-context"><span className="eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1></div><div className="topbar-actions"><span className="sync-state"><span className="sync-dot" /> Base sincronizada</span><Link href="/settings" className="topbar-button"><SlidersHorizontal size={16} /> <span>Configurar</span></Link></div></header>
      <div className="page-body"><div className="page-intro"><div><p>{meta.description}</p></div><div className="page-breadcrumb"><span>Grupo Bonança</span><ChevronRight size={13} /><span>{meta.eyebrow}</span></div></div>{children}</div>
    </main>
  </div>;
}

function MetricCard({ icon: Icon, label, value, note, tone = "green" }: { icon: typeof Database; label: string; value: string; note: string; tone?: string }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}><Icon size={17} /></div><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-note">{note}</span></div>;
}

function DashboardView() {
  const summary = trpc.dashboard.summary.useQuery();
  if (summary.isLoading) return <LoadingPanel />;
  if (summary.isError) return <ErrorPanel message="Não foi possível carregar o resumo desta organização." />;
  const data = summary.data;
  if (!data) return <LoadingPanel />;
  return <>
    <section className="metric-grid">
      <MetricCard icon={Tractor} label="Lotes ativos" value={formatNumber(data.activeLots)} note={`${formatNumber(data.heads)} cabeças sob gestão`} />
      <MetricCard icon={Boxes} label="Consumo confirmado" value={`${formatNumber(data.consumedInput, 0)} kg`} note="Com vínculo direto ao lote" tone="blue" />
      <MetricCard icon={BarChart3} label="Custo apurado" value={formatCurrency(data.realizedCosts)} note="Somente realizado e documentado" tone="violet" />
      <MetricCard icon={ShieldCheck} label="Atenções de dados" value={formatNumber(data.toConfirm + data.openDiscrepancies + data.candidateLinks)} note={`${data.openDiscrepancies} divergências abertas`} tone="amber" />
    </section>
    <section className="dashboard-grid">
      <div className="panel panel-wide"><div className="panel-header"><div><span className="eyebrow">Operação agora</span><h2>Lotes em andamento</h2></div><Link href="/livestock" className="text-link">Ver pecuária <ArrowUpRight size={15} /></Link></div>{data.activeLotRows.length ? <div className="table-wrap"><table><thead><tr><th>Lote</th><th>Unidade</th><th>Regime</th><th>Cabeças</th><th>Confiança</th></tr></thead><tbody>{data.activeLotRows.map((row: any) => <tr key={row.lot.id}><td><Link href={`/livestock/${row.lot.id}`} className="table-link"><b>{row.lot.lotCode}</b></Link><small>{row.lot.notes ?? "Sem nota operacional"}</small></td><td>{row.unit.name}</td><td>{statusLabel(row.lot.regime)}</td><td>{formatNumber(row.lot.headCount)}</td><td><StatusPill value={row.lot.dataStatus} /></td></tr>)}</tbody></table></div> : <EmptyState icon={Tractor} title="Nenhum lote ativo" description="Crie um lote operacional para acompanhar o ciclo aqui." />}</div>
      <div className="panel panel-attention"><div className="panel-header"><div><span className="eyebrow">Governança</span><h2>Antes de decidir</h2></div><Link href="/data-control" className="icon-link"><ArrowUpRight size={16} /></Link></div><div className="attention-list"><AttentionItem icon={AlertTriangle} label="A confirmar" value={data.toConfirm} color="amber" href="/data-control" /><AttentionItem icon={FileText} label="Documentos pendentes" value={data.pendingDocuments} color="blue" href="/data-control" /><AttentionItem icon={Activity} label="Alertas de qualidade" value={data.qualityAlerts} color="red" href="/data-control" /><AttentionItem icon={Users} label="Vínculos candidatos" value={data.candidateLinks} color="violet" href="/data-control" /></div></div>
    </section>
    <section className="panel recent-panel"><div className="panel-header"><div><span className="eyebrow">Trilha viva</span><h2>Atividade recente</h2></div><Link href="/audit" className="text-link">Abrir histórico <ArrowUpRight size={15} /></Link></div><div className="activity-list">{data.recent.length ? data.recent.map((event: any) => <div className="activity-row" key={event.id}><span className="activity-line" /><div className="activity-icon"><FileClock size={16} /></div><div className="activity-copy"><b>{event.action === "seeded" ? "Base demonstrativa preparada" : event.action}</b><span>{event.entityType} · alteração registrada</span></div><time>{new Date(event.createdAt).toLocaleDateString("pt-BR")}</time></div>) : <EmptyState icon={FileClock} title="Ainda sem atividade" description="As mudanças auditáveis aparecerão aqui." />}</div></section>
  </>;
}

function AttentionItem({ icon: Icon, label, value, color, href }: { icon: typeof AlertTriangle; label: string; value: number; color: string; href: string }) {
  return <Link href={href} className="attention-item"><span className={`attention-icon ${color}`}><Icon size={16} /></span><span>{label}</span><b>{formatNumber(value)}</b><ChevronRight size={15} /></Link>;
}

function LivestockView() {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const lots = trpc.livestock.list.useQuery({ search: search || undefined });
  const units = trpc.core.units.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.livestock.create.useMutation({ onSuccess: () => { setShowNew(false); utils.livestock.list.invalidate(); utils.dashboard.summary.invalidate(); } });
  const [form, setForm] = useState<{ businessUnitId: string; lotCode: string; regime: "pasture" | "semi_intensive" | "feedlot"; headCount: number; entryDate: string; expectedExitDate: string; notes: string }>({ businessUnitId: "", lotCode: "", regime: "feedlot", headCount: 0, entryDate: "", expectedExitDate: "", notes: "" });
  const submit = (event: React.FormEvent) => { event.preventDefault(); create.mutate({ ...form, businessUnitId: form.businessUnitId || units.data?.[0]?.id || "", headCount: Number(form.headCount), entryDate: form.entryDate || undefined, expectedExitDate: form.expectedExitDate || undefined }); };
  return <>
    <section className="toolbar"><div className="search-field"><Search size={16} /><input placeholder="Buscar lote por código" value={search} onChange={e => setSearch(e.target.value)} /></div><div className="toolbar-actions"><button className="secondary-button"><SlidersHorizontal size={15} /> Filtros</button><button className="primary-button compact" onClick={() => setShowNew(true)}><Plus size={16} /> Novo lote</button></div></section>
    {showNew && <div className="modal-backdrop"><form className="modal-card" onSubmit={submit}><div className="modal-header"><div><span className="eyebrow">Novo registro</span><h2>Criar lote operacional</h2></div><button type="button" className="icon-button" onClick={() => setShowNew(false)}><X size={17} /></button></div><div className="form-grid"><label>Código do lote<input required value={form.lotCode} onChange={e => setForm({ ...form, lotCode: e.target.value })} placeholder="Ex.: L-026-C" /></label><label>Unidade<select required value={form.businessUnitId || units.data?.[0]?.id || ""} onChange={e => setForm({ ...form, businessUnitId: e.target.value })}>{units.data?.map((unit: any) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label>Regime<select value={form.regime} onChange={e => setForm({ ...form, regime: e.target.value as typeof form.regime })}><option value="feedlot">Confinado</option><option value="semi_intensive">Semi-intensivo</option><option value="pasture">Pasto</option></select></label><label>Cabeças<input required type="number" min="0" value={form.headCount} onChange={e => setForm({ ...form, headCount: Number(e.target.value) })} /></label><label>Data de entrada<input type="date" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} /></label><label>Saída prevista<input type="date" value={form.expectedExitDate} onChange={e => setForm({ ...form, expectedExitDate: e.target.value })} /></label></div><label>Nota de contexto<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="O que a operação precisa lembrar sobre este lote?" /></label><div className="form-footnote"><ShieldCheck size={15} /> O lote nasce como “a confirmar” até receber evidência suficiente.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="primary-button" disabled={create.isPending}>Salvar lote <ArrowUpRight size={15} /></button></div></form></div>}
    <section className="panel table-panel"><div className="panel-header"><div><span className="eyebrow">Ciclo de produção</span><h2>{lots.data?.length ?? 0} lotes encontrados</h2></div><span className="panel-meta">Atualizado agora</span></div>{lots.isLoading ? <LoadingPanel /> : lots.data?.length ? <div className="table-wrap"><table><thead><tr><th>Lote</th><th>Unidade</th><th>Regime</th><th>Cabeças</th><th>Entrada</th><th>Estado</th><th></th></tr></thead><tbody>{lots.data.map((row: any) => <tr key={row.lot.id}><td><Link href={`/livestock/${row.lot.id}`} className="table-link"><b>{row.lot.lotCode}</b></Link><small>{row.lot.notes ?? "Sem observação"}</small></td><td>{row.unit.name}</td><td>{statusLabel(row.lot.regime)}</td><td>{formatNumber(row.lot.headCount)}</td><td>{row.lot.entryDate ? new Date(`${row.lot.entryDate}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</td><td><StatusPill value={row.lot.dataStatus} /></td><td><Link href={`/livestock/${row.lot.id}`} className="row-action"><ChevronRight size={16} /></Link></td></tr>)}</tbody></table></div> : <EmptyState icon={Tractor} title="Nenhum lote encontrado" description="Ajuste a busca ou crie o primeiro lote operacional." />}</section>
  </>;
}

function LivestockDetailView({ id }: { id: string }) {
  const detail = trpc.livestock.detail.useQuery({ id });
  const inputs = trpc.livestock.inputs.useQuery();
  const utils = trpc.useUtils();
  const [entryMode, setEntryMode] = useState<"event" | "input" | "movement" | "economic" | null>(null);
  const [eventForm, setEventForm] = useState<{ eventType: "entry" | "weighing" | "handling" | "transfer" | "exit" | "note"; eventDate: string; quantity: string; unit: string; sourceReference: string; notes: string }>({ eventType: "weighing", eventDate: new Date().toISOString().slice(0, 10), quantity: "", unit: "kg/cab", sourceReference: "", notes: "" });
  const [inputForm, setInputForm] = useState({ sku: "", name: "", category: "feed" as "feed" | "supplement" | "medicine" | "fuel" | "other", unit: "kg" });
  const [movementForm, setMovementForm] = useState({ inputId: "", movementType: "consumption" as "inbound" | "consumption" | "transfer" | "adjustment", movementDate: new Date().toISOString().slice(0, 10), quantity: "", unitCost: "", sourceReference: "", notes: "" });
  const [economicForm, setEconomicForm] = useState({ entryType: "cost" as "cost" | "revenue" | "adjustment", entryDate: new Date().toISOString().slice(0, 10), amount: "", sourceReference: "", notes: "" });
  const refreshOperationalData = () => {
    utils.livestock.detail.invalidate({ id });
    utils.livestock.list.invalidate();
    utils.livestock.inputs.invalidate();
    utils.dashboard.summary.invalidate();
    utils.dataControl.overview.invalidate();
  };
  const addEvent = trpc.livestock.addEvent.useMutation({ onSuccess: () => { setEntryMode(null); refreshOperationalData(); } });
  const createInput = trpc.livestock.createInput.useMutation({ onSuccess: () => { setEntryMode(null); refreshOperationalData(); } });
  const addMovement = trpc.livestock.addMovement.useMutation({ onSuccess: () => { setEntryMode(null); refreshOperationalData(); } });
  const addEconomicEntry = trpc.livestock.addEconomicEntry.useMutation({ onSuccess: () => { setEntryMode(null); refreshOperationalData(); } });
  if (detail.isLoading) return <LoadingPanel />;
  if (detail.isError || !detail.data) return <ErrorPanel message="Não foi possível abrir a ficha deste lote." />;
  const { lot, unit, events, movements, entries, records } = detail.data;
  return <>
    <div className="detail-back"><Link href="/livestock" className="text-link"><ChevronRight size={15} className="back-chevron" /> Voltar para lotes</Link></div>
    <section className="detail-hero"><div><span className="eyebrow">Ficha operacional · {unit.name}</span><h2>{lot.lotCode}</h2><p>{lot.notes ?? "Sem nota operacional registrada."}</p></div><div className="detail-hero-meta"><StatusPill value={lot.dataStatus} /><strong>{formatNumber(lot.headCount)}<small> cabeças</small></strong><span>{statusLabel(lot.regime)}</span></div></section>
    <section className="toolbar detail-toolbar"><div><span className="eyebrow">Apontamento operacional</span><p>Todo lançamento nasce rastreável e fica pendente até a confirmação aplicável.</p></div><div className="toolbar-actions"><button className="secondary-button" onClick={() => setEntryMode("event")}><Activity size={15} /> Evento</button><button className="secondary-button" onClick={() => setEntryMode("input")}><Plus size={15} /> Insumo</button><button className="secondary-button" onClick={() => setEntryMode("movement")}><Boxes size={15} /> Movimento</button><button className="primary-button compact" onClick={() => setEntryMode("economic")}><BarChart3 size={15} /> Custo / receita</button></div></section>
    {entryMode === "event" && <div className="modal-backdrop"><form className="modal-card" onSubmit={event => { event.preventDefault(); addEvent.mutate({ lotId: id, eventType: eventForm.eventType, eventDate: eventForm.eventDate, quantity: eventForm.quantity ? Number(eventForm.quantity) : undefined, unit: eventForm.unit || undefined, sourceReference: eventForm.sourceReference || undefined, notes: eventForm.notes || undefined }); }}><div className="modal-header"><div><span className="eyebrow">Linha do ciclo</span><h2>Registrar evento do lote</h2></div><button type="button" className="icon-button" onClick={() => setEntryMode(null)}><X size={17} /></button></div><div className="form-grid"><label>Tipo<select value={eventForm.eventType} onChange={e => setEventForm({ ...eventForm, eventType: e.target.value as typeof eventForm.eventType })}><option value="entry">Entrada</option><option value="weighing">Pesagem</option><option value="handling">Manejo</option><option value="transfer">Transferência</option><option value="exit">Saída</option><option value="note">Nota operacional</option></select></label><label>Data<input type="date" required value={eventForm.eventDate} onChange={e => setEventForm({ ...eventForm, eventDate: e.target.value })} /></label><label>Quantidade<input type="number" step="0.0001" value={eventForm.quantity} onChange={e => setEventForm({ ...eventForm, quantity: e.target.value })} /></label><label>Unidade<input value={eventForm.unit} onChange={e => setEventForm({ ...eventForm, unit: e.target.value })} placeholder="kg/cab, cabeças..." /></label></div><label>Referência da origem<input value={eventForm.sourceReference} onChange={e => setEventForm({ ...eventForm, sourceReference: e.target.value })} placeholder="Romaneio, pesagem, caderno de campo..." /></label><label>Observação<textarea value={eventForm.notes} onChange={e => setEventForm({ ...eventForm, notes: e.target.value })} /></label><div className="form-footnote"><ShieldCheck size={15} /> O evento entra como “a confirmar”; evidência e qualidade permanecem separadas.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEntryMode(null)}>Cancelar</button><button className="primary-button" disabled={addEvent.isPending}>Registrar evento <ArrowUpRight size={15} /></button></div></form></div>}
    {entryMode === "input" && <div className="modal-backdrop"><form className="modal-card" onSubmit={event => { event.preventDefault(); createInput.mutate(inputForm); }}><div className="modal-header"><div><span className="eyebrow">Catálogo operacional</span><h2>Cadastrar insumo</h2></div><button type="button" className="icon-button" onClick={() => setEntryMode(null)}><X size={17} /></button></div><div className="form-grid"><label>SKU<input required value={inputForm.sku} onChange={e => setInputForm({ ...inputForm, sku: e.target.value })} placeholder="INS-RAC-002" /></label><label>Nome<input required value={inputForm.name} onChange={e => setInputForm({ ...inputForm, name: e.target.value })} placeholder="Ração, medicamento..." /></label><label>Categoria<select value={inputForm.category} onChange={e => setInputForm({ ...inputForm, category: e.target.value as typeof inputForm.category })}><option value="feed">Ração</option><option value="supplement">Suplemento</option><option value="medicine">Medicamento</option><option value="fuel">Combustível</option><option value="other">Outro</option></select></label><label>Unidade<input required value={inputForm.unit} onChange={e => setInputForm({ ...inputForm, unit: e.target.value })} placeholder="kg, L, dose" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEntryMode(null)}>Cancelar</button><button className="primary-button" disabled={createInput.isPending}>Salvar insumo <ArrowUpRight size={15} /></button></div></form></div>}
    {entryMode === "movement" && <div className="modal-backdrop"><form className="modal-card" onSubmit={event => { event.preventDefault(); addMovement.mutate({ inputId: movementForm.inputId || inputs.data?.[0]?.id || "", lotId: id, movementType: movementForm.movementType, movementDate: movementForm.movementDate, quantity: Number(movementForm.quantity), unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined, sourceReference: movementForm.sourceReference || undefined, notes: movementForm.notes || undefined }); }}><div className="modal-header"><div><span className="eyebrow">Consumo e estoque</span><h2>Registrar movimentação</h2></div><button type="button" className="icon-button" onClick={() => setEntryMode(null)}><X size={17} /></button></div>{inputs.data?.length ? <><div className="form-grid"><label>Insumo<select required value={movementForm.inputId || inputs.data?.[0]?.id || ""} onChange={e => setMovementForm({ ...movementForm, inputId: e.target.value })}>{inputs.data?.map((input: any) => <option key={input.id} value={input.id}>{input.name} · {input.unit}</option>)}</select></label><label>Tipo<select value={movementForm.movementType} onChange={e => setMovementForm({ ...movementForm, movementType: e.target.value as typeof movementForm.movementType })}><option value="consumption">Consumo</option><option value="inbound">Entrada</option><option value="transfer">Transferência</option><option value="adjustment">Ajuste</option></select></label><label>Data<input type="date" required value={movementForm.movementDate} onChange={e => setMovementForm({ ...movementForm, movementDate: e.target.value })} /></label><label>Quantidade<input required min="0.0001" type="number" step="0.0001" value={movementForm.quantity} onChange={e => setMovementForm({ ...movementForm, quantity: e.target.value })} /></label><label>Custo unitário (R$)<input min="0" type="number" step="0.0001" value={movementForm.unitCost} onChange={e => setMovementForm({ ...movementForm, unitCost: e.target.value })} /></label><label>Origem<input value={movementForm.sourceReference} onChange={e => setMovementForm({ ...movementForm, sourceReference: e.target.value })} placeholder="Boletim, NF-e, planilha..." /></label></div><label>Observação<textarea value={movementForm.notes} onChange={e => setMovementForm({ ...movementForm, notes: e.target.value })} /></label><div className="form-footnote"><ShieldCheck size={15} /> O vínculo com este lote entra como candidato e só afeta indicadores após confirmação.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEntryMode(null)}>Cancelar</button><button className="primary-button" disabled={addMovement.isPending}>Registrar movimento <ArrowUpRight size={15} /></button></div></> : <EmptyState icon={Boxes} title="Cadastre um insumo antes" description="Use “Insumo” para criar o primeiro item do estoque." />}</form></div>}
    {entryMode === "economic" && <div className="modal-backdrop"><form className="modal-card" onSubmit={event => { event.preventDefault(); addEconomicEntry.mutate({ businessUnitId: lot.businessUnitId, lotId: id, entryType: economicForm.entryType, entryDate: economicForm.entryDate, amount: Number(economicForm.amount), sourceReference: economicForm.sourceReference || undefined, notes: economicForm.notes || undefined }); }}><div className="modal-header"><div><span className="eyebrow">Controladoria operacional</span><h2>Registrar custo, receita ou ajuste</h2></div><button type="button" className="icon-button" onClick={() => setEntryMode(null)}><X size={17} /></button></div><div className="form-grid"><label>Tipo<select value={economicForm.entryType} onChange={e => setEconomicForm({ ...economicForm, entryType: e.target.value as typeof economicForm.entryType })}><option value="cost">Custo</option><option value="revenue">Receita</option><option value="adjustment">Ajuste</option></select></label><label>Data<input type="date" required value={economicForm.entryDate} onChange={e => setEconomicForm({ ...economicForm, entryDate: e.target.value })} /></label><label>Valor (R$)<input required min="0.01" type="number" step="0.01" value={economicForm.amount} onChange={e => setEconomicForm({ ...economicForm, amount: e.target.value })} /></label><label>Referência da origem<input value={economicForm.sourceReference} onChange={e => setEconomicForm({ ...economicForm, sourceReference: e.target.value })} placeholder="NF-e, extrato, ERP..." /></label></div><label>Observação<textarea value={economicForm.notes} onChange={e => setEconomicForm({ ...economicForm, notes: e.target.value })} /></label><div className="form-footnote"><ShieldCheck size={15} /> Lançamentos manuais entram “a confirmar” e não alteram o custo apurado até reconciliação.</div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEntryMode(null)}>Cancelar</button><button className="primary-button" disabled={addEconomicEntry.isPending}>Registrar lançamento <ArrowUpRight size={15} /></button></div></form></div>}
    <section className="metric-grid detail-metrics"><MetricCard icon={Tractor} label="Entrada" value={lot.entryDate ? new Date(`${lot.entryDate}T12:00:00`).toLocaleDateString("pt-BR") : "—"} note="Data de entrada registrada" /><MetricCard icon={Activity} label="Eventos" value={formatNumber(events.length)} note="Pesagens e manejos" tone="blue" /><MetricCard icon={Boxes} label="Movimentos" value={formatNumber(movements.length)} note="Insumos vinculados" tone="violet" /><MetricCard icon={ShieldCheck} label="Dados" value={formatNumber(records.length)} note="Registros de evidência" tone="amber" /></section>
    <div className="detail-grid"><section className="panel"><div className="panel-header"><div><span className="eyebrow">Linha do ciclo</span><h2>Eventos do lote</h2></div><span className="panel-meta">{events.length} registros</span></div>{events.length ? <div className="timeline-list">{events.map((event: any) => <div className="timeline-row" key={event.id}><div className="timeline-marker" /><div className="timeline-copy"><div><b>{statusLabel(event.eventType)}</b><StatusPill value={event.status} /></div><span>{event.eventDate} · {event.quantity ?? "—"} {event.unit ?? ""}</span><small>{event.sourceReference ?? "Sem referência de origem"}</small></div></div>)}</div> : <EmptyState icon={Activity} title="Sem eventos registrados" description="A entrada e as pesagens aparecerão nesta linha do tempo." />}</section><section className="panel"><div className="panel-header"><div><span className="eyebrow">Cadeia de evidência</span><h2>Dados relevantes</h2></div><ShieldCheck size={18} /></div>{records.length ? records.map((record: any) => <div className="evidence-row" key={record.id}><div><b>{record.label}</b><span>{record.value} {record.unit ?? ""}</span></div><StatusPill value={record.status} /><small>{record.sourceReference ?? "Sem fonte"}</small></div>) : <EmptyState icon={Database} title="Sem dados adicionais" description="Registros estruturados vinculados ao lote aparecerão aqui." />}</section></div>
    <section className="panel"><div className="panel-header"><div><span className="eyebrow">Insumos e economia</span><h2>O que compõe o resultado</h2></div><span className="panel-meta">{formatNumber(entries.length)} lançamentos econômicos</span></div>{movements.length ? <div className="table-wrap"><table><thead><tr><th>Insumo</th><th>Movimento</th><th>Quantidade</th><th>Vínculo</th><th>Origem</th></tr></thead><tbody>{movements.map((row: any) => <tr key={row.movement.id}><td><b>{row.input.name}</b><small>{row.input.sku}</small></td><td>{statusLabel(row.movement.movementType)}</td><td>{row.movement.quantity} {row.input.unit}</td><td><StatusPill value={row.movement.linkStatus} /></td><td>{row.movement.sourceReference ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState icon={Boxes} title="Nenhum movimento de insumo" description="Consumos e ajustes do lote serão mostrados quando registrados." />}</section>
  </>;
}

function CoreView() {
  const units = trpc.core.units.useQuery();
  const domains = trpc.core.domains.useQuery();
  const activities = trpc.core.activities.useQuery();
  const utils = trpc.useUtils();
  const create = trpc.core.createUnit.useMutation({ onSuccess: () => { utils.core.units.invalidate(); setName(""); setCode(""); } });
  const [name, setName] = useState(""); const [code, setCode] = useState("");
  return <>
    <div className="split-grid"><section className="panel"><div className="panel-header"><div><span className="eyebrow">Cadastro e configuração</span><h2>Unidades de negócio</h2></div><span className="count-badge">{units.data?.length ?? 0}</span></div><div className="inline-create"><input placeholder="Nome da nova unidade" value={name} onChange={e => setName(e.target.value)} /><input className="code-input" placeholder="Código" value={code} onChange={e => setCode(e.target.value)} /><button className="primary-button compact" disabled={!name || !code || create.isPending} onClick={() => create.mutate({ name, code, unitType: "operation" })}><Plus size={15} /> Adicionar</button></div><div className="unit-list">{units.data?.map((unit: any) => <div className="unit-row" key={unit.id}><div className="unit-symbol">{unit.name.slice(0, 1)}</div><div><b>{unit.name}</b><span>{unit.code} · {statusLabel(unit.unitType)}</span></div><StatusPill value={unit.status === "active" ? "verified" : "to_confirm"} /></div>)}</div></section><section className="panel"><div className="panel-header"><div><span className="eyebrow">Domínios ativos</span><h2>Como o grupo opera</h2></div><Layers3 size={18} className="panel-header-icon" /></div><div className="domain-list">{domains.data?.map((domain: any) => <div className="domain-row" key={domain.id}><span className="domain-icon"><Tractor size={17} /></span><div><b>{domain.name}</b><span>{domain.description}</span></div><span className="domain-version">v{domain.configVersion}</span></div>)}</div><div className="subsection"><span className="eyebrow">Atividades habilitadas</span>{activities.data?.map((activity: any) => <div className="activity-chip" key={activity.id}><CircleCheck size={14} />{activity.name}<span>v{activity.configVersion}</span></div>)}</div></section></div>
    <section className="info-strip"><div className="info-strip-icon"><Sparkles size={18} /></div><div><b>Arquitetura preparada para o próximo domínio.</b><p>Uma nova empresa pode executar uma atividade existente por cadastro. Um negócio novo entra com tabelas, regras e telas próprias — sem apagar o que já existe.</p></div><Link href="/settings" className="text-link">Ver configuração <ArrowUpRight size={15} /></Link></section>
  </>;
}

function DataControlView() {
  const overview = trpc.dataControl.overview.useQuery();
  const utils = trpc.useUtils();
  const resolve = trpc.dataControl.resolveDiscrepancy.useMutation({ onSuccess: () => { utils.dataControl.overview.invalidate(); utils.dashboard.summary.invalidate(); } });
  const confirm = trpc.dataControl.confirmLink.useMutation({ onSuccess: () => { utils.dataControl.overview.invalidate(); utils.dashboard.summary.invalidate(); } });
  if (overview.isLoading) return <LoadingPanel />;
  const data = overview.data;
  return <>
    <section className="control-summary"><div><span className="eyebrow">Fila de decisão</span><h2>{(data?.records.length ?? 0) + (data?.discrepancies.length ?? 0) + (data?.links.length ?? 0)} itens pedem uma ação</h2><p>O Bonança não limpa divergências em silêncio. Cada decisão guarda evidência, justificativa e responsável.</p></div><div className="confidence-legend"><span><i className="legend-dot green" /> Confirmado</span><span><i className="legend-dot amber" /> A confirmar</span><span><i className="legend-dot red" /> Divergência</span></div></section>
    <div className="control-grid"><section className="panel"><div className="panel-header"><div><span className="eyebrow">Leituras</span><h2>Dados a confirmar</h2></div><span className="count-badge amber-bg">{data?.records.length ?? 0}</span></div>{data?.records.length ? data.records.map((record: any) => <div className="control-row" key={record.id}><div className="control-row-icon amber"><Database size={16} /></div><div className="control-row-copy"><b>{record.label}</b><span>{record.value} {record.unit ?? ""} · {record.sourceReference ?? "Sem referência"}</span><small>{record.entityType} · qualidade {record.quality}</small></div><StatusPill value={record.status} /></div>) : <EmptyState icon={Database} title="Nenhuma leitura pendente" description="As novas entradas aparecerão nesta fila." />}</section><section className="panel"><div className="panel-header"><div><span className="eyebrow">Conflitos preservados</span><h2>Divergências abertas</h2></div><span className="count-badge red-bg">{data?.discrepancies.length ?? 0}</span></div>{data?.discrepancies.length ? data.discrepancies.map((item: any) => <div className="control-row actionable" key={item.id}><div className="control-row-icon red"><AlertTriangle size={16} /></div><div className="control-row-copy"><b>{item.title}</b><span>Original: {item.originalReading}</span><small>Proposta: {item.proposedCorrection ?? "Ainda não proposta"}</small><button className="micro-action" onClick={() => { const note = window.prompt("Justificativa da resolução", item.justification ?? ""); if (note) resolve.mutate({ id: item.id, status: "resolved", justification: note, resolutionNote: "Resolvido no painel de governança" }); }}>Resolver com justificativa</button></div></div>) : <EmptyState icon={CircleCheck} title="Nenhuma divergência aberta" description="Bom sinal: a fila de conflitos está limpa." />}</section><section className="panel"><div className="panel-header"><div><span className="eyebrow">Confirmação direta</span><h2>Vínculos candidatos</h2></div><span className="count-badge violet-bg">{data?.links.length ?? 0}</span></div>{data?.links.length ? data.links.map((item: any) => <div className="control-row actionable" key={item.id}><div className="control-row-icon violet"><Boxes size={16} /></div><div className="control-row-copy"><b>{item.linkType}</b><span>{item.fromType} → {item.toType}</span><small>{item.evidenceNote ?? "Sem evidência registrada"}</small><button className="micro-action" onClick={() => { const note = window.prompt("Qual é a evidência direta deste vínculo?"); if (note) confirm.mutate({ id: item.id, evidenceNote: note }); }}>Confirmar vínculo</button></div></div>) : <EmptyState icon={CircleCheck} title="Sem vínculos candidatos" description="Coincidências futuras ficarão pendentes até confirmação." />}</section></div>
  </>;
}

function CatalogView() {
  const fields = trpc.catalog.fields.useQuery(); const kpis = trpc.catalog.kpis.useQuery(); const quality = trpc.catalog.quality.useQuery();
  return <><section className="catalog-hero"><div className="catalog-hero-icon"><BookOpen size={20} /></div><div><span className="eyebrow">Uma memória viva do modelo</span><h2>O número só é útil quando o significado permanece.</h2><p>O catálogo evita que “peso de entrada” tenha duas definições diferentes daqui a dois anos. Cada campo carrega dono, origem esperada e a linha até a decisão.</p></div></section><div className="catalog-grid"><section className="panel"><div className="panel-header"><div><span className="eyebrow">Dicionário de dados</span><h2>Campos com linhagem</h2></div><span className="panel-meta">{fields.data?.length ?? 0} campos</span></div>{fields.data?.map((field: any) => <div className="catalog-row" key={field.id}><div><b>{field.label}</b><span className="mono">{field.fieldKey}</span></div><p>{field.definition}</p><div className="lineage"><span>{field.expectedSource}</span><ChevronRight size={13} /><span>{field.lineage}</span></div><div className="catalog-owner"><Users size={13} /> {field.owner}</div></div>)}</section><div className="catalog-side"><section className="panel"><div className="panel-header"><div><span className="eyebrow">Camada semântica</span><h2>KPIs oficiais</h2></div><BarChart3 size={18} /></div>{kpis.data?.map((kpi: any) => <div className="kpi-row" key={kpi.id}><div className="kpi-top"><b>{kpi.name}</b><span>v{kpi.version}</span></div><span>{kpi.definition}</span><code>{kpi.formula}</code><small>{kpi.unit}</small></div>)}</section><section className="panel"><div className="panel-header"><div><span className="eyebrow">Automação</span><h2>Regras de qualidade</h2></div><ClipboardCheck size={18} /></div>{quality.data?.map((item: any) => <div className="quality-row" key={item.rule.id}><div><b>{item.rule.name}</b><span>{item.rule.description}</span></div><StatusPill value={item.rule.severity === "high" ? "open" : "candidate"} tone={item.rule.severity === "high" ? "danger" : "warn"} /><small>{Number(item.openAlerts)} alerta(s) aberto(s)</small></div>)}</section></div></div></>;
}

function AuditView() {
  const audit = trpc.audit.list.useQuery();
  return <section className="panel audit-panel"><div className="panel-header"><div><span className="eyebrow">Histórico imutável</span><h2>O que mudou, quando e por quem</h2></div><span className="panel-meta">Últimos 100 eventos</span></div>{audit.isLoading ? <LoadingPanel /> : audit.data?.length ? <div className="audit-list">{audit.data.map((row: any) => <div className="audit-row" key={row.event.id}><div className="audit-badge"><FileClock size={15} /></div><div className="audit-main"><b>{row.event.action}</b><span>{row.event.entityType} · {row.event.entityId.slice(0, 12)}…</span>{row.event.reason && <small>{row.event.reason}</small>}</div><div className="audit-user"><span>{row.user?.name ?? "Sistema"}</span><time>{new Date(row.event.createdAt).toLocaleString("pt-BR")}</time></div></div>)}</div> : <EmptyState icon={FileClock} title="Nenhuma alteração ainda" description="A trilha de auditoria começa na primeira decisão operacional." />}</section>;
}

function SettingsView() {
  const members = trpc.organization.members.useQuery();
  return <div className="settings-grid"><section className="panel settings-card"><div className="panel-header"><div><span className="eyebrow">Acesso</span><h2>Pessoas no workspace</h2></div><Users size={18} /></div>{members.data?.map((row: any) => <div className="member-row" key={row.member.id}><div className="user-avatar small">{(row.user.name ?? "A").slice(0, 1)}</div><div><b>{row.user.name}</b><span>{row.user.email}</span></div><StatusPill value={row.member.role === "owner" ? "verified" : "active"} /><span className="role-label">{row.member.role}</span></div>)}</section><section className="panel settings-card"><div className="panel-header"><div><span className="eyebrow">Arquitetura</span><h2>Módulos habilitados</h2></div><Settings2 size={18} /></div><div className="setting-toggle"><div className="setting-toggle-icon green"><Tractor size={16} /></div><div><b>Pecuária e confinamento</b><span>Operação, insumos e custos</span></div><span className="toggle-on">Ativo</span></div><div className="setting-toggle"><div className="setting-toggle-icon blue"><BuildingIcon /></div><div><b>Imobiliário</b><span>Pronto para próxima fase</span></div><span className="toggle-off">Planejado</span></div><div className="setting-toggle"><div className="setting-toggle-icon violet"><Database size={16} /></div><div><b>Catálogo e linhagem</b><span>Campos e KPIs oficiais</span></div><span className="toggle-on">Ativo</span></div></section></div>;
}

function CalculatorView() {
  const [businesses, setBusinesses] = useState(1); const [units, setUnits] = useState(3); const [users, setUsers] = useState(8); const [model, setModel] = useState("hybrid");
  const modelFactor = model === "market" ? 0.72 : model === "custom" ? 1.65 : 1;
  const implementation = Math.round((26000 + (businesses - 1) * 24000 + units * 1700 + users * 380) * modelFactor);
  const monthly = Math.round((3900 + businesses * 2100 + units * 230 + users * 75) * (model === "market" ? 0.86 : model === "custom" ? 1.28 : 1));
  const threeYears = implementation + monthly * 36;
  return <><section className="calculator-disclaimer"><Sparkles size={18} /><div><b>Uma bússola, não um orçamento.</b><p>Faixas ilustrativas para conversar sobre ordem de grandeza. Substitua pelos números de fornecedores reais antes de tomar uma decisão.</p></div></section><div className="calculator-grid"><section className="panel calculator-controls"><div className="panel-header"><div><span className="eyebrow">Variáveis de crescimento</span><h2>O que muda o custo</h2></div><SlidersHorizontal size={18} /></div><RangeControl label="Negócios / domínios" value={businesses} min={1} max={6} onChange={setBusinesses} hint="Negócios diferentes são a maior alavanca." /><RangeControl label="Unidades operacionais" value={units} min={1} max={20} onChange={setUnits} hint="Entra principalmente por cadastro." /><RangeControl label="Usuários" value={users} min={2} max={60} onChange={setUsers} hint="Cresce de forma mais linear." /><div className="model-choice"><span className="eyebrow">Estratégia de tecnologia</span>{[{ value: "market", label: "Ferramenta de mercado", note: "Menor implantação" }, { value: "hybrid", label: "Híbrido", note: "Equilíbrio" }, { value: "custom", label: "Sob medida", note: "Maior controle" }].map((item: any) => <button className={model === item.value ? "selected" : ""} key={item.value} onClick={() => setModel(item.value)}><span className="radio-dot" /><span><b>{item.label}</b><small>{item.note}</small></span></button>)}</div></section><section className="calculator-result"><span className="eyebrow">Projeção ilustrativa</span><h2>O custo de crescer com clareza</h2><div className="result-total"><small>Total estimado em 3 anos</small><strong>{formatCurrency(threeYears)}</strong><span>{businesses} domínio(s) · {units} unidade(s) · {users} usuário(s)</span></div><div className="result-breakdown"><div><span>Implantação</span><b>{formatCurrency(implementation)}</b></div><div><span>Manutenção mensal</span><b>{formatCurrency(monthly)}</b></div><div><span>Manutenção em 3 anos</span><b>{formatCurrency(monthly * 36)}</b></div></div><div className="result-note"><CircleCheck size={15} /><span>Unidades e usuários adicionam pouco quando o núcleo já existe. O principal salto vem de um novo negócio.</span></div></section></div></>;
}

function RangeControl({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void; hint: string }) {
  return <label className="range-control"><div><b>{label}</b><strong>{value}</strong></div><input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} /><span>{hint}</span></label>;
}

function LoadingPanel() { return <div className="loading-panel"><span className="spinner" /> Carregando dados do workspace…</div>; }
function ErrorPanel({ message }: { message: string }) { return <div className="error-panel"><AlertTriangle size={17} />{message}</div>; }
function BuildingIcon() { return <Boxes size={16} />; }

export default function Home() {
  const [location] = useLocation();
  const [detailMatch, detailParams] = useRoute("/livestock/:id");
  const basePath = location.startsWith("/livestock/") ? "/livestock" : location;
  const content = useMemo(() => {
    if (basePath === "/livestock") return <LivestockView />;
    if (basePath === "/operations") return <OperationsView />;
    if (basePath === "/imports") return <ImportsView />;
    if (basePath === "/core") return <CoreView />;
    if (basePath === "/data-control") return <DataControlView />;
    if (basePath === "/catalog") return <CatalogView />;
    if (basePath === "/audit") return <AuditView />;
    if (basePath === "/settings") return <SettingsView />;
    if (basePath === "/growth-calculator") return <CalculatorView />;
    return <DashboardView />;
  }, [basePath]);
  return <Shell currentPath={basePath}>{detailMatch && detailParams?.id ? <LivestockDetailView id={detailParams.id} /> : content}</Shell>;
}
