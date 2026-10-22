import { useEffect, useState } from "react";
import { AlertTriangle, Ban, Building2, CheckCircle2, CreditCard, LockKeyhole, Play, Search, ShieldCheck, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";

const planLabels: Record<string, string> = { trial: "Trial", starter: "Starter", growth: "Growth", enterprise: "Enterprise" };
const billingLabels: Record<string, string> = { trialing: "Em trial", active: "Ativo", past_due: "Em atraso", canceled: "Cancelado" };
const statusLabels: Record<string, string> = { active: "Ativa", suspended: "Suspensa", inactive: "Inativa" };
const featureLabels: Record<string, string> = { livestock: "Pecuária", imports: "Importação", operations: "Pesagem e alimentação", catalog: "Catálogo e KPIs", growth_calculator: "Calculadora de crescimento" };

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function roleLabel(value: string) {
  return ({ super_admin: "Super admin", support: "Suporte", billing: "Billing", security: "Segurança", readonly: "Somente leitura" } as Record<string, string>)[value] ?? value;
}

export default function SaasAdminView() {
  const me = trpc.auth.me.useQuery();
  const summary = trpc.saasAdmin.summary.useQuery();
  const organizations = trpc.saasAdmin.organizations.useQuery();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const detail = trpc.saasAdmin.detail.useQuery({ organizationId: activeId ?? "" }, { enabled: Boolean(activeId) });
  const utils = trpc.useUtils();
  const [reason, setReason] = useState("Revisão administrativa do ciclo de vida do tenant");
  const [plan, setPlan] = useState("trial");
  const [billingStatus, setBillingStatus] = useState("trialing");
  const [seatLimit, setSeatLimit] = useState(5);
  const [trialEndsAt, setTrialEndsAt] = useState("");
  const updateStatus = trpc.saasAdmin.updateStatus.useMutation({ onSuccess: () => { utils.saasAdmin.organizations.invalidate(); utils.saasAdmin.detail.invalidate(); utils.saasAdmin.summary.invalidate(); } });
  const updatePlan = trpc.saasAdmin.updatePlan.useMutation({ onSuccess: () => { utils.saasAdmin.organizations.invalidate(); utils.saasAdmin.detail.invalidate(); utils.saasAdmin.summary.invalidate(); } });
  const setFeature = trpc.saasAdmin.setFeature.useMutation({ onSuccess: () => utils.saasAdmin.detail.invalidate() });

  useEffect(() => {
    const organization = (detail.data as any)?.organization;
    if (!organization) return;
    setPlan(organization.plan);
    setBillingStatus(organization.billingStatus);
    setSeatLimit(organization.seatLimit);
    setTrialEndsAt(organization.trialEndsAt ? new Date(organization.trialEndsAt).toISOString().slice(0, 10) : "");
  }, [detail.data]);

  const platformRole = (me.data as any)?.platformRole ?? "none";
  if (platformRole === "none") return <section className="admin-denied"><LockKeyhole size={22} /><div><h2>Acesso reservado à plataforma</h2><p>Este console é separado da administração de cada organização. Solicite um papel global explícito ao responsável pelo SaaS.</p></div></section>;

  const organizationRows = ((organizations.data ?? []) as any[]).filter((row) => {
    const text = `${row.organization.name} ${row.organization.slug} ${row.organization.plan}`.toLowerCase();
    return text.includes(search.trim().toLowerCase());
  });
  const selected = (detail.data as any)?.organization;
  const activeMembers = ((detail.data as any)?.members ?? []).filter((row: any) => row.member.status === "active").length;
  const canStatus = ["super_admin", "support", "security"].includes(platformRole);
  const canBilling = ["super_admin", "billing"].includes(platformRole);

  return <>
    <section className="admin-hero"><div className="admin-hero-icon"><ShieldCheck size={21} /></div><div><span className="eyebrow">Console da plataforma</span><h2>Administração SaaS multitenant</h2><p>Opere ciclo de vida, acesso comercial e recursos dos tenants sem misturar privilégios de organização.</p></div><span className="admin-role-badge">{roleLabel(platformRole)}</span></section>
    {summary.isError ? <div className="error-panel"><AlertTriangle size={17} />Não foi possível carregar o resumo da plataforma.</div> : <section className="admin-metrics"><div><span><Building2 size={15} /> Organizações</span><strong>{summary.data?.totalOrganizations ?? 0}</strong><small>{summary.data?.activeOrganizations ?? 0} ativas</small></div><div><span><Users size={15} /> Membros ativos</span><strong>{summary.data?.activeMembers ?? 0}</strong><small>somados nos tenants</small></div><div><span><Ban size={15} /> Suspensas</span><strong>{summary.data?.suspendedOrganizations ?? 0}</strong><small>sessões revogadas ao suspender</small></div><div><span><CreditCard size={15} /> Em atenção</span><strong>{summary.data?.attentionOrganizations ?? 0}</strong><small>cobrança ou status</small></div></section>}
    <div className="admin-layout">
      <section className="panel admin-org-list"><div className="panel-header"><div><span className="eyebrow">Tenants</span><h2>Organizações da plataforma</h2></div><span className="panel-meta">até 100 mais recentes</span></div><div className="admin-search"><Search size={15} /><input placeholder="Buscar por nome, slug ou plano" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{organizations.isLoading ? <div className="loading-panel">Carregando tenants…</div> : organizationRows.length ? <div className="admin-organization-list">{organizationRows.map((row: any) => <button key={row.organization.id} className={`admin-organization-row ${activeId === row.organization.id ? "selected" : ""}`} onClick={() => setActiveId(row.organization.id)}><span className="admin-org-symbol">{row.organization.name.slice(0, 1).toUpperCase()}</span><span className="admin-org-copy"><b>{row.organization.name}</b><small>{row.organization.slug} · {row.activeMembers} membros</small></span><span className={`admin-status ${row.organization.status}`}>{statusLabels[row.organization.status] ?? row.organization.status}</span><span className="admin-plan">{planLabels[row.organization.plan] ?? row.organization.plan}</span></button>)}</div> : <div className="empty-state"><Building2 size={18} /><div><strong>Nenhuma organização encontrada</strong><p>Ajuste a busca para localizar outro tenant.</p></div></div>}</section>
      <section className="panel admin-detail"><div className="panel-header"><div><span className="eyebrow">Detalhe do tenant</span><h2>{selected?.name ?? "Selecione uma organização"}</h2></div>{selected && <span className={`admin-status ${selected.status}`}>{statusLabels[selected.status] ?? selected.status}</span>}</div>{!selected ? <div className="admin-empty-detail"><Building2 size={24} /><b>Escolha um tenant à esquerda</b><span>O detalhe mostra acesso, plano, recursos e trilha administrativa.</span></div> : <><div className="admin-detail-grid"><div><span>Slug</span><b>{selected.slug}</b></div><div><span>Criada em</span><b>{formatDate(selected.createdAt)}</b></div><div><span>Plano</span><b>{planLabels[selected.plan]}</b></div><div><span>Membros</span><b>{activeMembers} / {selected.seatLimit}</b></div><div><span>Cobrança</span><b>{billingLabels[selected.billingStatus]}</b></div><div><span>Trial até</span><b>{formatDate(selected.trialEndsAt)}</b></div></div><div className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">Ciclo de vida</span><h3>Status e proteção de sessão</h3></div><span className="admin-safety-note"><ShieldCheck size={14} /> sem apagar dados</span></div><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo obrigatório para qualquer ação administrativa" /><div className="admin-actions">{canStatus && selected.status !== "suspended" && <button className="danger-button" disabled={updateStatus.isPending || reason.trim().length < 10} onClick={() => updateStatus.mutate({ organizationId: selected.id, status: "suspended", reason })}><Ban size={14} /> Suspender tenant</button>}{canStatus && selected.status === "suspended" && <button className="primary-button compact" disabled={updateStatus.isPending || reason.trim().length < 10} onClick={() => updateStatus.mutate({ organizationId: selected.id, status: "active", reason })}><Play size={14} /> Reativar tenant</button>} {!canStatus && <span className="muted-text">Seu papel pode consultar, mas não alterar o status.</span>}</div></div><div className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">Billing e capacidade</span><h3>Plano, trial e assentos</h3></div><CreditCard size={17} /></div><div className="form-grid"><label>Plano<select disabled={!canBilling} value={plan} onChange={(event) => setPlan(event.target.value)}><option value="trial">Trial</option><option value="starter">Starter</option><option value="growth">Growth</option><option value="enterprise">Enterprise</option></select></label><label>Cobrança<select disabled={!canBilling} value={billingStatus} onChange={(event) => setBillingStatus(event.target.value)}><option value="trialing">Em trial</option><option value="active">Ativo</option><option value="past_due">Em atraso</option><option value="canceled">Cancelado</option></select></label><label>Limite de assentos<input disabled={!canBilling} type="number" min="1" value={seatLimit} onChange={(event) => setSeatLimit(Number(event.target.value))} /></label><label>Trial até<input disabled={!canBilling} type="date" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} /></label></div><button className="secondary-button compact" disabled={!canBilling || updatePlan.isPending || reason.trim().length < 10} onClick={() => updatePlan.mutate({ organizationId: selected.id, plan: plan as "trial" | "starter" | "growth" | "enterprise", billingStatus: billingStatus as "trialing" | "active" | "past_due" | "canceled", seatLimit, trialEndsAt: trialEndsAt || null, reason })}><CreditCard size={14} /> Salvar condições comerciais</button></div><div className="admin-section"><div className="admin-section-heading"><div><span className="eyebrow">Entitlements</span><h3>Recursos habilitados</h3></div><LockKeyhole size={16} /></div><div className="admin-feature-list">{["livestock", "imports", "operations", "catalog", "growth_calculator"].map((featureKey) => { const feature = ((detail.data as any)?.features ?? []).find((item: any) => item.featureKey === featureKey); const enabled = feature ? Boolean(feature.enabled) : true; return <button key={featureKey} className={`admin-feature ${enabled ? "enabled" : ""}`} disabled={!canBilling || setFeature.isPending} onClick={() => setFeature.mutate({ organizationId: selected.id, featureKey: featureKey as "livestock" | "imports" | "operations" | "catalog" | "growth_calculator", enabled: !enabled, reason })}><span><CheckCircle2 size={14} />{featureLabels[featureKey]}</span><b>{enabled ? "Ativo" : "Desligado"}</b></button>; })}</div></div></>}</section>
    </div>
  </>;
}
