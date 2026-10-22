import { useState } from "react";
import { ArrowRight, Database, ShieldCheck, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const login = trpc.auth.login.useMutation({ onSuccess: () => window.location.reload(), onError: (e) => setError(e.message) });
  const register = trpc.auth.register.useMutation({ onSuccess: () => window.location.reload(), onError: (e) => setError(e.message) });
  const [form, setForm] = useState({ name: "", email: "", password: "", organizationName: "" });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "login") login.mutate({ email: form.email, password: form.password });
    else register.mutate(form);
  };

  return (
    <main className="login-page">
      <div className="login-art" aria-hidden="true">
        <div className="brand-lockup brand-lockup-large"><span className="brand-mark">B</span><span>bonança</span></div>
        <div className="login-art-copy">
          <p className="eyebrow light">Data core para negócios que crescem</p>
          <h1>Dados confiáveis para decisões que atravessam ciclos.</h1>
          <p>Unifique operação, evidência e resultado em uma camada clara — do lote ao grupo.</p>
        </div>
        <div className="login-art-foot"><span><ShieldCheck size={15} /> Rastreamento nativo</span><span><Database size={15} /> MySQL-ready</span></div>
      </div>
      <section className="login-card-wrap">
        <div className="login-card">
          <div className="mobile-brand brand-lockup"><span className="brand-mark">B</span><span>bonança</span></div>
          <div className="login-heading">
            <span className="icon-badge"><Sparkles size={17} /></span>
            <p className="eyebrow">Console de governança</p>
            <h2>{mode === "login" ? "Entre no seu espaço" : "Crie seu espaço de dados"}</h2>
            <p>{mode === "login" ? "Continue de onde a operação parou." : "Comece com uma organização e evolua sem reconstruir o núcleo."}</p>
          </div>
          <form onSubmit={submit} className="stack-form">
            {mode === "register" && <>
              <label>Seu nome<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Como você será identificado" /></label>
              <label>Nome da organização<input required value={form.organizationName} onChange={e => setForm({ ...form, organizationName: e.target.value })} placeholder="Ex.: Grupo Bonança" /></label>
            </>}
            <label>E-mail<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="voce@empresa.com" /></label>
            <label>Senha<input required minLength={mode === "register" ? 8 : 1} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={mode === "register" ? "Mínimo de 8 caracteres" : "Sua senha"} /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="primary-button" type="submit" disabled={login.isPending || register.isPending}>{mode === "login" ? "Entrar no Bonança" : "Criar organização"}<ArrowRight size={16} /></button>
          </form>
          <button className="switch-mode" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Ainda não tenho uma organização" : "Já tenho acesso ao Bonança"}
          </button>
          <p className="login-legal">Ambiente pronto para instalação própria. Seus dados ficam no banco da sua organização.</p>
        </div>
      </section>
    </main>
  );
}
