# ADR-001 — Runtime de agentes e fronteira de execução

- Status: aceito como direção arquitetural; integração e garantias dependem do spike.
- Data: 2026-11-09
- Escopo: NX-003 · Foundation
- Responsável: mantenedor do projeto

## Contexto

O [ADR-000](000-product-architecture-principles.md) separa produto e execução de IA. Precisamos integrar Python e TypeScript sem expor estruturas do framework aos clientes nem pressupor durabilidade não demonstrada.

## Decisão

Usar Agno para agentes Python e avaliar AgentOS como bootstrap em `apps/agent-runtime/`. Esse diretório contém configuração, composição e entrada do processo; agentes reutilizáveis ficam em `python/nexus-agents/` e a demonstração em `python/incidentlab/`. Não duplicar prompts e ferramentas no bootstrap.

O adaptador em `apps/api/` é a única fronteira com o runtime: envia identidade autorizada, `run_id`, `attempt_id`, versão imutável do agente e correlação, e normaliza resultados e erros. O navegador só consome a API Nexus. Transporte interno autenticado e versões exatas serão fixados pelo spike, antes da integração; este ADR não inventa endpoints AgentOS.

Existe exatamente um proprietário do agendamento. Preferir o mecanismo do runtime se os testes abaixo comprovarem as garantias mínimas. Caso contrário, registrar a escolha de um worker Nexus que invoque Agno como biblioteca, atualizar o C4 e manter apenas esse caminho ativo. Não adicionar Redis ou outro broker sem nova decisão.

A demo usa ferramenta e fixtures determinísticas sem credenciais de LLM. O modo com modelo real é separado e identificado. Código executado é confiável e versionado; upload e execução de código arbitrário estão fora do escopo.

## Gate de integração

Registrar em `docs/benchmarks/` versão do Python, Agno/AgentOS, lockfile, ambiente, comandos reproduzíveis, resultados e limitações para:

| Experimento | Resultado mínimo esperado |
|---|---|
| Submissão e consulta | Mapear intenção Nexus para identidade estável no runtime |
| Resposta perdida após envio | Consultar/reconciliar ou marcar resultado incerto; nunca reenviar cegamente |
| Repetição do comando | Demonstrar deduplicação ou impedir retry automático no adaptador |
| Desconexão do consumidor | Trabalho independente da conexão do navegador |
| Reinício durante execução | Identificar estado recuperável ou incerto; não alegar retomada sem evidência |
| Cancelamento e timeout | Distinguir solicitação, confirmação e capacidade indisponível |
| Falha de ferramenta/provider | Normalizar erro e preservar correlação sem expor segredos |
| Contexto inválido | Rejeitar chamada sem autenticação interna/contexto autorizado |

O registro deve escolher explicitamente o proprietário do agendamento e o transporte. Resultado negativo exige revisão deste ADR, não implementação simultânea de duas alternativas. O spike é entrega de implementação posterior ao EPIC-01.

## Alternativas

- Expor AgentOS ao Console: rejeitado por acoplar contratos e contornar autorização.
- Implementar framework próprio: rejeitado pelo custo anterior à validação do produto.
- Dois agendadores ativos: rejeitado por duplicar execução e ownership.

## Consequências

Há custo de adaptação e testes entre linguagens. Mudanças no framework ficam restritas à integração. Não garantimos execução exatamente uma vez, retomada automática ou cancelamento forte nesta etapa. Revisar quando o spike terminar ou mudar o proprietário da execução.
