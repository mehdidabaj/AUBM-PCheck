import express from "express";
import fs from "fs";
import path from "path";
import { getMysqlConfig, initDb } from "./db.js";
import { deleteFiche, getFiche, listFiches, upsertFiche } from "./fiches.js";
import { findProjectRoot } from "./paths.js";
import type { FicheInput, FicheStatus } from "../shared/types.js";

const rootDir = findProjectRoot(import.meta.url);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8091);

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_req, res) => {
  try {
    await initDb();
    const cfg = getMysqlConfig();
    res.json({
      ok: true,
      service: "aubm-pcheck",
      build: "mysql-2026-11-25c",
      host: HOST,
      port: PORT,
      db: "mysql",
      mysqlHost: cfg.host,
      mysqlDatabase: cfg.database,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      build: "mysql-2026-11-25c",
      error: err instanceof Error ? err.message : "Erreur base de données",
    });
  }
});

app.get("/api/fiches", async (req, res) => {
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

app.post("/api/fiches", async (req, res) => {
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

app.get("/api/fiches/:id", async (req, res) => {
  try {
    const fiche = await getFiche(req.params.id);
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

app.put("/api/fiches/:id", async (req, res) => {
  try {
    const body = req.body as FicheInput;
    const fiche = await upsertFiche({ ...body, id: req.params.id });
    res.json(fiche);
  } catch (err) {
    console.error("PUT /api/fiches/:id", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Erreur serveur",
    });
  }
});

app.delete("/api/fiches/:id", async (req, res) => {
  try {
    const ok = await deleteFiche(req.params.id);
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
    const cfg = getMysqlConfig();
    console.log(
      `MySQL prêt (${cfg.host}:${cfg.port}/${cfg.database} user=${cfg.user})`,
    );
  } catch (err) {
    console.error("Impossible de se connecter à MySQL :", err);
    process.exit(1);
  }

  app.listen(PORT, HOST, () => {
    console.log(`AUBM PCheck écoute sur http://${HOST}:${PORT}`);
    console.log(`URL publique attendue : http://195.200.200.16:8091`);
    console.log(`Racine projet : ${rootDir}`);
    console.log(`Frontend : ${publicDir}`);
  });
}

main();
