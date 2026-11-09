# ADR-003 — Persistência, ownership e consistência

- Status: aceito para implementação; migrações ainda não criadas.
- Data: 2026-11-09
- Escopo: NX-003 · Foundation
- Responsável: mantenedor do projeto

## Contexto

Submissão, snapshots e replay precisam sobreviver à conexão do cliente. Persistir intenção não garante que o runtime executou a tarefa. Telemetria não pode ser usada como banco de negócio.

## Decisão

Usar PostgreSQL como armazenamento autoritativo do Control Plane. Migrações Nexus pertencem a `apps/api/`; configuração local pertence a `infra/docker/` e ao Compose da raiz. Biblioteca de acesso e versões serão fixadas no bootstrap, sem alterar ownership.

| Entidade conceitual | Conteúdo e invariantes |
|---|---|
| Run | ID, contexto autorizado, solicitante, agente/versão, input, estado e sequência atual |
| Tentativa | ID próprio, run, referência do runtime, timestamps, resultado/erro sanitizado |
| Idempotência | Contexto + operação + chave únicos, hash canônico do payload e run associado |
| Evento | ID, run, tentativa, sequência, tipo, versão e payload; `(run_id, sequence)` único |

Uma transação cria run, primeira tentativa, chave e evento inicial antes de responder ao POST. Restrição única no banco resolve submissões concorrentes; conflito de chave compara hash e devolve run existente ou `409`.

Atualização de estado e inserção de evento ocorrem na mesma transação. Serializar alterações por run com bloqueio ou controle otimista; transições inválidas e regressões de estados terminais são rejeitadas. O adaptador deduplica eventos recebidos com identidade estável da origem, cujo mecanismo precisa ser demonstrado no spike. Snapshot inclui sequência consistente com o estado.

O envio ao runtime ocorre após o commit. Não há transação distribuída entre PostgreSQL e runtime. A janela entre commit e envio exige recuperação de intenções pendentes; uma resposta perdida após envio exige consulta por identidade estável. Sem prova de não execução, marcar `unknown` e impedir retry cego. O mecanismo de despacho/recuperação será escolhido junto ao único proprietário de agendamento no ADR-001. Não anunciar entrega exatamente uma vez.

Eventos persistidos alimentam SSE e replay; registros de tracing não substituem eventos. Não adotar event sourcing completo: estado atual é armazenado junto ao histórico necessário ao produto.

### Isolamento e operação

- Cada leitura/escrita pública filtra o contexto autorizado. IDs imprevisíveis não substituem autorização.
- Runtime pode usar a mesma instância local, mas somente com schema e credencial próprios, sem acesso cruzado; agentes não recebem credenciais Nexus.
- Migrações versionadas e revisadas; testar aplicação sobre banco vazio e evolução do schema anterior. Mudanças destrutivas exigem migração e plano de recuperação explícitos.
- Não persistir segredos, tokens ou raciocínio privado. Inputs e outputs devem ser mínimos e sanitizados; fixtures usam apenas dados sintéticos.
- Foundation local mantém histórico até reset explícito. Reset é destrutivo e documentado no futuro setup; não executar automaticamente no startup. Antes de produção, definir retenção, exclusão, backups, restauração e objetivos de recuperação com evidência.
- Redis, banco vetorial, armazenamento de objetos e réplicas não são requisitos desta fase.

## Alternativas

Memória/SQLite não são a base escolhida por não representar o ambiente PostgreSQL previsto. Banco compartilhado sem isolamento viola ownership. Event sourcing completo e transação distribuída adicionam complexidade sem necessidade demonstrada.

## Consequências e validação

Persistência permite replay e auditoria básica, mas não assegura retomada do trabalho no runtime. Testes de integração devem cobrir concorrência de idempotência, atomicidade estado/evento, ausência de vazamento entre contextos e janelas de falha do despacho. Rever este ADR antes de múltiplas réplicas ou retenção automática.
