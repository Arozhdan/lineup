# ---------- build stage ----------
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY apps/web apps/web
RUN pnpm --filter @lineup/server build && pnpm --filter @lineup/web build

# Production node_modules for the server only.
RUN pnpm --filter @lineup/server --prod deploy --legacy /out/server

# ---------- runtime stage ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /out/server/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/migrations ./migrations
COPY --from=build /app/apps/web/dist ./web

ENV PORT=3000 \
    DATABASE_URL=file:/data/lineup.db \
    UPLOAD_DIR=/data/uploads \
    WEB_DIST=/app/web

VOLUME /data
EXPOSE 3000
CMD ["node", "dist/index.js"]
