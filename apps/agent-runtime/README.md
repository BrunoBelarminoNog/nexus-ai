# Agent Runtime

Pacote Python que servirá como ponto de entrada do processo de execução de agentes do Nexus AI. O bootstrap da NX-007 oferece uma CLI que confirma a inicialização do pacote e encerra com código `0`.

## Configuração e validação

Instale o [uv 0.13.7](https://docs.astral.sh/uv/getting-started/installation/). O arquivo `.python-version` seleciona Python 3.13 e permite atualizações de patch dessa série. O uv pode instalar o interpretador e cria a `.venv` dentro do projeto.

Na raiz do monorepo, execute:

```sh
cd apps/agent-runtime
uv --version
uv python install
uv lock --check
uv sync --locked
uv run --locked python --version
uv run --locked nexus-runtime
uv build
```

O comando `nexus-runtime` deve imprimir `Nexus AI Agent Runtime bootstrap OK`. O build gera o wheel e a distribuição de código-fonte em `dist/`.

## Organização

O `pyproject.toml` declara o pacote, a versão do Python e a CLI. O `uv.lock` registra a resolução do projeto. Use `uv lock` para atualizá-lo ao mudar dependências e `uv sync --locked` para reproduzir a resolução registrada.

`src/nexus_runtime/main.py` é o ponto de entrada para a futura composição do processo. A integração com Agno e a avaliação de AgentOS entram no [spike do runtime](../../docs/adr/001-agent-runtime.md). Agentes e ferramentas reutilizáveis ficam em pacotes separados sob `python/`.
