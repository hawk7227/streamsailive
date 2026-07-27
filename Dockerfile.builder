FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       chromium \
       git \
       openssh-client \
       python3 \
       make \
       g++ \
       curl \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# The repository lockfile currently trails package.json. Railway must be able to
# resolve the declared dependencies while the canonical lockfile is regenerated.
RUN pnpm install --no-frozen-lockfile

COPY . .

RUN mkdir -p /workspace \
    && chown -R node:node /app /workspace /ms-playwright

USER node

ENV STREAMS_PERSISTENT_WORKSPACE_ROOT=/workspace \
    STREAMS_WORKER_PORT=8080

EXPOSE 8080

CMD ["node", "scripts/streams-builder-worker.mjs"]