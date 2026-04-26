# Re:CodeX API — built from the repo root. Workspace deps need a single
# `npm install` at the root for symlink hoisting.
#
#   docker build -f apps/api/Dockerfile -t recodex-api .

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
COPY apps/api/ apps/api/
RUN npx --workspace @recodex/db-points prisma generate \
 && npx --workspace @recodex/db-app    prisma generate

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl tini libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_NO_WARNINGS=1
COPY --from=build /app /app
RUN addgroup -S app && adduser -S app -G app && \
    mkdir -p /data/uploads && chown -R app:app /data /app
USER app
EXPOSE 3000
ENTRYPOINT ["/sbin/tini","--"]
CMD ["./node_modules/.bin/tsx","apps/api/src/index.ts"]
