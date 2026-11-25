import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "todos.db");

let db: Database.Database | null = null;

function migrateTasksAccount(database: Database.Database) {
  const cols = database
    .prepare(`PRAGMA table_info(tasks)`)
    .all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === "account")) {
    database.exec(
      `ALTER TABLE tasks ADD COLUMN account TEXT NOT NULL DEFAULT 'user'`,
    );
  }
}

export function getDb() {
  if (db) return db;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS fiches (
      id TEXT PRIMARY KEY NOT NULL,
      version TEXT NOT NULL,
      owner TEXT NOT NULL,
      pc_name TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      status TEXT NOT NULL CHECK (status IN ('draft', 'finalized')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      finalized_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      fiche_id TEXT NOT NULL,
      text TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      account TEXT NOT NULL DEFAULT 'user',
      FOREIGN KEY (fiche_id) REFERENCES fiches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_fiches_status ON fiches(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_fiche_id ON tasks(fiche_id);
  `);

  migrateTasksAccount(db);

  return db;
}
