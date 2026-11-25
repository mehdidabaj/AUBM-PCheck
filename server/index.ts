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

const rootDir = findProjectRoot(import.meta.url);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8091);
const isProd = process.env.NODE_ENV === "production";
const BUILD_ID = "setup-admin-2026-11-25f";

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    // CSP assouplie : les builds Vite (module + crossorigin) cassent sinon
    // l’UI (page blanche) si les en-têtes CORS/CSP sont trop stricts.
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
    // Site servi en HTTP clair sur IP:port — HSTS casserait le chargement
    hsts: false,
  }),
);

// Nécessaire pour les <script type="module" crossorigin> générés par Vite
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
    const cfg = getMysqlConfig();
    res.json({
      ok: true,
      service: "aubm-pcheck",
      build: BUILD_ID,
      host: HOST,
      port: PORT,
      db: "mysql",
      auth: true,
      mysqlHost: cfg.host,
      mysqlDatabase: cfg.database,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      build: BUILD_ID,
      error: err instanceof Error ? err.message : "Erreur base de données",
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
    res.json({ needsSetup: await needsInitialSetup() });
  } catch (err) {
    console.error("GET /api/auth/setup", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.post("/api/auth/setup", loginLimiter, async (req, res) => {
  try {
    if (!(await needsInitialSetup())) {
      res.status(409).json({ error: "L’installation est déjà initialisée." });
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
    console.error("POST /api/auth/setup", err);
    res.status(400).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
    console.error("POST /api/auth/login", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  try {
    await destroySession(readSessionToken(req));
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/logout", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.get("/api/users", requireAuth, requireAdmin, async (_req, res) => {
  try {
    res.json(await listUsers());
  } catch (err) {
    console.error("GET /api/users", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
    console.error("POST /api/users", err);
    res.status(400).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
    const user = await updateUser(paramId(req.params.id), patch);
    res.json(user);
  } catch (err) {
    console.error("PATCH /api/users/:id", err);
    res.status(400).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.delete("/api/users/:id", requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
  try {
    const id = paramId(req.params.id);
    await deleteUser(id, req.user!.id);
    await destroyUserSessions(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/users/:id", err);
    res.status(400).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
    console.error("GET /api/fiches", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.post("/api/fiches", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body as FicheInput;

    if (
      !body?.version?.trim() ||
      !body?.owner?.trim() ||
      !body?.pcName?.trim() ||
      !body?.startDate ||
      !body?.tasks?.length
    ) {
      res.status(400).json({
        error:
          "version, owner, pcName, startDate et au moins une tâche sont requis.",
      });
      return;
    }

    if (body.status !== "draft" && body.status !== "finalized") {
      res.status(400).json({ error: "status invalide." });
      return;
    }

    const fiche = await upsertFiche(body);
    res.status(201).json(fiche);
  } catch (err) {
    console.error("POST /api/fiches", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
    console.error("GET /api/fiches/:id", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.put("/api/fiches/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body as FicheInput;
    const fiche = await upsertFiche({ ...body, id: paramId(req.params.id) });
    res.json(fiche);
  } catch (err) {
    console.error("PUT /api/fiches/:id", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
    console.error("DELETE /api/fiches/:id", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
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
      error: err instanceof Error ? err.message : "Erreur serveur",
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
      console.log(
        "Aucun utilisateur : ouvrez l’UI pour créer le premier administrateur.",
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
