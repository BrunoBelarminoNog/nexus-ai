# Nexus AI

Plataforma open source e code-first para disponibilizar, executar e observar agentes. IncidentLab é a demonstração com dados sintéticos.

## Estado atual

O repositório contém a fundação documental do EPIC-01. Aplicações, dependências, Compose e comandos de execução ainda não foram implementados. A Foundation prevista integra Console Next.js, Control Plane NestJS e runtime Python/Agno, começando por uma execução determinística.

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
