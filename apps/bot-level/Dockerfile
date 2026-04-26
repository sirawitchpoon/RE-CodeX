# Re:CodeX bot-level. Same recipe as apps/api/Dockerfile, different CMD.
#   docker build -f apps/bot-level/Dockerfile -t recodex-bot-level .

FROM node:20-alpine AS deps
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

FROM deps AS build
COPY packages/ packages/
COPY apps/bot-level/ apps/bot-level/
RUN npx --workspace @recodex/db-points prisma generate \
 && npx --workspace @recodex/db-app    prisma generate

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl tini libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_NO_WARNINGS=1
COPY --from=build /app /app
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app
ENTRYPOINT ["/sbin/tini","--"]
CMD ["./node_modules/.bin/tsx","apps/bot-level/src/index.ts"]
