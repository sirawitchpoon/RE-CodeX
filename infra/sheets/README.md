# Sheets sync setup

Mirrors every Giveaway entry + winner draw into a Google Sheets workbook.
Failure-safe: writes go through a Postgres outbox, so an Apps Script outage
never loses data — the API drains backlog when the URL is reachable again.

## Architecture (one-screen)

```
┌──────────────┐   $transaction    ┌────────────────┐
│ bot pickmain │──────────────────▶│ GiveawayEntry  │
│   (commit)   │                   │ + EntrySync-   │
└──────────────┘                   │   Outbox row   │
                                   └────────────────┘
┌──────────────┐   $transaction              │ PENDING
│ api /draw    │─────────────────────────────┤
└──────────────┘                             ▼
                                 ┌──────────────────────┐
                                 │  api sheetsWorker    │
                                 │  poll every 10s,     │
                                 │  POST → Apps Script  │
                                 │  retry w/ backoff    │
                                 └──────────────────────┘
                                             │
                                             ▼
                            Google Sheets ←  Apps Script doPost
                            (1 tab per giveaway + Winners master)
```

## One-time setup

### 1. Create the destination Spreadsheet

- New Google Sheet → name it whatever (e.g. `RE:CodeX Giveaways`).
- Share with the Google account that will own the script. (Web App `Execute
  as: Me` runs as the script owner.)

### 2. Paste the Apps Script

- In the Sheet: `Extensions → Apps Script`.
- Replace the default `Code.gs` content with the contents of
  [`Code.gs`](./Code.gs).
- `File → Project Settings → Script Properties → Add script property`:
  - Property: `WEBHOOK_TOKEN`
  - Value: any long random string. Generate one with:
    ```bash
    openssl rand -hex 24
    ```
  - Save.

### 3. Deploy as Web App

- `Deploy → New deployment → Type: Web app`.
- Configure:
  - **Description**: `recodex-sync-v1` (or any label)
  - **Execute as**: `Me (your-account@gmail.com)`
  - **Who has access**: `Anyone` — the `?token=` query param is the auth gate.
- Click **Deploy**, copy the **Web app URL**. It looks like:
  ```
  https://script.google.com/macros/s/AKfycb.../exec
  ```
- (Optional sanity check) Open the URL in a browser — should show
  `{"ok":true,"service":"recodex-giveaway-sheets"}`.

### 4. Wire it into the API

Add to `.env`:

```bash
SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/AKfycb.../exec
SHEETS_WEBHOOK_TOKEN=<the same value you put in Script Properties>
```

Restart the API container:

```bash
docker compose --env-file .env -f infra/compose/docker-compose.yml \
  up -d --no-deps --build api
```

The worker logs `sheets worker started` on boot. First entry/draw after
that should land in the Sheet within ~10s.

## Verifying it works

```bash
# Should report enabled:true, low pending count
curl -s http://localhost:3000/api/giveaway/sync-status \
  -H "Authorization: Bearer <admin-jwt>" | jq
```

Backoffice → Giveaway page shows a small `Sheets sync: …` pill in the action
bar **only when something needs attention** (sync disabled, backlog pending,
or rows stuck DEAD). Click the pill while it's red to retry DEAD rows.

## When something goes wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| Pill says `Sheets sync: ปิด` | env vars not set | Set `SHEETS_WEBHOOK_URL` + `SHEETS_WEBHOOK_TOKEN`, restart API |
| Pill says `N ค้าง` (DEAD) | wrong token / wrong URL / Apps Script error | Check Apps Script `Executions` log — fix the issue, click pill to retry |
| Backlog grows but never drains | API container down, or worker not started | Check `docker compose logs api \| grep sheets` |
| Duplicates in Sheet | Apps Script `WEBHOOK_TOKEN` was rotated and PropertiesService cleared | Acceptable — outbox retries are at-least-once; admin can dedup manually |

## Re-deploying the Apps Script after edits

Apps Script Web Apps **pin to a specific version on deploy**. After editing
`Code.gs`:

1. `Deploy → Manage deployments`
2. Click the pencil icon on the existing deployment
3. **Version**: `New version`
4. Click **Deploy**

The URL stays the same — no .env change needed.

If you accidentally created a new deployment with a new URL, swap the URL
in `.env` and restart the API.
