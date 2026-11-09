# ADR-002 — Contratos públicos, eventos e compatibilidade

- Status: aceito para implementação; schemas e geração ainda não implementados.
- Data: 2026-11-09
- Escopo: NX-003 · Foundation
- Responsável: mantenedor do projeto

## Contexto

Console, Control Plane e runtime usam linguagens diferentes. Tipos internos do Agno não podem definir a API pública. Precisamos de uma única fonte de verdade e de acompanhamento recuperável após desconexão.

## Decisão

`packages/contracts/` contém a fonte canônica OpenAPI 3.1 e seus schemas, incluindo envelopes de eventos SSE e contrato interno do adaptador em documentos separados. Tipos TypeScript, validações e modelos Python são derivados dos schemas; não manter DTOs equivalentes à mão. Fixar geradores e versões na implementação e verificar regeneração sem diff em CI.

`packages/sdk-typescript/` encapsula HTTP, erros e consumo de eventos sem importar código de `apps/api/`. O Console consome contratos/SDK, nunca entidades de persistência. A criação de um SDK publicável não é requisito da Foundation.

### Semântica pública a implementar

| Operação | Contrato |
|---|---|
| `POST /v1/runs` | Entrada: agente/versionamento e input validado; `Idempotency-Key` obrigatório; retorna `202` com identidade e snapshot persistidos, sem implicar aceite pelo runtime |
| `GET /v1/runs/{run_id}` | Snapshot autorizado, estado e `last_event_sequence` lidos de forma consistente |
| `GET /v1/runs/{run_id}/events` | SSE autorizado; `Last-Event-ID` retoma após a sequência persistida |

Identidade e workspace são derivados da autenticação e autorizados pelo servidor. A mesma verificação vale para consultas e reconexões SSE. O mecanismo concreto de identidade é um gate de implementação; não usar workspace enviado pelo navegador como autoridade.

A chave de idempotência é única por contexto autorizado e operação: mesmo payload normalizado retorna o mesmo run; payload divergente retorna `409`. A retenção da chave acompanha a intenção, sem expiração independente na Foundation. Retry de transporte não cria tentativa. Retry explícito de execução, quando implementado, cria tentativa distinta.

Estados públicos: `pending` (intenção persistida), `running`, `succeeded`, `failed`, `cancelled` e `unknown` (resultado incerto). Fluxo normal: pending → running → terminal. Pending também pode falhar antes da execução. Pending/running podem virar unknown; reconciliação com evidência pode resolver unknown para running ou terminal. Estados terminais são imutáveis. Cancelled exige confirmação; não expor cancelamento como capacidade até validá-lo.

O envelope de evento inclui `schema_version`, `event_id`, `run_id`, `attempt_id`, `sequence`, `type`, `occurred_at`, `correlation_id` e `data` validado por tipo. A sequência é monotônica por run e serve como `id` SSE. Eventos são persistidos antes de transmissão; replay pode repetir entrega e o cliente deduplica por run/sequence. Heartbeats não são eventos de negócio. Resultado e erros não incluem raciocínio privado.

Ao retomar: obter snapshot consistente, aplicar apenas eventos posteriores à sua sequência e conectar/reconectar ao stream usando esse cursor. Cursor malformado retorna `400`; cursor fora do histórico disponível retorna `409` com código `EVENT_CURSOR_UNAVAILABLE`, antes de abrir SSE, exigindo novo snapshot. A implementação deve evitar lacunas entre replay e acompanhamento ao vivo.

Erros usam envelope `{code, message, correlation_id, details?}`. `details` é sanitizado. Distinguir autenticação (`401`), acesso negado (`403`), recurso ausente (`404`), conflito (`409`), entrada inválida (`400`), limite (`429`) e indisponibilidade (`503`). Falha de execução aceita é estado/evento do run, não um erro retroativo do POST.

### Evolução e validação

API pública usa `/v1`; adições opcionais compatíveis permanecem nessa versão. Remover/renomear campos, torná-los obrigatórios ou alterar semântica exige nova versão e migração documentada. Tipos de evento e enums novos exigem avaliação de compatibilidade; clientes ignoram tipos de evento desconhecidos sem perder o cursor e podem atualizar pelo snapshot.

CI futura valida especificação, exemplos, compatibilidade com a base, geração e fixtures compartilhadas entre TS/Python. Cobrir idempotência concorrente, autorização cruzada, replay e erro sanitizado em `tests/integration/`.

## Alternativas e consequências

Code-first com DTOs independentes foi rejeitado por risco de divergência; contratos nativos Agno foram rejeitados por acoplamento. Contract-first custa geração e revisão de compatibilidade, mas permite evolução independente. Revisar quando houver novos consumidores ou mudança no protocolo de streaming.
