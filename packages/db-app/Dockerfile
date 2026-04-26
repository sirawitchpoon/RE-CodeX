# One-shot migration runner for app-db. Sister to packages/db-points/Dockerfile.
#
#   docker build -f packages/db-app/Dockerfile -t recodex-migrate-app .

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
COPY packages/db-app/ packages/db-app/
ENV NODE_ENV=production
WORKDIR /app/packages/db-app
ENTRYPOINT ["/sbin/tini","--"]
CMD ["sh","-c","npx prisma migrate deploy --schema=prisma/schema.prisma"]
