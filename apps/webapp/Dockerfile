FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/webapp/package.json apps/webapp/package.json
COPY libraries/core/package.json libraries/core/package.json
COPY libraries/core/tsconfig.json libraries/core/tsconfig.json
COPY libraries/core/src libraries/core/src

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/webapp apps/webapp

ENV NEXT_TEST_WASM_DIR=/app/node_modules/@next/swc-wasm-nodejs
RUN pnpm --filter @first2apply/core build
RUN pnpm --filter first2fetch-webapp build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3002

COPY --from=build /app/apps/webapp/.next/standalone/apps/webapp ./apps/webapp
COPY --from=build /app/apps/webapp/.next/standalone/node_modules ./node_modules
COPY --from=build /app/apps/webapp/.next/static ./apps/webapp/.next/static

EXPOSE 3002
CMD ["node", "apps/webapp/server.js"]
