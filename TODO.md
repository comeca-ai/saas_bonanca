# TODO — Bonança SaaS

## Autenticação, tenancy e LGPD

- [x] O sistema oferece login por e-mail e senha, logout e sessão httpOnly persistida no banco, sem depender do Manus para funcionar em uma instalação Docker.
- [ ] A sessão identifica uma organização ativa e um papel (`owner`, `admin`, `analyst`, `operator` ou `viewer`); toda leitura e escrita de negócio é filtrada pela organização do usuário e pela unidade ativa quando aplicável.
- [x] O primeiro seed é idempotente, só roda quando a base está vazia e cria a organização demo e o administrador a partir de `SEED_ADMIN_PASSWORD`, sem sobrescrever usuários posteriores.
- [ ] Dados pessoais são minimizados, mascarados na interface e contemplam retenção e backup documentados; uma organização nunca enxerga outra.

## Núcleo multinegócio e extensibilidade

- [x] O modelo suporta organizações, unidades de negócio hierárquicas, domínios, atividades, operações, ativos, contratos, contrapartes, centros de resultado e documentos.
- [x] Uma nova unidade que execute atividade suportada pode ser cadastrada e habilitada por configuração, sem alterar o núcleo técnico.
- [ ] Uma variação de atividade pode receber campos e parâmetros versionados; a interface exibe o domínio e a versão de configuração.
- [x] Novos domínios podem se conectar aos identificadores do núcleo, sem apagar dados ou quebrar integrações existentes.
- [x] Dev, homologação e produção usam ambientes/migrations versionados e o pacote de instalação documenta backup e restore.

## Controle da qualidade dos dados

- [x] Cada dado relevante mantém em dimensões distintas origem/evidência, método de obtenção, status realizado/estimado/simulado/a confirmar, qualidade e aprovação.
- [x] O sistema não apresenta como validado um dado sem evidência/decisão explícita e mantém a linguagem de preparação ou confirmação pendente quando aplicável.
- [x] Divergências preservam as leituras originais, a proposta de correção, a justificativa, o responsável e o estado da resolução.
- [x] Coincidências não viram vínculos confirmados automaticamente; vínculos candidatos só mudam para confirmados por ação explícita com justificativa.
- [x] Alterações relevantes preservam valor anterior, valor novo, autor, data e motivo em eventos de auditoria imutáveis.
- [ ] Regras automatizadas de qualidade criam alertas para incompletude, valores fora de faixa, vínculos candidatos parados e inconsistências sem alterar o dado original.

## Catálogo, linhagem e KPIs

- [x] O catálogo de dados informa significado, dono, domínio, origem esperada e linhagem de cada campo relevante.
- [x] A camada semântica de KPIs define fórmula, unidade, fontes, versão e limitações uma única vez, evitando cálculos divergentes em telas.
- [x] O painel diferencia fatos confirmados de estimados, simulados e a confirmar e explica a origem dos números.

## Piloto de pecuária de confinamento

- [x] O sistema cadastra e lista lotes paralelos com unidade, operação/ciclo, regime (pasto, semi-intensivo ou confinado), cabeças, entradas, saídas e status.
- [x] A ficha do lote exibe eventos de entrada, pesagem, manejo, transferência e saída com origem, qualidade e status do dado.
- [x] O catálogo de insumos suporta ração, suplemento, medicamento, combustível e itens adicionais.
- [x] Movimentações de insumo registram entrada, consumo, transferência ou ajuste e só compõem indicadores quando o vínculo ao lote estiver confirmado.
- [x] Lançamentos econômicos registram custo, receita ou ajuste, competência, valor, centro de resultado e vínculos controlados.
- [x] Fontes primárias, sistemas existentes, lançamentos de campo, planilhas e simulações são diferenciados por confiança/origem desde a entrada.

## Importação e reconciliação de bases

- [x] A tela de Importação recebe CSV, XLS, XLSX e JSON de até 5 MB e 5.000 linhas, com escolha do destino entre lotes, eventos/pesagens, movimentações de insumo e lançamentos econômicos.
- [x] O lote de importação preserva arquivo original em base64, hash SHA-256, nome, tamanho, cabeçalhos, mapeamento, usuário, contadores e histórico de decisões; o mesmo hash não pode ser recebido duas vezes na organização.
- [x] Cada linha mantém número de origem, conteúdo original, dados normalizados, status e erros; aliases de cabeçalhos, datas brasileiras e números com vírgula decimal são normalizados sem sobrescrever a leitura original.
- [x] O fluxo exige receber, mapear, validar e aprovar; unidades, lotes, insumos e movimentos são resolvidos dentro da organização e duplicidades ficam separadas.
- [x] Somente perfis administrativos aprovam linhas válidas; registros importados entram com origem consolidada e status a confirmar, e vínculos com lotes entram como candidatos.
- [x] O smoke test cobre upload, detalhe, mapeamento, validação e cancelamento sem aprovar dados no domínio; testes unitários cobrem CSV, JSON e XLSX.

## Painel, operação e calculadora

- [x] O painel mostra lotes ativos, cabeças sob gestão, consumo, custos apurados, registros pendentes, divergências abertas, vínculos candidatos, alertas de qualidade e documentos pendentes.
- [x] A navegação inclui Visão geral, Núcleo comum, Pecuária, Controle de dados, Catálogo e KPIs, Histórico, Configuração e “Quanto custa crescer”.
- [x] A tela “Quanto custa crescer” estima implantação, manutenção mensal e total em três anos, com faixas ilustrativas explicitamente marcadas como planejamento e controles para negócios, unidades/usuários e ferramenta de mercado/híbrida/sob medida.
- [x] As telas são limpas, claras, intuitivas, responsivas e usam estados vazios, feedback e detalhes progressivos para reduzir a carga cognitiva.

## Entrega Docker/self-hosted

- [ ] `docker compose up -d --build` sobe aplicação e MySQL com volume persistente, healthcheck e restart policy.
- [x] O container aplica migrations de forma idempotente antes de iniciar a aplicação e disponibiliza `/api/health` sem autenticação.
- [x] `.env.example` documenta banco, segredo de sessão, senha de seed, cookie seguro, origem e porta.
- [x] `README.md` documenta instalação, login inicial, logs, atualização, backup e restore.
- [x] A aplicação atende `PORT`, não grava dados duráveis no filesystem efêmero e não depende de credenciais privadas no bundle do navegador.

## Validação de engenharia

> Nota: o pacote Docker foi validado por sintaxe e análise estática neste ambiente; a execução de `docker compose up -d --build` deve ser confirmada na VPS porque o Sandbox não disponibiliza Docker.

- [x] O projeto passa `pnpm check`.
- [x] O projeto passa `pnpm build`.
- [x] O manifesto `GET /manus-routes.json` declara todas as rotas de página e não é substituído pelo fallback SPA.
- [x] A migration/seed é executável sem apagar dados existentes.
