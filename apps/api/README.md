# API do Nexus AI

API desenvolvida com NestJS e TypeScript, responsável pela camada de controle da plataforma Nexus AI. O módulo de execuções persiste intenções, tentativas e eventos em PostgreSQL por meio de repositórios Drizzle.

Este pacote faz parte do monorepositório. Execute os comandos deste documento a partir da **raiz do repositório**, exceto os comandos identificados como internos ao `psql`.

## Tecnologias

| Tecnologia         | Responsabilidade                                            |
| ------------------ | ----------------------------------------------------------- |
| Node.js 24         | Executar a aplicação e carregar variáveis de ambiente       |
| NestJS             | Organizar módulos, injeção de dependências e rotas HTTP     |
| TypeScript com ESM | Verificar tipos e utilizar módulos com `import` e `export`  |
| PostgreSQL 17      | Persistir os dados da plataforma                            |
| Drizzle ORM e `pg` | Executar consultas e gerenciar o pool de conexões           |
| Drizzle Kit        | Gerar e aplicar migrações versionadas                       |
| Vitest             | Executar testes unitários, HTTP e de integração             |
| Testcontainers     | Criar um PostgreSQL temporário para os testes de integração |
| Oxlint             | Verificar o código, incluindo regras que dependem de tipos  |

As versões das dependências estão em [`package.json`](./package.json) e no [`pnpm-lock.yaml`](../../pnpm-lock.yaml).

## Pré-requisitos

- Node.js 24, conforme o [`.nvmrc`](../../.nvmrc).
- pnpm 12.18.0, conforme o [`package.json` da raiz](../../package.json).
- Docker Desktop ou Docker Engine com Docker Compose em execução.

O PostgreSQL e o cliente `psql` são fornecidos pelo contêiner. A instalação dessas ferramentas no computador é opcional.

## Configuração inicial

Selecione a versão do Node.js e instale as dependências do monorepositório:

```bash
nvm install
nvm use
pnpm install --frozen-lockfile
```

Crie o arquivo de ambiente a partir do exemplo, preservando um `.env` existente:

```bash
test -f .env || cp .env.example .env
```

Revise as variáveis antes de iniciar a API:

| Variável                                            | Uso                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                                      | Conexão utilizada pela API local e pelos comandos de banco          |
| `PORT`                                              | Porta da API executada localmente; o padrão é `4000`                |
| `API_PORT`                                          | Porta publicada pelo Docker Compose para a API; o padrão é `4000`   |
| `POSTGRES_PORT`                                     | Porta publicada pelo Docker Compose para o banco; o padrão é `5432` |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Parâmetros de inicialização do PostgreSQL no Compose                |

O [`.env.example`](../../.env.example) contém valores destinados ao desenvolvimento local. O arquivo `.env` deve permanecer fora do controle de versão.

Para a API executada no computador, `DATABASE_URL` aponta para `127.0.0.1`. No contêiner da API, o Compose configura a conexão com o serviço `postgres`, na porta interna `5432`. Se alterar `POSTGRES_PORT`, ajuste também a porta de `DATABASE_URL` para os comandos executados no computador.

## Executar em desenvolvimento

Inicie o PostgreSQL e aplique as migrações:

```bash
docker compose up -d --wait --wait-timeout 60 postgres
pnpm --filter api db:check
pnpm --filter api db:migrate
```

Inicie a API com reinicialização automática ao alterar os arquivos:

```bash
pnpm --filter api start:dev
```

Os scripts `start`, `start:dev`, `start:debug` e `start:prod` carregam o `.env` da raiz quando ele existe. A conexão utiliza a variável `DATABASE_URL` disponível no processo.

| Comando                         | Finalidade                                                 |
| ------------------------------- | ---------------------------------------------------------- |
| `pnpm --filter api start`       | Compilar e iniciar a aplicação                             |
| `pnpm --filter api start:dev`   | Executar em desenvolvimento com reinicialização automática |
| `pnpm --filter api start:debug` | Executar com o depurador e reinicialização automática      |
| `pnpm --filter api build`       | Compilar a aplicação para `apps/api/dist`                  |
| `pnpm --filter api start:prod`  | Executar a aplicação previamente compilada                 |

## Rotas disponíveis

Com a configuração padrão, a API responde em `http://127.0.0.1:4000`.

| Método e rota | Resposta          | Finalidade                                     |
| ------------- | ----------------- | ---------------------------------------------- |
| `GET /`       | `Hello World!`    | Rota inicial da aplicação                      |
| `GET /health` | `{"status":"ok"}` | Confirmar que o processo HTTP está respondendo |

```bash
curl -fsS http://127.0.0.1:4000/health
```

A inicialização da API executa `SELECT 1` e falha se a conexão com o PostgreSQL não puder ser estabelecida. A rota `/health` retorna uma resposta estática; ela não executa uma nova consulta ao banco a cada requisição.

## Executar a API no Docker Compose

Para construir a imagem e iniciar a API com sua dependência PostgreSQL:

```bash
docker compose up -d --build --wait --wait-timeout 120 api
docker compose ps api postgres
docker compose logs --tail=40 api
curl -fsS http://127.0.0.1:4000/health
```

O Compose aguarda o PostgreSQL ficar saudável antes de iniciar a API. As migrações são aplicadas explicitamente com `db:migrate`; a inicialização da aplicação não altera o esquema do banco.

Para liberar a porta antes de voltar à execução local:

```bash
docker compose stop api
```

O volume `postgres-data` preserva os dados ao recriar o contêiner. As variáveis `POSTGRES_*` inicializam o banco somente quando esse volume está vazio.

## Persistência e migrações

A API é responsável pelas migrações dos dados da plataforma, conforme o [ADR-003](../../docs/adr/003-persistence.md).

| Local                                                                                                  | Responsabilidade                                                          |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [`src/infrastructure/database/schema.ts`](./src/infrastructure/database/schema.ts)                     | Declarar a estrutura gerenciada pelo Drizzle                              |
| [`src/infrastructure/database/database.module.ts`](./src/infrastructure/database/database.module.ts)   | Disponibilizar a conexão pelo módulo de injeção de dependências do NestJS |
| [`src/infrastructure/database/check-connection.ts`](./src/infrastructure/database/check-connection.ts) | Verificar a conexão com uma consulta simples                              |
| [`drizzle.config.ts`](./drizzle.config.ts)                                                             | Configurar o acesso ao banco e os caminhos das migrações                  |
| [`drizzle/`](./drizzle/)                                                                               | Armazenar arquivos SQL e metadados das migrações                          |

A migração inicial cria o esquema `nexus`. A migração `0001_execution_persistence` acrescenta as tabelas de execução. O Drizzle registra as migrações aplicadas em `nexus_migrations.__drizzle_migrations`.

O fluxo para evoluir o banco é:

1. Alterar as declarações em `schema.ts`.
2. Gerar a migração com `pnpm --filter api db:generate`.
3. Revisar o SQL e os metadados gerados em `drizzle/`.
4. Aplicar a migração com `pnpm --filter api db:migrate`.
5. Validar os testes e versionar o SQL junto aos metadados.

O comando `db:check` carrega o `.env` da raiz e consulta o banco, o usuário conectado e o resultado de `SELECT 1`. A configuração do Drizzle Kit também carrega esse arquivo quando ele existe e exige `DATABASE_URL`.

O módulo de banco encerra o pool quando a aplicação é finalizada. A API habilita os eventos de encerramento para `SIGINT` e `SIGTERM`.

### Modelo de execução (NX-011)

| Tabela | Conteúdo e garantias |
| --- | --- |
| `nexus.runs` | Intenção com ID estável, workspace, solicitante, agente e versão exata, input JSON, correlação, estado público e sequência do último evento. A chave de submissão é única por workspace e solicitante. |
| `nexus.run_attempts` | Tentativas numeradas a partir de 1 dentro de cada run. Cada uma tem ID próprio, referência do runtime, horários e resultado ou erro. Um índice único parcial admite no máximo uma tentativa em `pending`, `running` ou `unknown` por run. |
| `nexus.run_events` | Eventos com ID, versão, correlação, horário e sequência única por run. A chave estrangeira composta garante que a tentativa do evento pertence ao mesmo run. |

O módulo NestJS exporta dois contratos. `ExecutionRepository` cria a intenção, consulta o snapshot com a tentativa mais recente e registra transições. `ExecutionHistoryRepository` consulta as tentativas por número e os eventos em páginas, em ordem crescente a partir de um cursor exclusivo. Todas as operações recebem o workspace e o solicitante do contexto autorizado. [Contratos dos repositórios](./src/executions/execution.repository.ts)

`create` grava o run pendente, a primeira tentativa e o evento de sequência 1 na mesma transação. A chave de idempotência e o hash SHA-256 ficam na própria intenção durante toda a sua vida. O hash cobre agente, versão e input normalizados como JSONB. Repetir a chave com o mesmo conteúdo devolve o snapshot atual. Alterar o conteúdo com a mesma chave gera `IdempotencyConflictError`.

| Estado da tentativa | Próximos estados aceitos |
| --- | --- |
| `pending` | `running`, `failed`, `unknown` |
| `running` | `succeeded`, `failed`, `cancelled`, `unknown` |
| `unknown` | `running`, `succeeded`, `failed`, `cancelled`, mediante confirmação do runtime |
| `succeeded`, `failed`, `cancelled` | Terminais e imutáveis |

`transition` bloqueia o run e verifica o ID da tentativa atual e a sequência observada pelo chamador. A tentativa, o estado público e o evento avançam no mesmo commit. Uma falha confirmada com `retry: true` encerra a tentativa e abre a próxima, preservando o estado `pending` ou `running` do run. Um resultado incerto exige reconciliação. O estado `cancelled` registra uma interrupção confirmada.

O chamador fornece a versão resolvida do agente, o input e o resultado próprios para persistência. O repositório grava um erro com categoria (`platform`, `provider` ou `tool`), código e mensagem sanitizada. Eventos referenciam a tentativa que contém o resultado ou o erro. A integração com o runtime e os endpoints de submissão e acompanhamento ficam para as etapas seguintes.

### Conferir pelo `psql` do contêiner

Execute este comando no terminal do computador para abrir o cliente:

```bash
docker compose exec postgres sh -ec 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

No prompt do `psql`, execute os comandos SQL e os comandos iniciados com `\`:

```sql
\conninfo
\dn

SELECT count(*) AS applied_migrations
FROM nexus_migrations.__drizzle_migrations;

SELECT id, hash, created_at
FROM nexus_migrations.__drizzle_migrations
ORDER BY id;
```

Use `\q` para sair e retornar ao terminal. Se o prompt mudar para `nexus-#`, existe um comando incompleto no buffer; use `\r` para limpá-lo antes de continuar. Comandos `docker` e `pnpm` devem ser executados no terminal do computador.

## Qualidade e testes

| Suíte                           | Arquivos                                                             | Banco real                                           |
| ------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Testes unitários                | `src/**/*.spec.ts`                                                   | Não                                                  |
| Testes HTTP de ponta a ponta    | `test/**/*.e2e-spec.ts`                                              | Não; o módulo de banco é substituído no teste        |
| Testes de integração PostgreSQL | `tests/integration/**/*.integration-spec.ts`, na raiz do repositório | Sim; contêiner temporário criado pelo Testcontainers |

Execute as verificações da API:

```bash
pnpm --filter api typecheck
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
```

Com o Docker em execução, valide também a suíte de integração:

```bash
pnpm --filter api typecheck:integration
pnpm --filter api lint:integration
pnpm --filter api test:integration
```

Os testes de integração usam dados sintéticos e bancos temporários criados pelo Testcontainers. Cada suíte configura a própria conexão e remove seu contêiner ao encerrar.

- A suíte de infraestrutura verifica a atualização a partir da NX-010, a preservação de dados ao reaplicar migrações e o ciclo de vida do pool NestJS. [Testes de PostgreSQL](../../tests/integration/postgres.integration-spec.ts)
- A suíte de execuções aplica todas as migrações a um banco vazio e usa os repositórios injetados pelo `AppModule`. Ela cobre idempotência e retries concorrentes, isolamento de contexto, transições, relacionamentos, paginação e rollback ao falhar a gravação do evento. [Testes de execução](../../tests/integration/execution.integration-spec.ts)

Para acompanhar alterações ou gerar cobertura dos testes unitários:

```bash
pnpm --filter api test:watch
pnpm --filter api test:cov
```

### Configuração dos tipos nos testes de integração

[`tsconfig.integration.json`](./tsconfig.integration.json) estende a configuração da API e inclui os testes da raiz, sem emitir arquivos compilados. Os tipos globais do Vitest vêm da configuração base da API.

O arquivo [`tests/integration/tsconfig.json`](../../tests/integration/tsconfig.json) herda essa configuração e define `typeRoots` com os caminhos de `apps/api/node_modules/@types` e `apps/api/node_modules`. Assim, o editor encontra os tipos de Node.js e do Vitest mesmo com os testes fora da pasta da API, reconhecendo `describe`, `it`, `expect` e `vi`. O comando `typecheck:integration` verifica esse mesmo projeto, tanto localmente quanto na CI.

## Integração contínua

O [workflow de CI](../../.github/workflows/ci.yml) executa lint, verificação de tipos, testes e compilação. O job TypeScript também executa as verificações de integração PostgreSQL. O Testcontainers gerencia seu próprio banco temporário nesse job.

A publicação em produção e a instrumentação de observabilidade serão definidas em etapas posteriores do projeto.

## Documentação de referência

- [Visão geral do Nexus AI](../../README.md).
- [Convenções do repositório](../../docs/architecture/repository-conventions.md).
- [Persistência e consistência — ADR-003](../../docs/adr/003-persistence.md).
- [Documentação do NestJS](https://docs.nestjs.com/).
- [Integração entre NestJS e Drizzle](https://docs.nestjs.com/data/drizzle).
- [Migrações com Drizzle Kit](https://orm.drizzle.team/docs/kit-overview).
- [Cliente `psql` do PostgreSQL 17](https://www.postgresql.org/docs/17/app-psql.html).
- [Configuração dos globais do Vitest](https://vitest.dev/config/globals).
- [Herança de configurações do TypeScript](https://www.typescriptlang.org/tsconfig/extends.html).
- [PostgreSQL com Testcontainers](https://node.testcontainers.org/modules/postgresql/).
- [Comando `docker compose up`](https://docs.docker.com/reference/cli/docker/compose/up/).

## Licença

Consulte a [licença do repositório](../../LICENSE).
