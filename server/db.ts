import fs from "fs";
import mysql, { type Pool, type PoolOptions, type RowDataPacket } from "mysql2/promise";
import path from "path";
import { findProjectRoot } from "./paths.js";

let pool: Pool | null = null;

function loadEnvFile() {
  const root = findProjectRoot(import.meta.url);
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function getMysqlConfig(): PoolOptions {
  loadEnvFile();
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "aubm",
    password: process.env.MYSQL_PASSWORD || "aubm_pcheck",
    database: process.env.MYSQL_DATABASE || "aubm_pcheck",
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
    timezone: "Z",
  };
}

async function migrate(poolInstance: Pool) {
  await poolInstance.query(`
    CREATE TABLE IF NOT EXISTS fiches (
      id VARCHAR(36) PRIMARY KEY NOT NULL,
      version VARCHAR(255) NOT NULL,
      owner VARCHAR(255) NOT NULL,
      pc_name VARCHAR(255) NOT NULL,
      start_date VARCHAR(32) NULL,
      end_date VARCHAR(32) NULL,
      status VARCHAR(32) NOT NULL,
      created_at VARCHAR(40) NOT NULL,
      updated_at VARCHAR(40) NOT NULL,
      finalized_at VARCHAR(40) NULL,
      INDEX idx_fiches_status (status),
      INDEX idx_fiches_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await poolInstance.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(36) PRIMARY KEY NOT NULL,
      fiche_id VARCHAR(36) NOT NULL,
      text TEXT NOT NULL,
      done TINYINT(1) NOT NULL DEFAULT 0,
      sort_order INT NOT NULL DEFAULT 0,
      account VARCHAR(16) NOT NULL DEFAULT 'user',
      INDEX idx_tasks_fiche_id (fiche_id),
      CONSTRAINT fk_tasks_fiche
        FOREIGN KEY (fiche_id) REFERENCES fiches(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function initDb() {
  if (pool) return pool;
  const config = getMysqlConfig();
  pool = mysql.createPool(config);
  await migrate(pool);
  await pool.query<RowDataPacket[]>("SELECT 1 AS ok");
  return pool;
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("MySQL non initialisé. Appelez initDb() au démarrage.");
  }
  return pool;
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
