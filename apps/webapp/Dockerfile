FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/webapp/package.json apps/webapp/package.json
COPY libraries/core/package.json libraries/core/package.json
COPY libraries/core/tsconfig.json libraries/core/tsconfig.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY libraries/core/src libraries/core/src
COPY apps/webapp apps/webapp

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_TEST_WASM_DIR=/app/node_modules/@next/swc-wasm-nodejs
RUN pnpm --filter @first2apply/core build
RUN pnpm --filter first2fetch-webapp build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3002
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=build --chown=node:node /app/apps/webapp/.next/standalone/apps/webapp ./apps/webapp
COPY --from=build --chown=node:node /app/apps/webapp/.next/standalone/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/webapp/.next/static ./apps/webapp/.next/static

USER node
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3002/api/health', {signal: AbortSignal.timeout(4000)}).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "apps/webapp/server.js"]
