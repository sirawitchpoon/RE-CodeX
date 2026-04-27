// JWT auth middleware for /api/* routes.
//
// Reads `Authorization: Bearer <token>`, verifies with env.JWT_SECRET,
// attaches { id, username } to req.user. Routes that should be reachable
// without a token (login, health, public uploads) bypass this middleware
// or whitelist their path here.

import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface AuthClaims {
  sub: string;        // AdminUser.id
  username: string;
  iat: number;
  exp: number;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; username: string };
  }
}

// Paths that pass through without a token. Match against req.path AFTER the
// `/api` mount prefix is stripped — i.e. `/health`, `/auth/login`.
const PUBLIC_PATHS = new Set<string>(["/health", "/auth/login"]);

export const auth: RequestHandler = (req, res, next) => {
  if (PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }
  // SSE endpoints accept the token via query string because EventSource
  // can't set custom headers in the browser.
  let token = "";
  const header = req.header("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    token = header.slice(7).trim();
  } else if (typeof req.query.token === "string") {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "missing_token" });
    return;
  }

  try {
    const claims = jwt.verify(token, env.JWT_SECRET) as AuthClaims;
    req.user = { id: claims.sub, username: claims.username };
    next();
  } catch {
    res.status(401).json({ error: "invalid_token" });
  }
};

export function signToken(user: { id: string; username: string }): string {
  return jwt.sign({ username: user.username }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: `${env.JWT_TTL_HOURS}h`,
  });
}
