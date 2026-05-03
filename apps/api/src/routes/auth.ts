// POST /api/auth/login   { username, password }  → { token, user }
// GET  /api/auth/me                              → { user } (requires Bearer)
//
// Login is rate-limited via two Redis SETEX counters tracked in parallel:
//
//   user-bucket  keyed by lowercase username — protects an individual account.
//                Low threshold (5/15min) so brute force on one user is stopped fast.
//
//   ip-bucket    keyed by req.ip — protects against attackers who rotate
//                usernames to dodge the user-bucket. Higher threshold so a
//                shared NAT egress (office, mobile carrier) does not lock out
//                legit users when one teammate fat-fingers a few times.
//
// Both buckets must clear; either one tripping responds 429.

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

const USER_MAX_FAILS = 5;
const IP_MAX_FAILS = 20;
const WINDOW_SEC = 15 * 60;

authRouter.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_payload" });
    return;
  }
  const { username, password } = parsed.data;

  const userKey = `auth:fails:user:${username.toLowerCase()}`;
  const ipKey = `auth:fails:ip:${req.ip ?? "unknown"}`;

  const [userFails, ipFails] = await Promise.all([
    redis.get(userKey).then((v) => Number(v ?? 0)),
    redis.get(ipKey).then((v) => Number(v ?? 0)),
  ]);
  if (userFails >= USER_MAX_FAILS || ipFails >= IP_MAX_FAILS) {
    res.status(429).json({ error: "too_many_attempts" });
    return;
  }

  const user = await appPrisma.adminUser.findUnique({ where: { username } });

  // Always run bcrypt to keep timing consistent against username enumeration
  const ok = user
    ? await bcrypt.compare(password, user.passwordHash)
    : await bcrypt.compare(password, "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvi");

  if (!user || !ok) {
    await Promise.all([
      redis.multi().incr(userKey).expire(userKey, WINDOW_SEC).exec(),
      redis.multi().incr(ipKey).expire(ipKey, WINDOW_SEC).exec(),
    ]);
    logger.warn({ username, ip: req.ip }, "login failed");
    res.status(401).json({ error: "invalid_credentials" });
    return;
  }

  // Clear the user counter on success; keep the IP counter so a successful
  // login doesn't reset an attacker who happens to know one valid credential.
  await redis.del(userKey);
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
