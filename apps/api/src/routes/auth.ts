// POST /api/auth/login   { username, password }  → { token, user }
// GET  /api/auth/me                              → { user } (requires Bearer)
//
// Login is rate-limited per-username via Redis SETEX counter. After 5
// failures in 15 minutes the account locks out for 15 minutes.

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { appPrisma } from "@recodex/db-app";
import { signToken } from "../middleware/auth.js";
import { pub as redis } from "../redis.js";
import { logger } from "../logger.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

const MAX_FAILS = 5;
const WINDOW_SEC = 15 * 60;

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const { username, password } = parsed.data;

  const failKey = `auth:fails:${username.toLowerCase()}`;
  const fails = Number((await redis.get(failKey)) ?? 0);
  if (fails >= MAX_FAILS) {
    res.status(429).json({ error: "too_many_attempts" });
    return;
  }

  const user = await appPrisma.adminUser.findUnique({ where: { username } });

  // Always run bcrypt to keep timing consistent against username enumeration
  const ok = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvi");

  if (!user || !ok) {
    await redis.multi().incr(failKey).expire(failKey, WINDOW_SEC).exec();
    logger.warn({ username }, "login failed");
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  await redis.del(failKey);
  await appPrisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const token = signToken({ id: user.id, username: user.username });
  res.json({ token, user: { id: user.id, username: user.username } });
});

authRouter.get("/auth/me", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }
  res.json({ user: req.user });
});
