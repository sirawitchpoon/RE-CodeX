# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo shape

npm workspaces monorepo, Node ≥20, TypeScript ESM (`"type": "module"`, `module: NodeNext`).

```
apps/
  api/            Express + SSE + multipart uploads
  web/            React 18 + Vite SPA (JSX, no TS)
  bot-giveaway/   discord.js v14 — multi-step button flow (no modals for entry)
  bot-level/      discord.js v14 — XP grants + /rank + /leaderboard
packages/
  db-points/      Prisma schema for the high-value DB (XP, branding, level config, GiveawayMember, UserMain)
  db-app/         Prisma schema for app DB (giveaways, logs, bot status, admin users)
  shared/         level math, Redis channel/payload contract, branding renderLabel()
infra/
  compose/docker-compose.yml   stack (2× postgres + redis + 4× services + caddy + migrators)
  caddy/Caddyfile              TLS + SSE-aware reverse proxy
```

## Commands

Run from repo root:

```bash
# Datastores only (apps run natively for HMR)
docker compose -f infra/compose/docker-compose.yml up -d points-db app-db redis

# One-time setup
npm install
npm run prisma:generate                # both db packages
npm run prisma:migrate                 # deploy migrations to both DBs
GUILD_ID=<id> npm run prisma:seed      # seeds points-db (Guild + BrandingConfig + LevelConfig)

# Dev (each in its own terminal — uses `tsx watch --env-file=.env`)
npm run dev:api          # http://localhost:3000
npm run dev:web          # http://localhost:5173
npm run dev:bot-giveaway
npm run dev:bot-level

# Build everything (typecheck + emit dist/)
npm run build

# Per-workspace (pattern: npm --workspace <name> run <script>)
npm --workspace @recodex/api run build
npm --workspace @recodex/db-points run prisma:migrate:dev   # creates a new migration
npm --workspace @recodex/db-points run prisma:studio
npm --workspace @recodex/bot-level run register-commands    # re-register slash commands

# Full prod stack
docker compose --env-file .env -f infra/compose/docker-compose.yml up -d --build

# Seeders (compose profile "seed", run on demand)
docker compose --env-file .env -f infra/compose/docker-compose.yml \
  --profile seed run --rm seed-admin     # upserts AdminUser from .env (rotate password by re-running)
docker compose --env-file .env -f infra/compose/docker-compose.yml \
  --profile seed run --rm seed-sample    # 3 sample giveaways for UI preview
```

There is no test runner wired up — verify changes by running the **Smoke test** section in `README.md`. It walks 18 numbered steps: health + XP (1–4), giveaway end-to-end main-pick flow (5–12), live config / branding (13–15), and post-audit security checks (16–18: token redaction, per-IP lockout, draw idempotency). Run them top-to-bottom against a real Discord guild after `docker compose up -d --build` and the first `seed-admin`.

## Architecture

### Two-database split — non-negotiable

`points-db` owns XP/levels/branding **plus the cast roster (`GiveawayMember`) and per-user oshi pick (`UserMain`)**; `app-db` owns giveaways/logs/admin/bot status. References across the boundary are **soft FKs** (plain `String` columns, joined in app code) — `GiveawayEntry.memberId` in app-db points at `GiveawayMember.id` in points-db, joined in handlers like `routes/giveaways.ts:GET /giveaways/:id/entries`. Schema migrations on app features must never touch points-db. Each has its own one-shot `migrate-*` compose service, its own Prisma package, its own backup target. Don't add a relation across the boundary; if app-db needs more user info, fetch via `pointsPrisma.user.findMany` (or `pointsPrisma.giveawayMember.findMany`).

### Bots write Postgres directly

The hot path (`messageCreate` → XP grant) cannot afford an HTTP hop. Both bots import `pointsPrisma`/`appPrisma` from `@recodex/db-{points,app}` and write directly. The API is *not* in the request path for XP grants or giveaway entries. The single writer for XP is `apps/bot-level/src/grant.ts` — it wraps insert + upsert + level recompute in one Prisma transaction so `XpEvent` and `XpTotal` cannot disagree.

### Redis pub/sub → SSE fan-out

All cross-service realtime flows through Redis channels declared in `packages/shared/src/events.ts` (`CHANNELS` const + `EventPayloadMap` types). Producers: bots and API publish via `pub`. The API subscribes to every channel at boot (`apps/api/src/index.ts`) and the SSE hub (`apps/api/src/sse.ts`) fans each one out to the SSE topics that want it. Topic→channel routing lives in `TOPIC_CHANNELS` — add a topic by extending that map. SSE uses `flush_interval -1` in Caddy and `X-Accel-Buffering: no`; do not add buffering middleware on `/api/events/*`.

When you add a new event:
1. Add the channel name + payload type + entry in `EventPayloadMap` in `packages/shared/src/events.ts`.
2. Producer calls `pub.publish(CHANNELS.X, encodeEvent(CHANNELS.X, payload))`.
3. If a frontend page should see it, add the channel to `TOPIC_CHANNELS` in `apps/api/src/sse.ts`.
4. Frontend subscribes via `useSSE("/api/events/<topic>", { [CHANNELS.X]: handler })` from `apps/web/src/api.js`.

### Bot config cache invalidation

Two TTL caches follow the same pattern (60s, per-guild Map, Redis-driven invalidation):

- `bot-level/src/configCache.ts` caches `LevelConfig` + `RoleReward[]`. API publishes `LEVEL_CONFIG_CHANGED` on `PUT /level/:guildId/config`; `bot-level/handlers/configChange.ts` invalidates.
- `bot-giveaway/src/membersCache.ts` caches `GiveawayMember[]`. API publishes `MEMBERS_CHANGED` on every mutation in `routes/members.ts`; `bot-giveaway/handlers/membersChanged.ts` invalidates. Use `findMember(guildId, memberId)` — it does a cold-miss reload before giving up, which avoids a "deleted member, then re-created with new id" race.

Any new mutating endpoint that changes XP rules must publish `LEVEL_CONFIG_CHANGED`; any change to GiveawayMember must publish `MEMBERS_CHANGED`.

### Giveaway entry flow (multi-step buttons)

The LIVE embed (`bot-giveaway/src/embed.ts`) shows two buttons — **เข้าร่วม** (`gw:join:<gid>`, Primary) and **แก้ไขข้อมูล** (`gw:edit:<gid>`, Secondary). All entry data is collected via subsequent button clicks + one optional modal; the old 4-field modal is gone. The flow lives in `bot-giveaway/src/handlers/`:

```
embed buttons (button.ts) → eligibility check → ephemeral with 6 main buttons
  → gw:pickmain:<gid>:<mode>:<memberId>  (pickmain.ts step 1 → step 2)
  → gw:contact:<gid>:<mode>:<memberId>:discord   (commit, contactType=DISCORD)
  → gw:contact:<gid>:<mode>:<memberId>:other     (showModal)
  → gw:contactmodal:<gid>:<mode>:<memberId>      (commit, contactType=OTHER)
```

`<mode>` is `n` (new entry, customId emitted by `gw:join`) or `e` (edit existing, emitted by `gw:edit`). The mode flag is **state passed through customIds** — Discord interactions don't share server-side state across clicks, so anything the commit step needs (giveawayId, memberId, mode, contactValue) must be encoded in the customId or modal field.

Commit lives only in `pickmain.ts:commitEntry` — it does role swap (remove old main role, add new) → `pointsPrisma.userMain.upsert` → `appPrisma.giveawayEntry.create|update` → publish `GIVEAWAY_ENTRY` → log. Role failures are logged but never block the entry — admin can fix role hierarchy after the fact.

`bot-giveaway` requires the **`GuildMembers` privileged intent** (Discord Dev Portal toggle) to fetch the user's GuildMember and call `roles.add/remove`. Don't drop this intent or the role swap silently no-ops.

### Giveaway draw / contact

`GiveawayEntry` has `contactType ContactPreference` (DISCORD|OTHER) + nullable `contactValue`. Winners are drawn uniformly from one pool — `services/giveawayDraw.ts:drawWinners` is a Fisher-Yates over `crypto.randomInt` (the `rng` option takes `maxExclusive` directly, no divide-then-floor; this dodges the modulo-bias the old `Math.random` version had and makes the result unpredictable to anyone observing the PRNG state). Member pick is fan-club flavor only; it does not affect draw odds. The announce handler mentions winners by `<@userId>`; the backoffice DrawModal additionally shows each winner's contact so the admin knows where to deliver the prize.

### Giveaway lifecycle guards (don't loosen these)

- `POST /giveaways/:id/draw` runs `read existing winners → pick → mark → enqueue WINNER_MARK outbox rows` inside one Prisma `$transaction`. If winners already exist on a re-fire it returns the same set (idempotent) instead of pulling a second batch from the remaining pool. It also rejects when `status === "CANCELLED"`. **Don't move the existing-winner check outside the transaction** — two simultaneous calls would both pass it and double-draw, and would also double-enqueue Sheets writes.
- `DELETE /giveaways/:id` returns 409 `live_cannot_delete` when `status === "LIVE"` — its Discord embed is still in chat accepting button presses and the bot has no signal to clean it up. The admin must End or Cancel first; those flows publish `GIVEAWAY_EDIT` / `GIVEAWAY_CANCEL` so the bot updates the embed.

### Google Sheets sync (outbox pattern)

Every `GiveawayEntry` write (in `pickmain.ts:commitEntry`) and every winner mark (in `routes/giveaways.ts` draw handler) inserts an `EntrySyncOutbox` row in the **same `$transaction`** as the entry/winner change. A background worker in the API (`services/sheetsWorker.ts`, `setInterval` 10s) drains PENDING rows and POSTs to a Google Apps Script Web App that mirrors them into a Spreadsheet (1 tab per giveaway + a master `Winners` tab). Setup lives in `infra/sheets/` (`Code.gs` + `README.md`).

Invariants:

- The outbox insert **must** stay in the same transaction as the entry/winner write. If you split them, a process crash between the two leaves the source of truth (Postgres) holding a row that will never reach Sheets — the whole point of the outbox is "DB success ⇔ enqueue success."
- Producers write the outbox; the **only** consumer is `sheetsWorker.ts`. Don't add another drainer or rows will be POSTed twice.
- Apps Script dedupes by `outboxId` via `PropertiesService`, so retries from the worker are safe (at-least-once delivery → exactly-once landing).
- The worker is opt-in: when `SHEETS_WEBHOOK_URL` or `SHEETS_WEBHOOK_TOKEN` is unset it stays asleep and outbox rows accumulate. They drain as soon as the env is configured — zero data loss during the gap.
- Backoff schedule (10s → 1m → 5m → 15m → 30m → 1h → 2h → DEAD after 8 attempts) is in `BACKOFF_MS`. DEAD rows are visible at `GET /api/giveaway/sync-status` and re-queueable via `POST /api/giveaway/sync-status/retry` (also wired to the small status pill on the Giveaway backoffice page).

### Branding (`Signals` / `EXP` rename)

Labels are read from `BrandingConfig` per guild and rendered through `renderLabel(template, branding)` from `@recodex/shared`. Use placeholders `{signals}`, `{xp}`, `{emoji}`, `{accent}` in any user-visible string. Bot embeds and `/rank` replies must go through this helper so an admin can rename server-wide via SQL/UI without code changes.

### Auth

JWT (HS256, `JWT_SECRET`). Middleware: `apps/api/src/middleware/auth.ts`. `PUBLIC_PATHS` whitelist (`/health`, `/auth/login`) is the only bypass. SSE clients pass the token via `?token=` because EventSource can't set headers — the middleware checks both the `Authorization` header and the query param.

Brute-force protection lives in `routes/auth.ts` and uses **two Redis SETEX buckets in parallel**:

- `auth:fails:user:<lowercase-username>` — 5 fails / 15 min. Stops single-account brute force fast.
- `auth:fails:ip:<req.ip>` — 20 fails / 15 min. Stops attackers who rotate usernames to dodge the user bucket; threshold is higher so a shared NAT egress (office, mobile carrier) doesn't lock out legit users when one teammate fat-fingers.

Either bucket tripping responds 429. On success only the user bucket is cleared — keeping the IP counter prevents an attacker who happens to know one valid credential from resetting their per-IP score.

Because the API runs behind Caddy, `apps/api/src/index.ts` calls `app.set("trust proxy", 1)` so `req.ip` reflects the real client. Don't drop that line or per-IP lockout breaks.

`pinoHttp` redacts the JWT before it reaches access logs:
- A custom `req` serializer rewrites `?token=…` in the URL to `?token=[REDACTED]`.
- `redact: { paths: ['req.headers.authorization', 'req.headers.cookie'] }` censors the header form.

The auth scheme is intentionally swappable: replace `signToken` / `jwt.verify` to move to Discord OAuth without touching route files.

The frontend gates the entire SPA behind `<Login/>` whenever `API_ENABLED` (i.e. `VITE_API_BASE` set). Mock-only mode (no `VITE_API_BASE`) skips auth so the design preview works.

### Frontend mock fallback

`apps/web/src/api.js` exposes `useApiOrFallback(path, mock)` — pages render with the mock from `data.js` synchronously, then swap to live data on success. On API failure they keep the mock so the UI never crashes mid-design. Don't remove this pattern; it's how the design preview works without a backend running.

### Prisma client output location

Both `packages/db-*/prisma/schema.prisma` set `output = "../src/_prisma"` (gitignored). This is intentional — Node's strict ESM resolver rejects the default `node_modules/.prisma/...` path under `module: NodeNext`. Don't change `output` back to default; do run `npm run prisma:generate` after pulling schema changes.

## Conventions

- TypeScript strict mode + `noUncheckedIndexedAccess` (see `tsconfig.base.json`). Index access returns `T | undefined`.
- Env validation via Zod at boot (`apps/*/src/env.ts`). Misconfiguration must surface at boot, not at first request — add new env vars to the schema, not as ad-hoc `process.env.X`.
- Pino for structured logging in all Node services. `pino-pretty` in dev; SSE endpoints opt out of `autoLogging` to avoid noise.
- Discord-facing handlers register against the client in `apps/bot-*/src/handlers/*` and are wired in `index.ts`. Each handler module exports a `register*(client)` function; follow the pattern when adding new ones.
- Web is plain JSX (no TS). Pages live in `apps/web/src/pages/` and route via the `PAGES` map in `App.jsx` (string keys, not react-router).
- The fan community label is "Signals" and the XP unit is "EXP" — both are config, not constants. Don't hardcode them anywhere user-visible.
- The 6 cast members (admin-managed via Giveaway → Members backoffice page → `GiveawayMember` rows in points-db) are also config, not constants — never hardcode names like AL/Zerozu/Wataru/Rei/Baobei/Iw or roleIds anywhere. The bot reads them via `membersCache`; the SPA reads via `useGiveawayMembers()`.
- Naming collision: `apps/web/src/pages/Members.jsx` is the **XP roster** (server-wide member list); `GiveawayMembers.jsx` is the **cast admin** (the 6 oshi). PAGES key is `gw-members`. Don't merge them.

## Caddy / SSE gotcha

`infra/caddy/Caddyfile` has a dedicated `@events` matcher with `flush_interval -1` and `read_timeout 24h`. Anything under `/api/events/*` must keep this routing or SSE will buffer/timeout in production. New SSE topics should mount under that prefix.
