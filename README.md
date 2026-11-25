# Nexus AI

**Construa, orquestre e observe agentes inteligentes.**

O **Nexus AI** é uma plataforma open source para desenvolvimento, execução e observabilidade de agentes de Inteligência Artificial Generativa.

O projeto tem como objetivo oferecer uma infraestrutura modular e extensível, permitindo que desenvolvedores criem agentes especializados, integrem ferramentas, gerenciem execuções e acompanhem seu comportamento por meio de uma interface web.

> **Status:** Em desenvolvimento — Foundation v0.1.0

## Arquitetura

O Nexus AI adota uma arquitetura full-stack com separação clara entre a interface, as regras de negócio e o ambiente de execução dos agentes.

| Camada | Tecnologias | Responsabilidade |
|---|---|---|
| Frontend | Next.js, React, TypeScript | Interface web e experiência do usuário |
| Backend | NestJS, TypeScript | APIs, regras de negócio e integrações |
| Agent Runtime | Python, Agno | Execução e orquestração dos agentes |
| Persistência | PostgreSQL | Armazenamento de dados e estados |
| Gerenciamento de pacotes | pnpm, uv | Dependências TypeScript e Python |
| Orquestração de tarefas | Turborepo | Builds, desenvolvimento e testes |
| Infraestrutura | Docker Compose | Ambiente local reproduzível |
| Observabilidade | OpenTelemetry, Langfuse | Monitoramento e rastreabilidade |

A arquitetura segue os princípios de modularidade, separação de responsabilidades, contratos explícitos, segurança e desenvolvimento incremental.

## Estrutura do projeto

O repositório utiliza uma arquitetura de **monorepo**, permitindo organizar aplicações, bibliotecas compartilhadas, serviços e infraestrutura em um único local.

```text
nexus-ai/
├── apps/                   # Aplicações da plataforma
│   ├── web/                # Frontend Next.js
│   ├── api/                # Backend NestJS
│   └── agent-runtime/      # Bootstrap Python do Agent Runtime
│
├── packages/               # Bibliotecas TypeScript compartilhadas
├── python/                 # Agentes e ferramentas Python
├── infra/                  # Infraestrutura e containers
├── docs/                   # Documentação técnica e arquitetural
│
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
└── README.md
```

**Nota:** a estrutura acima representa a organização planejada. Os módulos serão implementados progressivamente ao longo das etapas de desenvolvimento.

## Pré-requisitos

Para trabalhar com o projeto, é necessário ter instalado:

- Git
- Node.js 24 LTS
- pnpm 12.18.0
- NVM (recomendado para gerenciamento de versões do Node.js)

Para trabalhar no Agent Runtime, instale o uv 0.13.7. O uv pode instalar o Python 3.13 indicado pelo projeto.

## Configuração inicial

### 1. Clonar o repositório

```bash
git clone <URL_DO_REPOSITORIO>
cd nexus-ai
```

### 2. Selecionar a versão do Node.js

O projeto utiliza um arquivo `.nvmrc` para indicar a versão esperada do Node.js.

```bash
nvm install
nvm use
```

### 3. Instalar as dependências

Utilize o pnpm para instalar as dependências do workspace:

```bash
pnpm install --frozen-lockfile
```

O arquivo `pnpm-lock.yaml` mantém a resolução das dependências consistente entre diferentes ambientes.

### 4. Verificar o ambiente

Confira as versões instaladas:

```bash
node -v
pnpm --version
pnpm exec turbo --version
```

### 5. Verificar os projetos do workspace

```bash
pnpm exec turbo ls
```

Esse comando permite inspecionar os projetos reconhecidos pelo Turborepo.

## Desenvolvimento

O Turborepo será responsável por coordenar as tarefas das aplicações JavaScript e TypeScript.

Os principais comandos JavaScript/TypeScript são:

| Comando | Finalidade |
|---|---|
| `pnpm dev` | Iniciar as aplicações em modo de desenvolvimento |
| `pnpm build` | Executar os builds dos projetos |
| `pnpm lint` | Verificar padrões de qualidade de código |
| `pnpm typecheck` | Verificar tipos da Web e da API |
| `pnpm test` | Executar testes unitários existentes (API) |
| `pnpm test:e2e` | Executar testes end-to-end existentes (API) |

O Turbo executa apenas tarefas existentes em cada pacote. A Web ainda não tem suíte de testes; `pnpm test` não representa cobertura de testes do frontend. O typecheck roda sem cache para gerar os tipos de rotas do Next.js em checkouts limpos.

### Ambiente local com Docker Compose

Com o Docker Engine e o plugin Docker Compose (ou Docker Desktop) em execução, suba a stack pela raiz:

```bash
docker compose up --build --wait
docker compose ps
```

O Compose usa os valores locais padrão. Para trocar as portas publicadas ou os parâmetros iniciais do PostgreSQL, copie `.env.example` para `.env` e edite o arquivo.

| Serviço | Endpoint ou conexão padrão | Health check |
|---|---|---|
| Web | `http://localhost:3000` | `GET /health` |
| API | `http://localhost:4000` | `GET /health` |
| Agent Runtime | `http://agent-runtime:8000` na rede do Compose | `GET /health` |
| PostgreSQL 17 | `127.0.0.1:5432` no host e `postgres:5432` na rede do Compose | `pg_isready` via TCP |

As sondas HTTP retornam `200` com `{"status":"ok"}` e confirmam que cada processo responde. A sonda do runtime sobe com a biblioteca padrão do Python e antecede a integração com AgentOS. A API persiste execuções, tentativas e eventos em PostgreSQL com Drizzle ORM. Aplique as migrações com `pnpm --filter api db:migrate`. A modelagem, a configuração da conexão e os testes de integração estão no [README da API](apps/api/README.md).

```bash
curl -fsS http://localhost:3000/health
curl -fsS http://localhost:4000/health
docker compose logs --tail=100
docker compose down
```

O volume `postgres-data` sobrevive a `docker compose down` e à recriação do serviço. As variáveis `POSTGRES_DB`, `POSTGRES_USER` e `POSTGRES_PASSWORD` inicializam apenas volumes vazios. `docker compose down --volumes` apaga os dados locais.

Referências do [Docker Compose](https://docs.docker.com/reference/cli/docker/compose/up/) e da [imagem oficial do PostgreSQL](https://hub.docker.com/_/postgres).

### Agent Runtime

O Agent Runtime usa uv para gerenciar seu ambiente e seu lockfile. A partir da raiz:

```bash
cd apps/agent-runtime
uv sync --locked
uv run --locked nexus-runtime
```

Consulte o [README do Agent Runtime](apps/agent-runtime/README.md) para instalar o Python e validar o pacote.

## Qualidade e CI

O workflow `.github/workflows/ci.yml` executa em PRs para `main`, pushes na `main` e disparos manuais. Há três jobs independentes:

- **TypeScript:** instalação com lockfile congelado, lint (ESLint na Web e Oxlint na API), typecheck, testes unitários/E2E da API e builds da Web/API.
- **Python:** instalação com `uv sync --locked`, Ruff (lint e formatação), mypy estrito, smoke test da CLI, build e validação do wheel instalado fora do checkout.
- **Docker Compose:** valida a configuração, constrói e inicia os serviços, verifica as sondas HTTP e confirma a persistência de dados após recriar o contêiner do PostgreSQL.

Na raiz, após `uv sync --locked` em `apps/agent-runtime`:

```bash
make check-python
```

Os alvos `make lint-python` e `make typecheck-python` também podem rodar separadamente. As ferramentas de qualidade Python têm versões fixadas no Makefile e executam isoladas via `uvx`; não são dependências do runtime. O ambiente do mypy resolve suas dependências transitivas separadamente do `uv.lock` do runtime.

A CI não faz deploy nem usa credenciais de providers. Não há suíte de testes de agentes ainda; o smoke test cobre somente empacotamento e entrada da CLI. O build Web atual baixa fontes do Google e requer acesso externo.

Para impedir merges com falhas, configure as verificações **TypeScript**, **Python** e **Docker Compose** como obrigatórias nas regras da branch `main`. Criar o workflow por si só não ativa proteção de branch.

Referências: [tarefas do Turbo](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks), [uv no GitHub Actions](https://docs.astral.sh/uv/guides/integration/github/), [ferramentas isoladas com uv](https://docs.astral.sh/uv/guides/tools/).

## Arquitetura e documentação

- [EPIC-01: entregáveis e próximos gates](docs/architecture/epic-01.md)
- [ADR-000: princípios e escopo](docs/adr/000-product-architecture-principles.md)
- [C4 Context](docs/architecture/c4-context.md) e [C4 Container](docs/architecture/c4-container.md)
- [ADR-001: runtime](docs/adr/001-agent-runtime.md)
- [ADR-002: contratos e API](docs/adr/002-contracts-and-api.md)
- [ADR-003: persistência](docs/adr/003-persistence.md)
- [Estrutura obrigatória e convenções](docs/architecture/repository-conventions.md)

## Contribuição

Respeite os destinos e fronteiras descritos nas convenções. Mudanças arquiteturais devem atualizar ADRs e diagramas; alterações de contratos exigem revisão de compatibilidade. Os documentos distinguem decisões aceitas de garantias que ainda precisam de testes.

## Licença

[MIT](LICENSE).
