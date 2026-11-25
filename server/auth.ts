import type { NextFunction, Request, Response } from "express";
import { getSessionUser } from "./sessions.js";
import type { PublicUser } from "../shared/types.js";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "aubm_session";

export type AuthedRequest = Request & { user?: PublicUser };

export function getSessionCookieName() {
  return COOKIE_NAME;
}

export function readSessionToken(req: Request): string | undefined {
  const raw = req.cookies?.[COOKIE_NAME];
  return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

export async function attachUser(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    req.user = (await getSessionUser(readSessionToken(req))) || undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }
  next();
}

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    res.status(401).json({ error: "Authentification requise." });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Accès administrateur requis." });
    return;
  }
  next();
}
