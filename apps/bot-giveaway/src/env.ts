import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GIVEAWAY_BOT_TOKEN: z.string().min(1),
  GIVEAWAY_BOT_APP_ID: z.string().min(1),
  GUILD_ID: z.string().min(1),
  POINTS_DATABASE_URL: z.string().url(),
  APP_DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default("redis://localhost:6379"),
  UPLOADS_DIR: z.string().min(1).default("./data/uploads"),
  PUBLIC_BASE_URL: z.string().url().optional(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("[bot-giveaway env] invalid configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = Object.freeze(parsed.data);
