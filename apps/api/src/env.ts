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
