FROM node:24-bookworm-slim AS workspace

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --global "$(node -p 'require("./package.json").packageManager')" \
    && chown -R node:node /workspace

USER node
RUN pnpm install --frozen-lockfile

FROM workspace AS web

WORKDIR /workspace/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node apps/web/ ./
RUN pnpm build

ENV NODE_ENV=production
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]

FROM workspace AS api

WORKDIR /workspace/apps/api
COPY --chown=node:node apps/api/ ./
RUN pnpm build

ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
