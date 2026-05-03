// Fail-fast env validation. Anything misconfigured surfaces at boot, not at
// the first request. POINTS_DATABASE_URL and APP_DATABASE_URL are required —
// the two Postgres containers are an explicit isolation decision (see
// memory/feedback_isolate_points_db.md).

import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().positive().default(3000),
  POINTS_DATABASE_URL: z.string().url(),
  APP_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  UPLOADS_DIR: z.string().min(1).default("./data/uploads"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGIN: z.string().min(1).default("*"),
  // JWT signing key for backoffice admin sessions. Must be at least 32
  // chars in production. Generate with: `openssl rand -hex 32`.
  JWT_SECRET: z.string().min(16),
  JWT_TTL_HOURS: z.coerce.number().int().positive().default(24),
  // Google Apps Script Web App that mirrors entries + winners into a
  // Spreadsheet. Both vars optional — when either is empty the sheets
  // worker stays asleep and outbox rows just queue (zero data loss; the
  // backlog drains as soon as the URL is configured).
  SHEETS_WEBHOOK_URL: z.string().url().optional(),
  SHEETS_WEBHOOK_TOKEN: z.string().min(8).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("[env] invalid configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;
