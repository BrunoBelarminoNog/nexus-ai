# Convenções do repositório

NX-004 · 2026-11-09 · Normas para implementação futura e contribuições atuais.

## Estrutura obrigatória

```text
nexus-ai/
├── apps/
│   ├── web/                  # Next.js
│   ├── api/                  # NestJS
│   └── agent-runtime/        # AgentOS bootstrap
├── packages/
│   ├── ui/                   # Design System
│   ├── contracts/            # OpenAPI + schemas TS
│   ├── sdk-typescript/       # Client público
│   ├── eslint-config/
│   └── typescript-config/
├── python/
│   ├── nexus-agents/         # Agentes de exemplo
│   └── incidentlab/          # Agentes e tools
├── services/
│   └── incidentlab-mock-api/ # Dados sintéticos
├── infra/
│   ├── docker/
│   ├── terraform/
│   └── observability/
├── docs/
│   ├── architecture/
│   ├── adr/
│   ├── api/
│   └── benchmarks/
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── load/
├── .github/workflows/
├── docker-compose.yml
├── Makefile
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

A árvore define os destinos permitidos; não afirma que todos já estão implementados. Diretórios são materializados quando recebem conteúdo. Não criar `backend/`, `frontend/`, `agents/` ou `src/` de aplicação na raiz. Arquivos auxiliares de configuração, licença e lockfiles podem ficar na raiz. Mudanças nos limites exigem ADR.

## Dependências e organização

- `apps/web` usa `packages/ui`, contratos e SDK; não importa API ou runtime.
- `apps/api` usa contratos e seu adaptador; não importa web nem módulos internos Python.
- `apps/agent-runtime` compõe pacotes de `python/`; os pacotes Python não importam o bootstrap.
- Pacotes não importam aplicações. `packages/ui` não concentra regras de negócio; contratos não importam ORM ou framework de agentes.
- IncidentLab é demonstração substituível. Sua mock API tem lugar reservado em `services/incidentlab-mock-api`, mas fixtures locais bastam na Foundation.
- `infra/terraform` é reservado à evolução de deploy, sem obrigação de cloud no início.

## Ferramentas e nomes

Usar pnpm workspaces para `apps/*` e `packages/*` que tenham `package.json`, com Turborepo para tarefas JS/TS. Python usa `pyproject.toml` e lockfile próprio por ambiente; não transformar pacotes Python em pacotes npm apenas para incluí-los no workspace. Fixar versões das ferramentas e dependências no bootstrap; commitar lockfiles e usar instalação congelada em CI.

Pacotes TS usam escopo `@nexus-ai/`; diretórios e arquivos seguem kebab-case, componentes React PascalCase, símbolos TS camelCase/PascalCase conforme seu papel. Distribuições Python mantêm nomes com hífen, imports usam `nexus_agents` e `incidentlab`; módulos/funções usam snake_case. Código e identificadores em inglês; documentação inicial em português. Configurações compartilhadas ficam nos pacotes de ESLint e TypeScript, com modo estrito como padrão.

## Fluxo de contribuição

Branches: `feat/nx-001-descricao`, `fix/nx-001-descricao` ou `docs/nx-001-descricao`; trabalho iniciado pelo Codex usa `codex/nx-001-descricao`. Commits seguem Conventional Commits, por exemplo `docs(architecture): define persistence ownership`. PRs informam problema, mudança, issue NX, validação realizada e limitações; nenhum check futuro deve ser declarado executado.

Antes do merge, revisar documentação/contratos afetados e executar checks existentes. Quando configurados, a CI deve exigir lint, tipos, testes pertinentes, build, validação de contratos e migrações. Mudança só documental valida links, consistência e diagramas; não exige testes de runtime inexistente.

## Testes e configuração

Unitários ficam junto ao código. Integração entre processos/banco em `tests/integration`, jornadas públicas em `tests/e2e`, carga em `tests/load`; resultados reproduzíveis em `docs/benchmarks`. Testes usam dados sintéticos e modo determinístico por padrão, separando chamadas pagas a providers.

`.env.example` documenta variáveis com valores fictícios; `.env` e credenciais não entram no Git. Validar configuração no startup. Logs estruturados levam correlação, run e tentativa, sem segredos ou raciocínio privado. Observabilidade em `infra/observability`.

## Governança da documentação

ADRs têm número sequencial de três dígitos, título, status, data, contexto, decisão, alternativas e consequências. Aceito significa decisão de projeto, não implementação comprovada. Alterações de decisão criam novo ADR referenciando o anterior, que passa a superseded; correções editoriais podem ser feitas no mesmo documento.

Manter C4 Context/Container sincronizados ao mudar fronteiras, processos ou armazenamento. Referenciar arquivos presentes no repositório; documentos externos ausentes são contexto histórico, não pré-requisitos invisíveis. O README é a entrada de navegação e distingue capacidade prevista de funcionalidade entregue.
