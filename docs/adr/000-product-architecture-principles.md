# ADR-000 — Princípios de produto e arquitetura do Nexus AI

- Status: aceito para orientar o desenvolvimento inicial; implementação ainda não validada.
- Data: 8 de novembro de 2026.
- Escopo: Fase 01 — Foundation & First Execution (Foundation v0.1.0).
- Responsável: mantenedor do projeto.

## Contexto

O Nexus AI é uma plataforma open source e code-first para disponibilizar, executar e observar agentes. IncidentLab é a aplicação demonstrativa, baseada em incidentes sintéticos, e não deve definir os domínios do núcleo da plataforma.

A Fase 01 prova a integração vertical com um agente mínimo e uma ferramenta determinística. Ela não corresponde ao MVP completo com três agentes, catálogo e experiência de chat. A separação entre interface, controle do produto e execução de IA deve permitir testes independentes e evolução do runtime sem alterar contratos públicos.

## Decisão

Adotar três componentes de aplicação: Nexus Console (Next.js), Control Plane (NestJS) e Agent Runtime (Python/Agno). PostgreSQL e telemetria são serviços de suporte, não novos componentes de produto. O Control Plane começa como monólito modular. Agentes confiáveis são entregues por código versionado; nenhum código arbitrário é recebido pela interface.

### Responsabilidades e limites

| Componente | É responsável por | Não é responsável por |
|---|---|---|
| Nexus Console — Next.js | Página mínima para submeter e consultar execuções; estado visual; consumo de snapshot e SSE; reconexão e apresentação de erros | Autorizar acesso como autoridade final; acessar banco, runtime ou segredo de provider; interpretar tipos internos do Agno; executar agentes |
| Control Plane — NestJS | API pública e contratos; identidade e autorização; intenção e ID estável da execução; idempotência de submissão; persistência de estado público e eventos; snapshot e SSE; adaptador de runtime; correlação e erros de plataforma | Prompts, raciocínio, delegação entre agentes ou implementação de ferramentas; ler tabelas internas do Agno; manter um segundo agendador concorrente |
| Agent Runtime — Python/Agno | Executar agente, prompt e ferramenta; chamar provider quando habilitado; validar contexto interno autenticado; emitir resultados e eventos para normalização; aplicar limites de execução e cancelamento conforme capacidades comprovadas | Expor API pública ao navegador; confiar em workspace informado pelo cliente; administrar usuários e catálogo do Nexus; acessar diretamente o banco administrativo através do código dos agentes |

O adaptador do Control Plane traduz comandos e eventos entre contratos Nexus e runtime. Tipos do framework ficam dentro dessa fronteira. A implementação exata do transporte interno e da captura de eventos será fixada pelo spike; o contrato público permanece independente.

### Propriedade dos dados e execução

- O Control Plane é dono das intenções, estados públicos, eventos persistidos e projeções Nexus. Eventos são persistidos antes da entrega SSE; telemetria não substitui histórico de negócio.
- O runtime pode manter persistência interna própria, com schema e credencial separados. Compartilhar a instância PostgreSQL local não permite leitura cruzada das tabelas.
- Há exatamente um proprietário do agendamento. Se o runtime comprovar as garantias necessárias, o adaptador usa esse mecanismo; caso contrário, um worker Nexus invoca Agno como biblioteca. Não implantar as duas alternativas simultaneamente.
- A escolha acima depende de experimento reproduzível com versão fixada, cobrindo submissão ambígua, idempotência, consulta, desconexão, reinício e cancelamento. Este ADR não certifica capacidades nativas do Agno.

## Princípios obrigatórios

1. **Fronteiras explícitas:** interface apresenta; Control Plane governa; runtime executa IA. IncidentLab permanece substituível.
2. **Contratos primeiro:** HTTP, erros e eventos têm schemas versionados e validação entre TypeScript e Python.
3. **Segurança desde a fundação:** toda execução tem solicitante e contexto autorizado, inclusive na demo. Consultas e SSE verificam acesso; serviços internos e secrets não são expostos ao navegador.
4. **Identidade e versões estáveis:** execução mantém ID e versão exata do agente. Alterações não modificam runs existentes; retry de execução cria tentativa distinta.
5. **Falhas explícitas:** distinguir falha de plataforma, provider e ferramenta. Resultado incerto não autoriza ressubmissão cega; solicitar cancelamento não significa confirmar interrupção.
6. **Independência do cliente:** fechar conexão não cancela trabalho. Snapshot e eventos persistidos permitem retomar acompanhamento sem duplicar apresentação de resultados.
7. **Garantias verificáveis:** reconexão do navegador não equivale a recuperação após queda do worker. Só anunciar durabilidade, isolamento ou disponibilidade sustentados por testes.
8. **Observabilidade segura:** correlacionar requisição, execução e tentativa; redigir dados sensíveis. Falha de tracing não altera o resultado de negócio. Exibir ações e evidências, nunca raciocínio privado.
9. **Reprodução e testabilidade:** demo determinística sem chave de LLM, explicitamente identificada, ambiente local documentado e dependências fixadas. Modelo real é modo separado.
10. **Complexidade incremental:** infraestrutura adicional exige necessidade demonstrada. Evidências ausentes e custos desconhecidos não são inventados; dados e dependências devem permitir redistribuição lícita.
11. **Efeitos controlados:** ferramentas da fase são sintéticas. Efeitos externos futuros exigirão política explícita de autorização, idempotência e tratamento de resultado incerto.

## Delimitação da Fase 01

| Incluído | Evidência esperada para encerrar a fase |
|---|---|
| Fundação do monorepo, três aplicações e contratos | Build e verificações documentados |
| Compose, PostgreSQL, migrações e configuração local | Instalação limpa reproduzível |
| Um agente IncidentLab e uma ferramenta determinística | Execução sem credenciais de provider com resultado verificável |
| Submissão, consulta, autorização e idempotência | ID persistido; repetição da mesma intenção não cria outra execução; acesso cruzado negado |
| Eventos normalizados, snapshot e SSE | Desconexão não encerra execução; reconexão recupera estado sem duplicação |
| Erros e observabilidade básica | Falha simulada da ferramenta identificada e correlacionada à execução |
| Spike do runtime | Versão, comandos, resultados, limitações e decisão sobre proprietário da execução registrados |
| Documentação e integração automatizada | Jornada ponta a ponta e limitações demonstráveis |

### Fora desta fase

- Dashboard completo, design system completo, chat e catálogo completos; equipe de três agentes e demais especialistas do IncidentLab: evolução do MVP.
- Garantia de retomada automática após queda de worker, múltiplas réplicas, fencing, reconciliação operacional completa e alta disponibilidade: etapa de resiliência. O spike investiga essas capacidades, sem torná-las entregas prontas.
- Registry publicável, pipeline de publicação e SDK externo: evolução da plataforma; fixar a versão do agente usado na fase continua obrigatório.
- Aprovações humanas, RBAC ampliado, quotas comerciais e avaliações comparativas multiagente: etapas posteriores. Autorização básica, timeouts e limites locais continuam necessários.
- Editor visual, código enviado pelo navegador, marketplace, billing, colaboração simultânea e multi-tenancy comercial.
- RAG e banco vetorial, múltiplos runtimes simultâneos, autenticação corporativa, cloud/Terraform e autoescalabilidade avançada.
- Comandos ou remediação em infraestrutura real. Recomendações do IncidentLab não executam mudanças.

## Alternativas consideradas

| Alternativa | Motivo para não adotar inicialmente |
|---|---|
| Backend único em Python | Reduz integração inicial, mas não preserva a fronteira de produto TypeScript escolhida para o Nexus |
| Navegador consumindo AgentOS diretamente | Acopla UI ao framework e contorna a autoridade do Control Plane |
| Microserviços por domínio | Aumenta operação antes de existir necessidade de escala ou autonomia |
| Dois mecanismos de fila/agendamento | Divide ownership e cria risco de execuções duplicadas |
| Implementar MVP completo antes da integração mínima | Amplia escopo sem validar os contratos e capacidades do runtime |

## Consequências

Há custo adicional de integração entre linguagens, contratos e processos. Em troca, a interface e as regras de produto ficam isoladas do framework de agentes. O adaptador exige testes de compatibilidade; armazenamento de eventos exige política de retenção posterior. A fase entrega evidências de integração, não prontidão de produção. Um resultado negativo do spike pode alterar a implementação interna da execução sem mudar estas responsabilidades.

## Revisão e decisões pendentes

Revisar este ADR quando mudar a fronteira de confiança, o proprietário da execução, o modelo de publicação ou o escopo da fase. Registrar escolhas de runtime/durabilidade, identidade, persistência de eventos e observabilidade em ADRs específicos. A sequência documental do EPIC-01 é ADR-001 (runtime), ADR-002 (contratos) e ADR-003 (persistência). Identidade e observabilidade terão decisões específicas quando detalhadas na implementação.

## Referências e precedência

Os planos de produto e implementação citados na elaboração original não estão versionados neste repositório. O escopo vigente e revisável está registrado neste ADR; não depende de links locais ausentes.

- [Runtime](001-agent-runtime.md): integração e gate de validação.
- [Contratos](002-contracts-and-api.md): API, eventos e compatibilidade.
- [Persistência](003-persistence.md): ownership e consistência.
- [Convenções do repositório](../architecture/repository-conventions.md): estrutura obrigatória.
- [C4 Context](../architecture/c4-context.md) e [C4 Container](../architecture/c4-container.md): vistas da arquitetura proposta para esta fase.

Este ADR consolida os princípios e limites da fase; não constitui evidência de implementação nem substitui os gates técnicos.
