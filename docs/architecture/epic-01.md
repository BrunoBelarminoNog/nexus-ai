# EPIC-01 — Architecture & Documentation

Status: entregáveis documentais concluídos localmente em 2026-11-09. Sujeitos à revisão e merge pelo mantenedor; não indica fechamento de issues no GitHub nem conclusão da implementação Foundation.

| Item | Evidência | Critério documental atendido |
|---|---|---|
| NX-001 | [ADR-000](../adr/000-product-architecture-principles.md) | Princípios, escopo, responsabilidades e consequências explícitos |
| NX-002 | [Context](c4-context.md) e [Container](c4-container.md) | Pessoas, sistemas, unidades, tecnologias, relações e fronteiras de confiança |
| NX-003 | [Runtime](../adr/001-agent-runtime.md), [Contratos](../adr/002-contracts-and-api.md), [Persistência](../adr/003-persistence.md) | Decisões, alternativas, ownership e limites documentados |
| NX-004 | [Convenções](repository-conventions.md) | Estrutura obrigatória, dependências, nomes, contribuição, testes e governança |

## Gates posteriores de implementação

1. Executar spike do runtime e fixar versão, transporte, autenticação interna e único proprietário de agendamento.
2. Implementar identidade/autorização, schemas, geração, idempotência e replay conforme ADR-002.
3. Criar migrações, isolamento e recuperação de intenções conforme ADR-003.
4. Materializar bootstrap do monorepo, Compose e checks de CI conforme as convenções.

Esses gates não são capacidades já entregues nem pendências ocultas do escopo documental. Evidências de execução e comandos reais devem ser adicionados quando houver implementação.
