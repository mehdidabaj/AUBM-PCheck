import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import {
  attachUser,
  getSessionCookieName,
  readSessionToken,
  requireAdmin,
  requireAuth,
  type AuthedRequest,
} from "./auth.js";
import { getMysqlConfig, initDb, loadEnvFile } from "./db.js";
import { publicErrorMessage } from "./errors.js";
import { deleteFiche, getFiche, listFiches, upsertFiche } from "./fiches.js";
import { findProjectRoot } from "./paths.js";
import {
  createSession,
  destroySession,
  destroyUserSessions,
  purgeExpiredSessions,
} from "./sessions.js";
import {
  authenticate,
  createUser,
  deleteUser,
  listUsers,
  needsInitialSetup,
  setupInitialAdmin,
  updateUser,
} from "./users.js";
import type { AppRole, FicheInput, FicheStatus } from "../shared/types.js";

loadEnvFile();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function sendError(
  res: express.Response,
  status: number,
  err: unknown,
  fallback: string,
  logLabel: string,
) {
  console.error(logLabel, err);
  res.status(status).json({ error: publicErrorMessage(err, fallback) });
}

function validateFicheBody(
  body: FicheInput | undefined,
): { ok: true; body: FicheInput } | { ok: false; error: string } {
  if (
    !body?.version?.trim() ||
    !body?.owner?.trim() ||
    !body?.pcName?.trim() ||
    !body?.startDate ||
    !body?.tasks?.length
  ) {
    return {
      ok: false,
      error:
        "version, owner, pcName, startDate et au moins une tâche sont requis.",
    };
  }
  if (body.status !== "draft" && body.status !== "finalized") {
    return { ok: false, error: "status invalide." };
  }
  return { ok: true, body };
}

function checkSetupSecret(req: express.Request): string | null {
  const expected = process.env.SETUP_SECRET?.trim();
  if (!expected) return null;
  const fromHeader = String(req.headers["x-setup-secret"] || "");
  const fromBody = String(req.body?.setupSecret || "");
  if (fromHeader !== expected && fromBody !== expected) {
    return "Secret d’installation invalide ou manquant.";
  }
  return null;
}

const rootDir = findProjectRoot(import.meta.url);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8091);
const isProd = process.env.NODE_ENV === "production";
const BUILD_ID = "audit-fixes-2026-11-26a";

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: false,
  }),
);

app.use((req, res, next) => {
  if (req.path.startsWith("/assets/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  }
  next();
});
app.use(express.json({ limit: "512kb" }));
app.use(cookieParser());
app.use(attachUser);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez plus tard." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 180,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", apiLimiter);

function setSessionCookie(res: express.Response, token: string, expiresAt: Date) {
  res.cookie(getSessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd && process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(getSessionCookieName(), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd && process.env.COOKIE_SECURE === "true",
    path: "/",
  });
}

app.get("/api/health", async (_req, res) => {
  try {
    await initDb();
    res.json({
      ok: true,
      service: "aubm-pcheck",
      build: BUILD_ID,
    });
  } catch (err) {
    console.error("GET /api/health", err);
    res.status(500).json({
      ok: false,
      build: BUILD_ID,
      error: "Service temporairement indisponible.",
    });
  }
});

app.get("/api/auth/me", (req: AuthedRequest, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Non connecté." });
    return;
  }
  res.json({ user: req.user });
});

app.get("/api/auth/setup", async (_req, res) => {
  try {
    const needsSetup = await needsInitialSetup();
    res.json({
      needsSetup,
      setupSecretRequired: Boolean(process.env.SETUP_SECRET?.trim()) && needsSetup,
    });
  } catch (err) {
    sendError(res, 500, err, "Service temporairement indisponible.", "GET /api/auth/setup");
  }
});

app.post("/api/auth/setup", loginLimiter, async (req, res) => {
  try {
    if (!(await needsInitialSetup())) {
      res.status(409).json({ error: "L’installation est déjà initialisée." });
      return;
    }

    const secretErr = checkSetupSecret(req);
    if (secretErr) {
      res.status(403).json({ error: secretErr });
      return;
    }

    const username = String(req.body?.username || "");
    const displayName = String(req.body?.displayName || username);
    const password = String(req.body?.password || "");
    const passwordConfirm = String(req.body?.passwordConfirm || "");

    if (!username || !password) {
      res.status(400).json({ error: "Identifiant et mot de passe requis." });
      return;
    }
    if (password !== passwordConfirm) {
      res.status(400).json({ error: "Les mots de passe ne correspondent pas." });
      return;
    }

    const user = await setupInitialAdmin({ username, displayName, password });
    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.status(201).json({ user });
  } catch (err) {
    const msg = publicErrorMessage(err, "Création impossible.");
    const status =
      msg.startsWith("L’installation") || msg.startsWith("L'installation")
        ? 409
        : msg.startsWith("Identifiant") ||
            msg.startsWith("Nom affiché") ||
            msg.startsWith("Mot de passe") ||
            msg.startsWith("Les mots")
          ? 400
          : 500;
    sendError(res, status, err, "Création impossible.", "POST /api/auth/setup");
  }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const username = String(req.body?.username || "");
    const password = String(req.body?.password || "");
    if (!username || !password) {
      res.status(400).json({ error: "Identifiant et mot de passe requis." });
      return;
    }
    const user = await authenticate(username, password);
    if (!user) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }
    const session = await createSession(user.id);
    setSessionCookie(res, session.token, session.expiresAt);
    res.json({ user });
  } catch (err) {
    sendError(res, 500, err, "Connexion impossible.", "POST /api/auth/login");
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    await destroySession(readSessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/logout", err);
    clearSessionCookie(res);
    res.json({ ok: true });
  }
});

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    sendError(res, 500, err, "Erreur serveur.", "GET /api/users");
  }
});

app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const user = await createUser({
      username: String(req.body?.username || ""),
      displayName: String(req.body?.displayName || ""),
      password: String(req.body?.password || ""),
      role: (req.body?.role === "admin" ? "admin" : "reader") as AppRole,
    });
    res.status(201).json(user);
  } catch (err) {
    sendError(res, 400, err, "Création impossible.", "POST /api/users");
  }
});

app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const patch: {
      displayName?: string;
      role?: AppRole;
      password?: string;
    } = {};
    if (typeof req.body?.displayName === "string") {
      patch.displayName = req.body.displayName;
    }
    if (req.body?.role === "admin" || req.body?.role === "reader") {
      patch.role = req.body.role;
    }
    if (typeof req.body?.password === "string" && req.body.password.length) {
      patch.password = req.body.password;
    }
    const { user, passwordChanged } = await updateUser(
      paramId(req.params.id),
      patch,
    );
    if (passwordChanged) {
      await destroyUserSessions(user.id);
    }
    res.json(user);
  } catch (err) {
    sendError(res, 400, err, "Mise à jour impossible.", "PATCH /api/users/:id");
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const id = paramId(req.params.id);
    await deleteUser(id, req.user!.id);
    await destroyUserSessions(id);
    res.json({ ok: true });
  } catch (err) {
    sendError(res, 400, err, "Suppression impossible.", "DELETE /api/users/:id");
  }
});

app.get("/api/fiches", requireAuth, async (req, res) => {
  try {
    const status = req.query.status as FicheStatus | undefined;
    if (status && status !== "draft" && status !== "finalized") {
      res.status(400).json({ error: "status invalide." });
      return;
    }
    res.json(await listFiches(status));
  } catch (err) {
    sendError(res, 500, err, "Erreur serveur.", "GET /api/fiches");
  }
});

app.post("/api/fiches", requireAuth, requireAdmin, async (req, res) => {
  try {
    const validated = validateFicheBody(req.body as FicheInput);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const fiche = await upsertFiche(validated.body);
    res.status(201).json(fiche);
  } catch (err) {
    const msg = publicErrorMessage(err, "Erreur serveur.");
    const status = msg.startsWith("Cette fiche est finalisée") ? 409 : 500;
    sendError(res, status, err, "Erreur serveur.", "POST /api/fiches");
  }
});

app.get("/api/fiches/:id", requireAuth, async (req, res) => {
  try {
    const fiche = await getFiche(paramId(req.params.id));
    if (!fiche) {
      res.status(404).json({ error: "Fiche introuvable." });
      return;
    }
    res.json(fiche);
  } catch (err) {
    sendError(res, 500, err, "Erreur serveur.", "GET /api/fiches/:id");
  }
});

app.put("/api/fiches/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const validated = validateFicheBody(req.body as FicheInput);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }
    const fiche = await upsertFiche({
      ...validated.body,
      id: paramId(req.params.id),
    });
    res.json(fiche);
  } catch (err) {
    const msg = publicErrorMessage(err, "Erreur serveur.");
    const status = msg.startsWith("Cette fiche est finalisée") ? 409 : 500;
    sendError(res, status, err, "Erreur serveur.", "PUT /api/fiches/:id");
  }
});

app.delete("/api/fiches/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const ok = await deleteFiche(paramId(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Fiche introuvable." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    sendError(res, 500, err, "Erreur serveur.", "DELETE /api/fiches/:id");
  }
});

const publicDir = path.join(rootDir, "dist", "public");
if (fs.existsSync(publicDir)) {
  app.use(
    express.static(publicDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        } else {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  app.get("/", (_req, res) => {
    res
      .status(503)
      .type("text")
      .send(
        "Frontend non buildé. Lancez `npm run build` puis `npm start`, ou `npm run dev`.",
      );
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Erreur non gérée :", err);
    res.status(500).json({
      error: publicErrorMessage(err, "Erreur serveur"),
    });
  },
);

async function main() {
  try {
    await initDb();
    await purgeExpiredSessions();
    const cfg = getMysqlConfig();
    const setup = await needsInitialSetup();
    console.log(
      `MySQL prêt (${cfg.host}:${cfg.port}/${cfg.database} user=${cfg.user})`,
    );
    if (setup) {
      const secretHint = process.env.SETUP_SECRET?.trim()
        ? " (SETUP_SECRET requis)"
        : "";
      console.log(
        `Aucun utilisateur : ouvrez l’UI pour créer le premier administrateur${secretHint}.`,
      );
    }
  } catch (err) {
    console.error("Impossible de se connecter à MySQL :", err);
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`AUBM PCheck écoute sur http://${HOST}:${PORT}`);
    console.log(`Build ${BUILD_ID}`);
  });
}

main();
