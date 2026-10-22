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

O instalador cria o arquivo `.env` com senhas aleatórias quando ele ainda não existe, sobe MySQL 8.4 com volume persistente, constrói a aplicação, aplica migrations e insere a base demonstrativa apenas se o banco estiver vazio.

Depois da instalação, confirme que os containers estão saudáveis:

```bash
docker compose ps
curl http://127.0.0.1:3000/api/health
```

Acesse `http://IP_DA_VPS:3000` ou a porta definida em `APP_PORT` no `.env`. As credenciais iniciais ficam no arquivo `.env` local da VPS:

```bash
grep '^SEED_ADMIN_EMAIL=' .env
grep '^SEED_ADMIN_PASSWORD=' .env
```

Nunca envie o arquivo `.env` ao GitHub nem o compartilhe por mensagem.

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

# Atualização da aplicação
git pull
docker compose up -d --build

# Healthcheck
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/health').then(r => r.text()).then(console.log)"
```

A atualização preserva o volume `bonanca_mysql_data`. As migrations são executadas de forma idempotente antes de cada inicialização da aplicação. Não remova volumes em produção sem backup confirmado.

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
pnpm check
pnpm test
pnpm build
```

## Escopo atual

O MVP usa dados demonstrativos anonimizados. Não importa planilhas reais, não conecta ERP/SEFAZ/Open Finance, não armazena documentos binários e não fecha o modelo dos futuros módulos. Integrações, OCR, anexos, permissões mais granulares, multi-idioma e módulos imobiliário/patrimonial ficam preparados para fases posteriores com autorização e dados reais.
