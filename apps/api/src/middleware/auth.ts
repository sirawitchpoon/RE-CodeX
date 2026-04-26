// Auth swap point. No-op for now (LAN/dev — user explicitly chose no auth
// this round). When Discord OAuth or basic-auth is added later, replace the
// body of `auth` and every route stays untouched.

import type { RequestHandler } from "express";

export const auth: RequestHandler = (_req, _res, next) => {
  next();
};
