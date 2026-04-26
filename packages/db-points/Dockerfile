# One-shot migration runner for points-db. Compose uses this as a separate
# init service that must complete before the API and bots start.
#
#   docker build -f packages/db-points/Dockerfile -t recodex-migrate-points .

FROM node:20-alpine
RUN apk add --no-cache openssl tini libc6-compat
WORKDIR /app
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/api/package.json            apps/api/package.json
COPY apps/bot-giveaway/package.json   apps/bot-giveaway/package.json
COPY apps/bot-level/package.json      apps/bot-level/package.json
COPY apps/web/package.json            apps/web/package.json
COPY packages/db-app/package.json     packages/db-app/package.json
COPY packages/db-points/package.json  packages/db-points/package.json
COPY packages/shared/package.json     packages/shared/package.json
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund
COPY packages/db-points/ packages/db-points/
ENV NODE_ENV=production
WORKDIR /app/packages/db-points
ENTRYPOINT ["/sbin/tini","--"]
# `migrate deploy` is idempotent (re-running is safe). The seed re-upserts
# the default Guild/LevelConfig/BrandingConfig from GUILD_ID env.
CMD ["sh","-c","npx prisma migrate deploy --schema=prisma/schema.prisma && npx prisma db seed"]
