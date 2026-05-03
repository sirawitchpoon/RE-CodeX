# Re:CodeX

VTuber-themed Discord bot platform for an idol-style server. Two bots
(Giveaway + Level), one REST/SSE API, one React backoffice — all in one
Docker stack ready to drop on a VPS.

**Highlights**

- **Button-only Giveaway entry** — fans click *เข้าร่วม* on the embed, pick
  one of six cast members as their **main** (oshi), then choose
  *Discord ติดต่อ* or supply a custom contact handle via a one-field modal.
  Picking a main grants the member's Discord role; switching mains swaps
  the role atomically.
- **XP/Level bot** — text/voice/reaction grants with anti-spam, level curve
  config, role rewards, manual grants from the backoffice, full reset.
- **Backoffice SPA** — login-gated; live entries via SSE; cast roster CRUD;
  giveaway lifecycle (DRAFT → PUBLISH → DRAW → ANNOUNCE / END / CANCEL).
- **Two-DB split** — high-value XP/cast data lives in `points-db`; app
  state lives in `app-db`. Backups and migrations are separate.
- **Brand-renamable** — the fan community label is **Signals**, the XP
  unit is **EXP**, and the cast roster is admin-managed. All three are
  config, not constants — rename server-wide via DB or UI.

## Table of contents

- [Architecture](#architecture)
- [Repo layout](#repo-layout)
- [Local dev (without Docker)](#local-dev-without-docker)
- [Production (Docker on VPS)](#production-docker-on-vps)
- [Required env](#required-env)
- [Discord setup checklist](#discord-setup-checklist)
- [Backoffice features](#backoffice-features)
  - [Cast Members admin](#cast-members-admin-one-time-setup-before-any-giveaway)
  - [Giveaway lifecycle](#giveaway-lifecycle-button-only-entry-flow)
  - [XP feature toggles](#xp-feature-toggles)
  - [Reset XP before launch](#reset-xp-before-launch)
- [Smoke test](#smoke-test)
- [Backups](#backups)
- [Renaming Signals / EXP / cast](#renaming-signals--exp--cast)
- [Auth](#auth)

## Architecture

```
                            ┌─────────────────┐
   browser ──TLS──▶ Caddy ──┤ /               ├──▶ web (nginx serving dist/)
                            │ /api/*          ├──▶ api (Express)
                            │ /uploads/*      ├──▶ api (static files)
                            │ /api/events/*   ├──▶ api (SSE, flush_interval -1)
                            └────────┬────────┘
                                     │
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
           ┌─────────────┐   ┌─────────────┐    ┌─────────────┐
           │ bot-        │   │ bot-level   │    │ api         │
           │ giveaway    │   │ XP grants   │    │ REST + SSE  │
           │ • main pick │   │ • /rank     │    │ + multipart │
           │ • contact   │   │ • /lb       │    │             │
           │ • role swap │   │ • level-up  │    │             │
           └──────┬──────┘   └──────┬──────┘    └──────┬──────┘
                  │                  │                  │
                  └─────── Redis pub/sub ────────┐      │
                                                 ▼      ▼
                  ┌──────────────────┐   ┌─────────────────┐
                  │ points-db        │   │  app-db         │
                  │ (postgres)       │   │ (postgres)      │
                  │ • XpEvent/Total  │   │ • Giveaway      │
                  │ • LevelConfig    │   │ • GiveawayEntry │
                  │ • RoleReward     │   │ • Log           │
                  │ • BrandingConfig │   │ • BotInstance   │
                  │ • GiveawayMember │   │ • AdminUser     │
                  │ • UserMain       │   │                 │
                  │ — HIGH VALUE     │   │                 │
                  └──────────────────┘   └─────────────────┘
```

**Why two Postgres containers?** The high-value data (XP, levels, role
rewards, branding, **the cast roster**, **per-user oshi**) lives in
`points-db` so schema migrations on giveaway/log features can never put
it at risk. Backups for `points-data` and `app-data` are handled
separately. References that cross the boundary (e.g.
`GiveawayEntry.memberId`) are plain `String` columns — soft FKs joined
in app code, never as a Prisma relation.

**Why SSE not WebSocket?** All realtime is server→client. SSE survives
Caddy/HTTP/2 with `flush_interval -1` and needs no sticky sessions.

**Why bots write Postgres directly?** Hot path latency. `messageCreate`
shouldn't pay an HTTP round-trip on every grant. Both bots and the API
import the same Prisma clients from `packages/db-{points,app}`.

**Why state in customIds?** Discord button interactions don't carry
session state, so `bot-giveaway` packs `(giveawayId, mode, memberId)`
into each customId so the next click knows which entry to commit, and
whether to INSERT (`mode=n`) or UPDATE (`mode=e`).

## Repo layout

```
apps/
  web/                React + Vite SPA (login-gated backoffice)
  api/                Express + SSE + multipart uploads
  bot-giveaway/       discord.js v14 — multi-step button flow:
                      embed (เข้าร่วม / แก้ไขข้อมูล) → 6 main buttons →
                      contact preference (Discord / อื่น) → optional modal
  bot-level/          discord.js v14 — XP grants + /rank + /leaderboard
packages/
  db-points/          Prisma schema for the high-value DB:
                      Guild, User, BrandingConfig, LevelConfig, RoleReward,
                      XpEvent, XpTotal, GiveawayMember, UserMain
  db-app/             Prisma schema for app DB:
                      Giveaway, GiveawayEntry, Log, BotInstance, AdminUser
                      (references points-db via plain String columns)
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

Two Bot applications in the [Discord Developer Portal](https://discord.com/developers/applications). Both need privileged intents — toggle them ON in **Bot → Privileged Gateway Intents** before inviting:

### bot-giveaway

| Setting | Value |
| --- | --- |
| **Server Members Intent** (privileged) | ON — required to fetch the user and call `roles.add/remove` |
| **Message Content Intent** | OFF (not used) |
| OAuth2 scopes | `bot`, `applications.commands` |
| Permissions | `Send Messages`, `Embed Links`, `Attach Files`, `Use External Emojis`, `Read Message History`, **`Manage Roles`** |

### bot-level

| Setting | Value |
| --- | --- |
| **Message Content Intent** (privileged) | ON — needed for message length / anti-spam |
| **Server Members Intent** (privileged) | ON — adds reward roles on level-up |
| **Presence Intent** (privileged) | OPTIONAL — only for online/idle/offline display |
| OAuth2 scopes | `bot`, `applications.commands` |
| Permissions | `Send Messages`, `Embed Links`, `Read Messages/View Channels`, `Read Message History`, `Add Reactions`, **`Manage Roles`** |

### Role hierarchy — non-obvious gotcha

Both bots assign roles. Discord refuses to grant a role higher than the
bot's own top role. After inviting:

1. Open **Server Settings → Roles**.
2. Drag **each bot's role above** every role it needs to assign:
   - bot-giveaway → above each of the 6 cast/oshi roles
   - bot-level → above each `RoleReward.roleId`
3. If you later add a higher cast role or reward role, repeat the drag.

Slash commands (`/rank`, `/leaderboard`) register guild-scoped on bot-level boot — they appear in the slash menu within ~60 seconds.

## Backoffice features

The SPA mounts under the root path; nav lives in the left sidebar
(Overview / Botstack / Mockups / System).

### Cast Members admin (one-time setup before any giveaway)

**Botstack → Giveaway · Members.** Manages the per-guild oshi roster.
Each row stores:

| Column | Purpose |
| --- | --- |
| `name` | Label on the Discord button (e.g. `AL`, `Zerozu`, `Wataru`, `Rei`, `Baobei`, `Iw`) |
| `roleId` | Discord role granted when a user picks this main |
| `sortOrder` | Position in the picker — ascending |
| `accentColor` | Hex (e.g. `#c77dff`) — pill color in the backoffice + Discord button accent |
| `emoji` | Optional Unicode/Discord emoji prefix on the button |

Bot side: `bot-giveaway` caches the list per-guild for 60s; the API
publishes `MEMBERS_CHANGED` on every CRUD so the cache invalidates
within milliseconds — no restart needed.

`DELETE` is blocked with `409 in_use` if any user has picked that member
as their main. Reassign or wait until those `UserMain` rows clear, then
retry.

### Giveaway lifecycle (button-only entry flow)

**Botstack → Giveaway Bot → สร้าง Giveaway** to create. Fill title /
prize / description / channel ID (Developer Mode → right-click channel
→ Copy ID) / winners count / ends-at / cover image. Created in `DRAFT`.

```
DRAFT ─► Publish ─► LIVE ─► End          ─► ENDED
                       └──► Draw ─► Announce ─► ENDED
                       └──► Cancel             ─► CANCELLED
```

- **Publish** — bot posts the embed in the chosen channel. The embed has
  two buttons: **เข้าร่วม** (Primary) and **แก้ไขข้อมูล** (Secondary).
- **เข้าร่วม** (user-side) — opens an ephemeral with one button per cast
  member → user picks → step-2 ephemeral asks *Discord ติดต่อได้เลย* /
  *ช่องทางอื่น*. Picking *Discord* commits immediately. Picking *อื่น*
  opens a single-field modal with placeholder `@RLanz_Tn (Twitter)` for
  free-form input. Either way the entry is saved + the cast member's
  Discord role is granted.
- **แก้ไขข้อมูล** (user-side) — same flow but in `mode=e` so the entry
  is UPDATEd, and if the user picked a *different* cast member their
  old main role is removed and the new one added atomically.
- **Edit** (admin-side, on the giveaway hero card) — bot re-renders the
  Discord embed if the giveaway is `LIVE`.
- **สุ่มผู้โชคดี** — uniform random over all entries (cast pick is
  flavor only, doesn't affect odds). Winner rows include each user's
  contact info so the admin knows where to reach them.
- **ประกาศใน Discord** — bot replies under the original embed mentioning
  each `<@userId>`.
- **End** — flips to `ENDED` without picking winners; both buttons in
  Discord become disabled.
- **Cancel** — flips to `CANCELLED`; embed is replaced with a
  strikethrough version.

### XP feature toggles

**Botstack → XP Rules → XP Sources.** Toggle Text / Voice / Reactions /
Daily Streak. Click **บันทึก** to persist; the change propagates to
bot-level via `LEVEL_CONFIG_CHANGED` immediately — no restart.

### Reset XP before launch

**Botstack → XP Rules → header → "Reset XP คะแนนทั้งเซิร์ฟ".** Must type
`RESET` in the confirmation field. Wipes `XpEvent` + `XpTotal` for the
guild; `LevelConfig`, `RoleReward`, `GiveawayMember`, `UserMain` are
preserved.

Equivalent direct SQL:
```bash
docker compose --env-file .env -f infra/compose/docker-compose.yml exec points-db \
  psql -U recodex_points -d recodex_points \
  -c "DELETE FROM \"XpEvent\" WHERE \"guildId\"='<guild_id>'; DELETE FROM \"XpTotal\" WHERE \"guildId\"='<guild_id>';"
```

### Sample data (dev/preview only)

3 sample giveaways (LIVE / SCHEDULED / ENDED) for UI preview before real
Discord activity flows in:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.yml \
  --profile seed run --rm seed-sample
```

Idempotent (clears `sample_*` rows before inserting). Entries are
**not** seeded — exercise the actual button flow in Discord to populate
`GiveawayEntry`.

## Smoke test

After `docker compose up -d` and the first `seed-admin` run:

**Health + XP**

1. `curl https://<domain>/api/health` → JSON with all four flags `true`
2. Log into the SPA → all pages navigate without errors
3. Post a >4-char message in a non-excluded channel → `XpTotal.totalXp`
   grows; `/rank` in Discord reflects it
4. Insert a `RoleReward` at level 1 (POST
   `/api/level/<guildId>/role-rewards`) → keep posting until level
   crosses → bot adds the role

**Giveaway end-to-end**

5. **Botstack → Giveaway · Members** → create the 6 cast rows with real
   Discord `roleId` values + distinct `accentColor`s. Tail `bot-giveaway`
   logs after each save → must see `members cache invalidated`.
6. **Botstack → Giveaway Bot → สร้าง Giveaway** → fill title / prize /
   channel → Save (status = `DRAFT`).
7. Click **Publish** → in Discord, the embed appears with two buttons
   (**เข้าร่วม** + **แก้ไขข้อมูล**).
8. As a test user, click **เข้าร่วม** → ephemeral shows 6 cast buttons →
   pick one → step-2 ephemeral asks contact preference → click
   **Discord ได้เลย** → ephemeral switches to `✅`. Verify in Discord
   that the cast member's role is now on the user; verify the entry
   appears in the backoffice within ~1s (SSE).
9. Click **เข้าร่วม** *again* on the same giveaway → ephemeral says
   "เข้าร่วมแล้ว ใช้ปุ่ม **แก้ไขข้อมูล**".
10. Click **แก้ไขข้อมูล** → pick a *different* cast member → step-2 →
    **ช่องทางอื่น** → modal opens with placeholder `@RLanz_Tn (Twitter)`
    → submit → entry's `memberId` updates, old main role is removed,
    new main role is added, `contactType=OTHER`, `contactValue` shows
    in the entries table.
11. Publish a *second* giveaway → click **เข้าร่วม** as the same user →
    no role action (already had a main); flow proceeds straight to
    contact preference.
12. **สุ่มผู้โชคดี → Roll → ประกาศใน Discord** → bot replies under the
    original embed mentioning each `<@userId>`. The DrawModal in the
    backoffice shows each winner's contact (Discord or custom string).

**Live config changes**

13. Toggle off **Text Messages** in XP Rules → บันทึก → post a message →
    XP does not increase (verified via `/rank`).
14. SQL `UPDATE "BrandingConfig" SET "signalsLabel"='Stardust',
    "xpLabel"='Aether'` → next `/rank` and next published Giveaway embed
    use the new labels (or use the backoffice branding form if wired).
15. Edit a cast member's `name` in the admin UI → click **เข้าร่วม** on
    a fresh giveaway as a new user → picker shows the new label
    immediately (`MEMBERS_CHANGED` invalidates the cache).

**Security hardening** (post-audit — verifies the fixes in `apps/api`)

16. **Token redaction.** Hit any non-SSE endpoint with a fake token in the
    query string, e.g.
    `curl 'https://<domain>/api/health?token=secret-jwt-12345'`,
    then `docker compose logs --tail=5 api` → the access-log line for that
    request must show `url: /api/health?token=[REDACTED]` (never the raw
    token). The `Authorization` and `Cookie` headers are redacted by the
    same pinoHttp config.
17. **Per-IP + per-user lockout.** Five wrong logins for one username from
    the same IP must respond 401, and the sixth must respond 429
    `too_many_attempts`:
    ```bash
    for i in 1 2 3 4 5 6; do
      curl -s -o /dev/null -w "%{http_code}\n" \
        -H 'Content-Type: application/json' \
        -d '{"username":"smoketest","password":"wrong"}' \
        https://<domain>/api/auth/login
    done
    # → 401 401 401 401 401 429
    ```
    Then `docker compose exec redis redis-cli KEYS 'auth:fails:*'` should
    show **two** keys (`auth:fails:user:smoketest` + `auth:fails:ip:<ip>`).
    Clean up with `redis-cli DEL` on those keys before the 15-minute window
    expires, or wait it out.
18. **Draw idempotency.** After step 12 (winners drawn + announced), POST
    `/api/giveaways/<id>/draw` again — response must be the **same winner
    set**, not new picks. A `DELETE /api/giveaways/<id>` on a `LIVE`
    giveaway must return 409 `live_cannot_delete`; only `ENDED` /
    `CANCELLED` / `DRAFT` rows can be deleted.

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

## Renaming Signals / EXP / cast

The fan label, XP unit, currency emoji, and accent color all live in
`BrandingConfig`:

```sql
-- points-db
UPDATE "BrandingConfig"
SET "signalsLabel"  = 'Stardust',
    "xpLabel"       = 'Aether',
    "currencyEmoji" = '⭐',
    "accentColor"   = '#ffd166'
WHERE "guildId" = '<your-guild-id>';
```

Cast members live in `GiveawayMember` — manage them via the
backoffice **Giveaway · Members** page (preferred) or directly:

```sql
-- points-db, example: rename "Wataru" without touching anything downstream
UPDATE "GiveawayMember"
SET "name" = 'Wataru-kun', "accentColor" = '#9b59b6', "emoji" = '🌿'
WHERE "guildId" = '<your-guild-id>' AND "name" = 'Wataru';
```

Either change shows up:
- on the next `/rank`, `/leaderboard`, and Giveaway embed
- on the next *เข้าร่วม* / *แก้ไขข้อมูล* ephemeral (cache TTL 60s, but
  publishing through the API invalidates immediately)
- in the SPA — backoffice fetches branding + members fresh on page load

## Auth

Username/password login backed by JWT. Tokens live in `localStorage` on the
client and are sent as `Authorization: Bearer <token>` on every API call
(SSE streams accept the token via `?token=` query because EventSource
can't set headers).

**Public routes** (no token required): `GET /api/health`, `POST /api/auth/login`.
Everything else returns `401` without a valid token.

**Brute-force protection:** 5 failed logins per username in 15 min →
account locks out for 15 min (Redis SETEX counter).

**Swap point:** [apps/api/src/middleware/auth.ts](apps/api/src/middleware/auth.ts).
The `PUBLIC_PATHS` set defines which routes bypass the check; replace
`signToken` / `jwt.verify` to switch to Discord OAuth later without
touching any route file.

### Create the first admin user

After `docker compose up -d` (so `app-db` and `migrate-app` are ready):

```bash
# .env already has ADMIN_USERNAME + ADMIN_PASSWORD
docker compose --env-file .env -f infra/compose/docker-compose.yml \
  --profile seed run --rm seed-admin
```

Re-run the same command (with a new `ADMIN_PASSWORD` in `.env`) to rotate
the password — the seed CLI does an upsert.

### Required env

In addition to the existing list, the auth feature adds:

| Var | Purpose |
| --- | --- |
| `JWT_SECRET` | HS256 signing key. **Generate with `openssl rand -hex 32`.** Min 16 chars. |
| `JWT_TTL_HOURS` | How long a session lasts. Default 24. |
| `ADMIN_USERNAME` | First admin's username (only consumed by the seed CLI) |
| `ADMIN_PASSWORD` | First admin's password (≥8 chars). Re-run seed to rotate. |

## License

Private project — all rights reserved.
