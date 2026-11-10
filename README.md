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
│   └── agent-runtime/      # Inicialização do runtime Agno
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

As dependências Python e a infraestrutura Docker serão configuradas nas próximas etapas.

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

Os principais comandos previstos são:

| Comando | Finalidade |
|---|---|
| `pnpm dev` | Iniciar as aplicações em modo de desenvolvimento |
| `pnpm build` | Executar os builds dos projetos |
| `pnpm lint` | Verificar padrões de qualidade de código |
| `pnpm test` | Executar testes automatizados |

**Atenção:** inicialmente, apenas os scripts de desenvolvimento e build estão definidos na raiz. As aplicações, os testes e as demais verificações serão adicionados nas próximas etapas.


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
