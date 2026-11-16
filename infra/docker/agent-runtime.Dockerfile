FROM ghcr.io/astral-sh/uv:0.13.7 AS uv
FROM python:3.13-slim-bookworm

ENV UV_PYTHON_DOWNLOADS=never \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=uv /uv /usr/local/bin/uv
COPY apps/agent-runtime/pyproject.toml apps/agent-runtime/uv.lock apps/agent-runtime/README.md apps/agent-runtime/.python-version ./
COPY apps/agent-runtime/src/ ./src/
RUN uv sync --locked --no-dev --no-editable

USER 10001:10001
CMD ["/app/.venv/bin/python", "-m", "nexus_runtime.health"]
