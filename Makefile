.PHONY: lint-python typecheck-python check-python

# Standalone quality tools run in isolated uv environments.
# Keep versions here so local commands and CI use the same tools.
lint-python:
	cd apps/agent-runtime && uvx --python 3.13 ruff==0.14.4 check .
	cd apps/agent-runtime && uvx --python 3.13 ruff==0.14.4 format --check .

typecheck-python:
	cd apps/agent-runtime && uvx --python 3.13 mypy==1.18.2 --python-executable .venv/bin/python

check-python: lint-python typecheck-python
