import express from "express";
import fs from "fs";
import path from "path";
import { getDb } from "./db.js";
import { deleteFiche, getFiche, listFiches, upsertFiche } from "./fiches.js";
import { findProjectRoot } from "./paths.js";
import type { FicheInput, FicheStatus } from "../shared/types.js";

const rootDir = findProjectRoot(import.meta.url);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8091);

try {
  getDb();
  console.log("SQLite prêt.");
} catch (err) {
  console.error("Impossible d'ouvrir SQLite :", err);
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  try {
    getDb();
    res.json({
      ok: true,
      service: "aubm-pcheck",
      host: HOST,
      port: PORT,
      db: true,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Erreur base de données",
    });
  }
});

app.get("/api/fiches", (req, res) => {
  try {
    const status = req.query.status as FicheStatus | undefined;
    if (status && status !== "draft" && status !== "finalized") {
      res.status(400).json({ error: "status invalide." });
      return;
    }
    res.json(listFiches(status));
  } catch (err) {
    console.error("GET /api/fiches", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.post("/api/fiches", (req, res) => {
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

    const fiche = upsertFiche(body);
    res.status(201).json(fiche);
  } catch (err) {
    console.error("POST /api/fiches", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.get("/api/fiches/:id", (req, res) => {
  try {
    const fiche = getFiche(req.params.id);
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

app.put("/api/fiches/:id", (req, res) => {
  try {
    const body = req.body as FicheInput;
    const fiche = upsertFiche({ ...body, id: req.params.id });
    res.json(fiche);
  } catch (err) {
    console.error("PUT /api/fiches/:id", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.delete("/api/fiches/:id", (req, res) => {
  try {
    const ok = deleteFiche(req.params.id);
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
  app.use(express.static(publicDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
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

app.listen(PORT, HOST, () => {
  console.log(`AUBM PCheck écoute sur http://${HOST}:${PORT}`);
  console.log(`URL publique attendue : http://195.200.200.16:8091`);
  console.log(`Racine projet : ${rootDir}`);
  console.log(`Frontend : ${publicDir}`);
});
