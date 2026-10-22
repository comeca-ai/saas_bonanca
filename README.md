# Bonança SaaS

Bonança é uma camada operacional e de governança de dados para grupos multinegócio. O primeiro módulo acompanha pecuária de confinamento — lotes, eventos, insumos, custos e evidências — sem perder o núcleo comum que permite evoluir para imobiliário, holdings, participações e novos domínios.

A interface usa detalhes progressivos: a operação vê o que precisa fazer agora; a governança consegue abrir origem, qualidade, divergência e auditoria quando precisar. O projeto é executável tanto no ambiente SaaS quanto em uma VPS própria.

## Instalação rápida em VPS

### Pré-requisitos

A VPS precisa de Linux, Docker Engine 24+ e Docker Compose Plugin. Não é necessário instalar Node, pnpm ou MySQL no host: ambos rodam dentro dos containers.

Libere a porta definida em `APP_PORT` no firewall enquanto não houver proxy reverso. Para produção, o recomendado é expor somente HTTPS através de Nginx, Caddy, Traefik ou equivalente.

### Clone e primeira execução

```bash
git clone https://github.com/comeca-ai/saas_bonanca.git bonanca
cd bonanca
chmod +x install.sh docker-entrypoint.sh scripts/*.sh
./install.sh
```

O instalador cria o arquivo `.env` com senhas e tokens internos aleatórios quando ele ainda não existe, sobe MySQL 8.4 com volume persistente, constrói a aplicação e os microserviços, aplica migrations e insere a base demonstrativa apenas se o banco estiver vazio.

Depois da instalação, confirme que os containers estão saudáveis:

```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
# Os serviços especializados ficam somente na rede Docker interna:
docker compose exec pesagem python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/api/health').read().decode())"
docker compose exec balanca-misturadora node -e "fetch('http://127.0.0.1:8080/api/health').then(r => r.text()).then(console.log)"
```

Acesse `http://IP_DA_VPS:3000` ou a porta definida em `APP_PORT` no `.env`. As credenciais iniciais ficam no arquivo `.env` local da VPS:

```bash
grep '^SEED_ADMIN_EMAIL=' .env
grep '^SEED_ADMIN_PASSWORD=' .env
```

Nunca envie o arquivo `.env` ao GitHub nem o compartilhe por mensagem.

## Administração SaaS multitenant

O Bonança separa a administração da **plataforma** da administração de cada organização. O papel `owner` ou `admin` de um tenant não concede acesso global automaticamente.

Para habilitar o primeiro administrador global em uma instalação self-hosted, defina explicitamente no `.env` o e-mail do usuário que deve receber `super_admin`:

```dotenv
PLATFORM_ADMIN_EMAIL=seu-admin-da-plataforma@empresa.com
```

Depois, reinicie o app para que o seed idempotente faça o bootstrap da permissão sem apagar ou recriar dados:

```bash
docker compose up -d --build
```

O console fica em `/saas-admin` e só aparece para papéis globais explícitos. Os papéis disponíveis são `super_admin`, `support`, `billing`, `security` e `readonly`. Suspender um tenant revoga suas sessões ativas, preserva os dados e exige motivo; mudanças ficam registradas em uma auditoria global separada da auditoria operacional.

Boas práticas: use uma conta nominal para cada administrador da plataforma, limite `billing` a alterações comerciais, limite `support`/`security` ao ciclo de vida do tenant, mantenha `PLATFORM_ADMIN_EMAIL` fora do código e revise a trilha de plataforma periodicamente.

## Produção com domínio e HTTPS

Antes de colocar em produção, edite `.env`:

```bash
nano .env
```

Ajuste ao menos estas variáveis:

```dotenv
APP_PORT=3000
APP_ORIGIN=https://bonanca.seudominio.com
COOKIE_SECURE=true
BIND_ADDRESS=127.0.0.1
```

Mantenha `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SESSION_SECRET` e `SEED_ADMIN_PASSWORD` secretos e fortes. Após editar, aplique a configuração:

```bash
docker compose up -d --build
```

O proxy reverso deve encaminhar tráfego ao host em `127.0.0.1:3000` (ou à porta escolhida em `APP_PORT`) e enviar `X-Forwarded-Proto: https`. Em HTTPS, o cookie de sessão usa `HttpOnly`, `Secure` e `SameSite=None` para o login funcionar corretamente também em previews incorporados. As mutações tRPC validam a origem contra `APP_ORIGIN` ou o host encaminhado pelo proxy.

## Operação diária

```bash
# Status e logs
docker compose ps
docker compose logs -f app
docker compose logs -f pesagem balanca-misturadora

# Atualização da aplicação
git pull
docker compose up -d --build

# Healthcheck
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.text()).then(console.log)"

# Smoke test autenticado — usa as credenciais do .env sem exibi-las
SMOKE_EMAIL="$(grep '^SEED_ADMIN_EMAIL=' .env | cut -d= -f2-)"
SMOKE_PASSWORD="$(grep '^SEED_ADMIN_PASSWORD=' .env | cut -d= -f2-)"
SMOKE_BASE_URL="http://127.0.0.1:${APP_PORT:-3000}"
docker compose exec -T \
  -e "SMOKE_EMAIL=${SMOKE_EMAIL}" \
  -e "SMOKE_PASSWORD=${SMOKE_PASSWORD}" \
  -e "SMOKE_BASE_URL=${SMOKE_BASE_URL}" \
  app node scripts/smoke-test.mjs
```

O smoke test verifica healthcheck, manifesto de rotas, bloqueio sem sessão, login, sessão, dashboard, núcleo comum, lista e ficha de lotes, insumos, recebimento/mapeamento/validação/cancelamento de uma importação, controle de dados, catálogo, KPIs, qualidade, histórico, membros sem exposição de hashes e logout. Ele não aprova linhas no domínio e pode ser executado após cada atualização.

A atualização preserva o volume `bonanca_mysql_data`. As migrations são executadas de forma idempotente antes de cada inicialização da aplicação. Não remova volumes em produção sem backup confirmado.

## Importação controlada de bases

A tela **Importação** recebe arquivos CSV, XLS, XLSX ou JSON de até 5 MB e até 5.000 linhas. O operador escolhe o destino — lotes, eventos/pesagens, movimentações de insumo ou lançamentos econômicos — e pode informar uma unidade padrão quando a planilha não tiver esse campo.

Na própria tela há o botão **Modelo Excel** para baixar [`Template_Dados_Bonanca.xlsx`](./client/public/templates/Template_Dados_Bonanca.xlsx). O arquivo oficial contém as abas `Comece aqui`, `Dicionario`, `Unidades`, `Lotes`, `Movimentos`, `Pesagens`, `Consumo`, `Financeiro`, `Metas` e `Acoes`, com instruções de preenchimento, campos obrigatórios e regras de origem. Para importar, use cada aba operacional como arquivo separado ou exporte a aba necessária para CSV/XLSX; o importador continuará exigindo mapeamento, validação e aprovação.

O fluxo é deliberadamente em quatro etapas: **receber → mapear → validar → aprovar**. O arquivo original fica preservado no lote com hash SHA-256, nome, tamanho, usuário, cabeçalhos e mapeamento. Cada linha mantém o conteúdo original, linha de origem, dados normalizados, status e mensagens de erro. Datas brasileiras, números com vírgula decimal e aliases comuns do agronegócio são normalizados sem alterar o valor original.

Linhas com unidade, lote ou insumo inexistente, campos obrigatórios ausentes, duplicidades ou referências conflitantes ficam inválidas ou duplicadas. Somente `owner` ou `admin` podem aprovar as linhas válidas; a gravação ocorre em transação e entra com `originType=consolidated`, método `import` e status `to_confirm`. Vínculos entre movimentações e lotes entram como candidatos, nunca como confirmados automaticamente. Um mesmo arquivo não pode ser recebido duas vezes na mesma organização.

## Backup e restauração

```bash
# Cria um backup lógico compactado em backups/
./scripts/backup.sh

# Restaura um backup — requer digitar RESTAURAR
./scripts/restore.sh backups/bonanca-YYYYMMDD-HHMMSS.sql.gz
```

O restore substitui os dados atuais do MySQL. Faça um backup imediatamente antes de qualquer restore e teste o procedimento em uma VPS de homologação antes de usá-lo em produção.

## Arquitetura self-hosted

- **Aplicação:** React, Express e tRPC, expostos na porta interna `3000`.
- **Banco:** MySQL 8.4 em rede Docker privada, charset `utf8mb4` e volume persistente `bonanca_mysql_data`.
- **Autenticação:** e-mail/senha com hash scrypt, sessão httpOnly no banco e papéis por organização.
- **Inicialização:** o entrypoint aguarda MySQL, aplica migrations, executa seed idempotente e inicia o servidor.
- **Durabilidade:** nenhum dado operacional é gravado no filesystem efêmero da aplicação; banco e backups ficam fora do container da aplicação.

### Serviços operacionais incluídos

O `docker-compose.yml` completo contém quatro serviços. Apenas `app` publica porta no host; `db`, `pesagem` e `balanca-misturadora` são acessíveis somente pela rede privada `bonanca_internal`.

| Serviço | Função | Persistência |
| --- | --- | --- |
| `app` | Interface Bonança, autenticação, gateway tRPC e auditoria central | MySQL |
| `db` | Banco MySQL 8.4 do núcleo multinegócio | volume `bonanca_mysql_data` |
| `pesagem` | Animais, sessões, pesos, GMD, grupos e manejos | volume `bonanca_pesagem_data`, separado por organização |
| `balanca-misturadora` | Ingredientes, receitas, máquinas, currais, estoque, batidas, sobras e ordenha | volume `bonanca_balanca_data`, segregado por organização |

A tela **Pesagem e alimentação** chama os microserviços pelo gateway do Bonança. A sessão do usuário fornece organização, usuário e papel; o app adiciona tokens internos distintos (`PESAGEM_SERVICE_TOKEN` e `BALANCA_SERVICE_TOKEN`) que nunca chegam ao navegador. Cada comando aprovado também fica registrado no histórico central.

Os módulos aceitam lançamentos manuais. Eles **não** se conectam automaticamente a indicadores, balanças, Bluetooth, portas seriais, TCP ou APIs de fabricante. Uma integração de equipamento deve ser homologada com modelo, firmware, protocolo, estabilidade de leitura, ACK, idempotência e testes físicos antes de ser habilitada.

No SaaS gerenciado de container único, o núcleo Bonança permanece disponível, mas esses dois serviços aparecem como **indisponíveis** até existir uma infraestrutura de serviços compatível. Nesse modo a chave de sessão é efêmera e os logins são renovados quando o container reinicia. Para operação persistente e para usar Pesagem e Balança Misturadora, instale esta distribuição pelo `docker compose` da VPS: ele exige `SESSION_SECRET` estável, os tokens internos e inicia os quatro containers de forma conjunta.

MySQL foi escolhido para manter o mesmo schema tanto no banco gerenciado do SaaS quanto no Docker Compose da VPS. O `docker-compose.yml` desta distribuição usa deliberadamente o MySQL interno; uma instalação com banco externo exige uma composição própria que remova o serviço `db` e forneça `DATABASE_URL` diretamente à aplicação.

## Desenvolvimento local

```bash
pnpm install
cp .env.example .env
# aponte DATABASE_URL para um MySQL disponível
pnpm db:migrate
pnpm dev
```

Checagens de engenharia:

```bash
# Tipagem, testes unitários, microserviços e build
pnpm test:all

# Somente a estrutura e os mapeamentos do template Excel
pnpm test:template

# Testes dos serviços Pesagem e Balança Misturadora
pnpm test:modules

# Smoke test autenticado contra o ambiente em execução
pnpm smoke

# Comandos individuais equivalentes
pnpm check
pnpm test:unit
pnpm build
```

A suíte fica organizada em quatro camadas: testes unitários do núcleo (`server/*.test.ts`), teste estrutural do template (`server/template.test.ts`), testes de integração dos microserviços (`services/*/test*`) e smoke test HTTP (`scripts/smoke-test.mjs`). O smoke test também baixa o template publicado e confirma as dez abas oficiais antes de testar login, importação, governança e logout.

## Escopo atual

O MVP usa dados demonstrativos anonimizados. A importação de bases é controlada e cobre os quatro destinos operacionais acima, mas ainda não conecta ERP/SEFAZ/Open Finance, não executa processamento assíncrono para arquivos grandes, não faz OCR, não armazena documentos binários e não fecha o modelo dos futuros módulos. Integrações, anexos, permissões mais granulares, multi-idioma e módulos imobiliário/patrimonial ficam preparados para fases posteriores com autorização e dados reais.
