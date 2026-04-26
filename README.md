# Re:CodeX

VTuber-themed Discord bot platform for an idol-style server. Two bots
(Giveaway + Level), one REST/SSE API, one React backoffice — all in one
Docker stack ready to drop on a VPS.

The fan community is called **Signals** and the level currency is **EXP**.
Both labels are stored in `BrandingConfig` and rendered through a single
helper, so renaming them server-wide is a config change — no code edits.

## Architecture

```
                          ┌─────────────┐
   browser ──TLS──▶ Caddy ─┤  /          │──▶ web (nginx serving dist/)
                          │  /api/*     │──▶ api (Express)
                          │  /uploads/* │──▶ api (static files)
                          │  /api/events/* │──▶ api (SSE, flush -1)
                          └──────┬──────┘
                                 │
                ┌────────────────┼─────────────────┐
                ▼                ▼                 ▼
         ┌────────────┐   ┌────────────┐    ┌────────────┐
         │ bot-       │   │ bot-level  │    │ api        │
         │ giveaway   │   │ (XP grants,│    │ (REST +    │
         │ (button +  │   │  /rank,/lb)│    │  multipart │
         │  modal)    │   │            │    │  + SSE)    │
         └─────┬──────┘   └─────┬──────┘    └─────┬──────┘
               │                 │                 │
               ├─────────────────┼─────────────────┤
               ▼                 ▼                 ▼
       ┌────────────┐    ┌────────────┐    ┌────────────┐
       │ points-db  │    │  app-db    │    │   Redis    │
       │ (postgres) │    │ (postgres) │    │ (cool+pub) │
       │ XP/Signals │    │ Giveaway / │    │            │
       │ — backup!  │    │ Logs / Bot │    │            │
       └────────────┘    └────────────┘    └────────────┘
```

**Why two Postgres containers?** The points data (XP, levels, role
rewards, branding) lives in `points-db` so schema migrations on giveaway
or log features can never put it at risk. Backups for `points-data` and
`app-data` are handled separately, with the points volume being the
high-value one.

**Why SSE not WebSocket?** All realtime is server→client. SSE survives
Caddy/HTTP/2 with `flush_interval -1` and needs no sticky sessions.

**Why bots write Postgres directly?** Hot path latency. `messageCreate`
shouldn't pay an HTTP round-trip on every grant. Both bots and the API
import the same Prisma clients from `packages/db-{points,app}`.

## Repo layout

```
apps/
  web/                React + Vite SPA (backoffice handed off from claude design)
  api/                Express + SSE + multipart
  bot-giveaway/       discord.js v14 — button + 4-field modal + announce
  bot-level/          discord.js v14 — XP grants + /rank + /leaderboard
packages/
  db-points/          Prisma schema for the high-value DB (Guild, User,
                      BrandingConfig, LevelConfig, RoleReward, XpEvent, XpTotal)
  db-app/             Prisma schema for app DB (Giveaway, GiveawayEntry, Log,
                      BotInstance) — references points via plain String columns
  shared/             level math (xpForLevel/levelForXp/progressToNext),
                      Redis channel/payload contract, branding renderLabel()
infra/
  caddy/Caddyfile
  compose/docker-compose.yml
  compose/.env.example
```

## Local dev (without Docker)

Bring up just the datastores in compose, run the apps natively for fast HMR:

```bash
# 1. Datastores
docker compose -f infra/compose/docker-compose.yml up -d points-db app-db redis

# 2. .env files for each service (copy + fill in tokens)
cp apps/api/.env.example apps/api/.env || true
cp apps/web/.env.example apps/web/.env
# create apps/bot-giveaway/.env, apps/bot-level/.env (see "Required env" below)

# 3. Install + generate Prisma clients
npm install
npm run prisma:generate
npm run prisma:migrate
GUILD_ID=<your-guild-id> npm run prisma:seed

# 4. Run each service in its own terminal
npm run dev:api          # http://localhost:3000
npm run dev:web          # http://localhost:5173
npm run dev:bot-giveaway
npm run dev:bot-level
```

## Production (Docker on VPS)

```bash
cd /path/to/RE-Code-X
cp infra/compose/.env.example .env
$EDITOR .env             # fill EVERY blank value

docker compose --env-file .env -f infra/compose/docker-compose.yml up -d --build
docker compose -f infra/compose/docker-compose.yml ps
```

Expected status:
- `points-db` healthy, `app-db` healthy, `redis` healthy
- `migrate-points` exited 0, `migrate-app` exited 0
- `api` healthy, `bot-giveaway` Up, `bot-level` Up
- `web` Up, `caddy` Up

Then:
- `https://<CADDY_DOMAIN>/` → SPA loads
- `https://<CADDY_DOMAIN>/api/health` → `{ok:true,pointsDb:true,appDb:true,redis:true,...}`
- Both bots online in Discord; `/rank` and `/leaderboard` available

## Required env

See `infra/compose/.env.example` for the full list. The non-defaultable ones:

| Var | Where to get it |
| --- | --- |
| `GUILD_ID` | Discord → enable Developer Mode → right-click your server → Copy Server ID |
| `GIVEAWAY_BOT_TOKEN`, `GIVEAWAY_BOT_APP_ID` | Discord Developer Portal → Application → Bot → Token / General → Application ID |
| `LEVEL_BOT_TOKEN`, `LEVEL_BOT_APP_ID` | Same, second application |
| `POINTS_DB_PASSWORD`, `APP_DB_PASSWORD` | Generate two strong passwords |
| `CADDY_DOMAIN` | Your domain (or `:80` for LAN/dev) |

## Discord setup checklist

For each of the **two** Bot applications in the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Bot tab** → reset/copy token. Toggle ON:
   - **MESSAGE CONTENT INTENT** (bot-level needs message length)
   - **SERVER MEMBERS INTENT** (bot-level needs to add roles on level-up)
   - **PRESENCE INTENT** (optional — for online/idle/offline display)
2. **OAuth2 → URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Permissions for **bot-giveaway**: `Send Messages`, `Embed Links`, `Attach Files`, `Use External Emojis`, `Read Message History`
   - Permissions for **bot-level**: above + `Manage Roles`, `Read Messages/View Channels`, `Add Reactions`
3. Open the generated URL → invite the bot to your server.
4. Make sure the bot's role sits **above** every role it needs to assign in the role list (Discord can't grant a role higher than its own).

Slash commands (`/rank`, `/leaderboard`) register guild-scoped on bot-level boot — they appear in the slash menu within ~60 seconds.

## Smoke test

After `docker compose up -d`:

1. `curl https://<domain>/api/health` → JSON with all `true`
2. Open the SPA → all pages navigate
3. Post a >4-char message in a non-excluded channel → `XpTotal.totalXp` grows; `/rank` reflects it
4. Insert a `RoleReward` at level 1 (POST `/api/level/<guildId>/role-rewards`) → keep posting until level crosses → bot adds the role
5. From the backoffice Giveaway page: create + publish → bot posts the embed with the **เข้าร่วม Giveaway** button
6. Click the button in Discord → 4-field modal → submit → ephemeral confirmation → entry appears in the backoffice
7. Click `สุ่มผู้โชคดี` then `ประกาศใน Discord` → bot replies in-channel with mentions
8. `psql` into `points-db` and `UPDATE "BrandingConfig" SET "signalsLabel"='Stardust', "xpLabel"='Aether'` → next `/rank` and next published embed use the new labels

## Backups

The two databases are backed up independently — the whole point of the
split. From the host:

```bash
# points-db (HIGH VALUE — back up frequently)
docker compose exec -T points-db pg_dump -U recodex_points recodex_points \
  | gzip > points-$(date +%F-%H%M).sql.gz

# app-db (regenerable from Discord interactions if lost)
docker compose exec -T app-db pg_dump -U recodex_app recodex_app \
  | gzip > app-$(date +%F-%H%M).sql.gz

# uploads volume (cover images)
docker run --rm -v recodex_uploads:/src -v "$PWD":/dst alpine \
  tar czf /dst/uploads-$(date +%F-%H%M).tgz -C /src .
```

## Renaming Signals / EXP

```sql
-- points-db
UPDATE "BrandingConfig"
SET "signalsLabel" = 'Stardust',
    "xpLabel"      = 'Aether',
    "currencyEmoji"= '⭐',
    "accentColor"  = '#ffd166'
WHERE "guildId" = '<your-guild-id>';
```

The change shows up:
- on the next `/rank` and `/leaderboard` reply
- on the next published Giveaway embed
- in the `/api/branding/<guildId>` response (backoffice can read this to retitle UI text too)

## Auth

Not shipped this round (LAN/dev per scope). The swap point is
[apps/api/src/middleware/auth.ts](apps/api/src/middleware/auth.ts) — it's a
no-op middleware mounted on every `/api/*` route. Replace its body with
JWT, Discord OAuth, or basic-auth and every endpoint stays untouched.

When moving past LAN, at minimum add `basicauth` in the Caddyfile on
`/api/*`:

```caddy
@api path /api/*
basicauth @api {
  admin <bcrypt-hash>
}
reverse_proxy @api api:3000
```

## License

Private project — all rights reserved.
