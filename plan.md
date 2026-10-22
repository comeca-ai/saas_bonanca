# Plano de implementação — Bonança SaaS

## 1. Objetivo

Construir o **Bonança**, um SaaS multi-organização para governança operacional e dados rastreáveis do Grupo Bonança. A solução começará com o piloto de pecuária de confinamento, mas será estruturada para absorver imobiliário, holdings, participações, serviços e novas atividades sem reconstrução integral.

O produto deve funcionar em dois modos: **SaaS gerenciado**, com aplicação/API e banco MySQL gerenciado; e **self-hosted**, com uma instalação em servidor Linux usando Docker Compose e MySQL persistido em volume.

O modelo de domínio deve refletir o setor: lotes em diferentes regimes, ciclos de entrada/engorda/saída, insumos e consumo, pesagens e eventos, custos por centro de resultado, documentos/evidências, leituras divergentes e dados em estados realizado/estimado/simulado/a confirmar.

## 2. Arquitetura técnica

- **Frontend:** React + TypeScript + Tailwind, com interfaces limpas, claras e intuitivas, no padrão de produto SaaS moderno: bastante respiro, hierarquia tipográfica forte, estados vazios úteis, feedback imediato e poucos caminhos por tela. A densidade necessária para auditoria será organizada em painéis e detalhes progressivos, não em tabelas confusas.
- **Backend:** Express + tRPC, com regras de domínio no servidor e queries tipadas.
- **Persistência:** MySQL compatível, Drizzle ORM e migrations versionadas. O schema funciona no MySQL gerenciado e no MySQL do Docker Compose.
- **Autenticação:** sessão própria do Bonança com e-mail/senha, hash scrypt, cookie httpOnly e roles por organização. A implementação é independente de Manus para o container funcionar em outro servidor.
- **Tenancy e isolamento:** `organizations` representam clientes/grupos; `organization_members` controla papéis (`owner`, `admin`, `analyst`, `operator`, `viewer`); `business_units` isolam empresas, propriedades, holdings, SPEs e unidades operacionais. Toda leitura/escrita de negócio é filtrada pela organização e, onde aplicável, pela unidade ativa.
- **Entrega:** `Dockerfile` multi-stage, `docker-compose.yml`, `.env.example`, entrypoint que aplica migrations antes de iniciar, healthcheck, volume persistente do MySQL e documentação de backup/upgrade.

## 3. Modelo de dados

### Núcleo comum

| Entidade | Finalidade |
| --- | --- |
| `organizations` | Tenant do SaaS, com nome, slug e status. |
| `organization_members` | Usuário, organização, papel e status de acesso. |
| `users` | Identidade e credencial local, sem dados pessoais reais no seed. |
| `business_units` | Empresa, propriedade, holding, SPE ou unidade operacional; suporta hierarquia. |
| `domains` / `activities` | Catálogo de domínios e atividades habilitáveis por organização. |
| `operations` | Operação/ciclo com unidade, domínio, atividade, período, status e centro de resultado. |
| `assets` / `contracts` / `counterparties` | Ativos, instrumentos contratuais e partes relacionadas. |
| `result_centers` | Centros de custo, receita e resultado. |
| `documents` | Metadados de evidências e documentos, com referência de armazenamento opcional. |
| `data_records` | Valor relevante com origem/evidência, método, status, qualidade e aprovação separados. |
| `data_discrepancies` | Divergências entre leituras preservadas, correção proposta e justificativa. |
| `record_links` | Vínculos candidatos ou confirmados, sempre auditáveis. |
| `audit_events` | Trilha imutável de criação e alteração relevante. |

### Módulo de pecuária de confinamento

| Entidade | Finalidade |
| --- | --- |
| `livestock_lots` | Lote, unidade, operação, regime, cabeças, datas e estado do ciclo. |
| `lot_events` | Entrada, pesagem, manejo, transferência, saída e observações. |
| `inputs` / `input_movements` | Catálogo de insumos e entrada, consumo, transferência ou ajuste; ligado a lote apenas quando confirmado. |
| `economic_entries` | Custo, receita ou ajuste com valor, competência, centro e vínculos controlados. |

### Camadas adicionais de produção

- **Catálogo de dados e linhagem:** dicionário de campos com definição, dono, domínio, origem esperada e caminho de linhagem até o KPI/tela.
- **Camada semântica de KPIs:** definições únicas e versionadas de indicadores como custo por cabeça, custo por arroba produzida, margem por lote e giro de estoque. O MVP terá uma primeira coleção de indicadores de pecuária; cada indicador informa fórmula, unidade, fontes e limitações.
- **Qualidade automatizada:** regras configuráveis de faixa, completude, atualidade de vínculo e consistência. A execução cria alertas sem corrigir ou apagar o dado original.
- **Reconciliação de migração:** importações futuras entram com fonte, lote de migração, totais de controle e divergências; nenhuma planilha é “limpa” em silêncio.
- **Módulo de importação:** a tela recebe CSV/XLS/XLSX/JSON, preserva arquivo e hash, sugere mapeamento por aliases do setor, valida linha a linha, separa duplicidades e exige aprovação antes de criar registros no domínio.
- **Quatro camadas explícitas:** documentos/evidências, dados estruturados, telas de lançamento e relatórios/painéis são objetos e fluxos separados.

A extensão de novos domínios ocorre sem transformar tudo em atributos genéricos: atividade já suportada é cadastro/configuração; variação controlada tem parâmetros versionados; novo domínio recebe tabelas, regras e interfaces próprias ligadas aos IDs do núcleo.

## 4. Governança, segurança e particularidades do setor

1. Cada dado relevante mantém dimensões distintas para `origin_type`, `source_reference`, `acquisition_method`, `status` (`realized`, `estimated`, `simulated`, `to_confirm`), `quality` e `approval_status`.
2. Fontes podem ser documento primário (NF-e, OFX, romaneio, contrato, ticket de pesagem), ERP/contábil/folha, lançamento de campo, planilha atual ou simulação. O sistema preserva essa origem e sua confiança; “validado” nunca é inferido.
3. Leituras conflitantes permanecem armazenadas. A divergência registra valor original, fonte, proposta de correção, justificativa, responsável e resolução.
4. Coincidência de nome/data/valor gera vínculo `candidate`; apenas confirmação direta promove para `confirmed`.
5. Alterações relevantes não sobrescrevem silenciosamente: cada evento guarda anterior, novo valor, ator, data e motivo.
6. O lote é a unidade operacional principal do piloto e permite múltiplos lotes paralelos em regimes distintos.
7. Consumo de insumo e custo só compõem indicadores quando o vínculo é confirmado; candidatos aparecem separados nas pendências.
8. Pesagens e eventos possuem data, tipo, valor/unidade, origem e qualidade para suportar ganho de peso, conversão e custo por cabeça sem inventar KPIs definitivos.
9. O dashboard distingue apurado de estimado/simulado e mostra pendências antes de qualquer conclusão executiva.
10. Cada organização só enxerga seus dados; a unidade ativa restringe consultas quando o usuário não possui escopo de grupo. Dados pessoais são minimizados, mascarados na interface e sujeitos a retenção configurável.
11. Dev, homologação e produção usam ambientes e migrations versionadas separados; a criação de um domínio novo deve ser testada fora da base de produção.
12. Backup lógico do MySQL e restore por ponto de controle são documentados no pacote self-hosted.

## 5. Escopo funcional do MVP SaaS

### Acesso e tenancy

- Login por e-mail/senha, cadastro da primeira organização, logout e sessão httpOnly.
- Papéis por organização e seletor de unidade, sem acesso entre tenants.
- Seed idempotente com “Bonança Demo” e `admin@bonanca.local` usando `SEED_ADMIN_PASSWORD`, somente quando a base está vazia.

### Painel executivo

- Lotes ativos, cabeças sob gestão, consumo de insumos, custos apurados e pendências.
- Governança: registros a confirmar, divergências abertas, vínculos candidatos, alertas de qualidade e documentos pendentes.
- Tabela de lotes, atividade recente e status de confiança.

### Núcleo comum e pecuária

- Cadastros de unidades, domínios, atividades, operações, ativos, contratos, contrapartes, centros e documentos.
- Lotes com regime, cabeças, datas, eventos de entrada/pesagem/manejo/transferência/saída, insumos, movimentos e lançamentos econômicos.
- Separação visual entre confirmado, a confirmar, estimado e simulado.

### Controle, catálogo e expansão

- Filtros por unidade, módulo, origem, status, qualidade e aprovação.
- Criação/resolução de divergência e confirmação de vínculo com justificativa.
- Histórico/auditoria por entidade, usuário e período.
- Catálogo de dados com donos, definições, origem e linhagem.
- Biblioteca de KPIs semânticos com fórmula, unidade, fontes e sinal de confiabilidade.
- Regras de qualidade com severidade, condição, resultado e alertas abertos.
- Configuração de domínios, atividades e campos extensíveis versionados.
- Importação controlada de lotes, eventos/pesagens, movimentações de insumo e lançamentos econômicos; cada lote mantém arquivo original, hash, cabeçalhos, mapeamento, linhas, erros, duplicidades e decisão de aprovação.

### Calculadora “Quanto custa crescer”

Tela separada, com faixas ilustrativas e claramente marcadas como planejamento: estima implantação, manutenção mensal e total em três anos. Controles mostram o impacto relativo de novos negócios, unidades/usuários e escolha de ferramenta de mercado, híbrida ou sob medida. A calculadora não é orçamento nem usa dados reais do grupo.

## 6. Experiência e design

- **Movimento:** console de governança de dados com acabamento de SaaS contemporâneo, limpo e intuitivo.
- **Princípios:** evidência antes de conclusão; densidade com legibilidade; estados de confiança explícitos; operação sem ruído.
- **Cor:** carvão profundo para foco, superfícies claras e quentes, `Verde Bonança` (#315B4C) para confirmado, âmbar para atenção e vermelho-terra para divergência.
- **Layout:** trilho lateral contínuo, faixa superior contextual, uma tarefa principal por tela e detalhes progressivos em drawers/painéis. Evitar dashboard genérico de cards centralizados.
- **Assinaturas:** chips de proveniência, traço vertical de rastreabilidade e cadeia de evidência fonte → método → decisão.
- **Tipografia:** DM Sans para operação, IBM Plex Mono para códigos/metadados.
- **Voz:** criteriosa, clara e verificável: “Este vínculo é candidato: confirme apenas com evidência direta.”
- **Logo:** monograma B formado por duas faixas que convergem num ponto de origem.

## 7. Docker e instalação em outro servidor

- `Dockerfile` multi-stage instala dependências com pnpm 10.18.0, gera frontend/backend e inicia `node dist/index.js`.
- `docker-compose.yml` sobe `bonanca` + `mysql:8.4`, com rede privada, volume `bonanca_mysql_data`, healthcheck e restart policy.
- `.env.example` documenta `DATABASE_URL`, `SESSION_SECRET`, `SEED_ADMIN_PASSWORD`, `COOKIE_SECURE`, `APP_ORIGIN` e `PORT`.
- `docker-entrypoint.sh` aguarda o MySQL, executa `drizzle-kit migrate` de forma idempotente, executa seed apenas quando vazio e inicia o servidor.
- `README.md` explica instalação, primeiro login, logs, atualização, backup e restore.
- O filesystem do container não guarda dados duráveis; dados ficam no volume MySQL e futuras mídias em object storage compatível.

## 8. Ordem de implementação

1. Atualizar schema, migrations e serviços de sessão, tenancy, seed e auditoria.
2. Criar routers tRPC para autenticação, painel, núcleo, pecuária, qualidade, catálogo e calculadora.
3. Implementar layout SaaS e telas responsivas com estados vazios e feedback claros.
4. Adicionar Dockerfile, Compose, entrypoint, ambiente de exemplo e documentação de operação.
5. Configurar manifesto de rotas e identidade visual.
6. Rodar tipagem, testes existentes, build, migration e validação read-only contra o briefing e os acréscimos recebidos.
7. Salvar checkpoint no repositório canônico; publicação gerenciada continua separada da entrega Docker.

## 9. Limites desta entrega

O MVP não importa planilhas reais, não conecta ERP/SEFAZ/Open Finance, não armazena documentos binários, não acessa dados pessoais e não fecha o modelo dos futuros módulos. Integrações, permissões finas, OCR, armazenamento de anexos, multi-idioma e módulos imobiliário/patrimonial ficam preparados para fases posteriores com autorização e dados reais.
