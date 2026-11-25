import express from "express";
import fs from "fs";
import path from "path";
import { deleteFiche, getFiche, listFiches, upsertFiche } from "./fiches.js";
import { findProjectRoot } from "./paths.js";
import type { FicheInput, FicheStatus } from "../shared/types.js";

const rootDir = findProjectRoot(import.meta.url);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8091);

const app = express();
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "aubm-pcheck",
    host: HOST,
    port: PORT,
  });
});

app.get("/api/fiches", (req, res) => {
  const status = req.query.status as FicheStatus | undefined;
  if (status && status !== "draft" && status !== "finalized") {
    res.status(400).json({ error: "status invalide." });
    return;
  }
  res.json(listFiches(status));
});

app.post("/api/fiches", (req, res) => {
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
});

app.get("/api/fiches/:id", (req, res) => {
  const fiche = getFiche(req.params.id);
  if (!fiche) {
    res.status(404).json({ error: "Fiche introuvable." });
    return;
  }
  res.json(fiche);
});

app.put("/api/fiches/:id", (req, res) => {
  const body = req.body as FicheInput;
  const fiche = upsertFiche({ ...body, id: req.params.id });
  res.json(fiche);
});

app.delete("/api/fiches/:id", (req, res) => {
  const ok = deleteFiche(req.params.id);
  if (!ok) {
    res.status(404).json({ error: "Fiche introuvable." });
    return;
  }
  res.json({ ok: true });
});

const publicDir = path.join(rootDir, "dist", "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
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

app.listen(PORT, HOST, () => {
  console.log(`AUBM PCheck écoute sur http://${HOST}:${PORT}`);
  console.log(`URL publique attendue : http://195.200.200.16:8091`);
});
