import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db.js";
import type {
  FicheInput,
  FicheStatus,
  PcTodoFiche,
  TaskAccount,
  TaskItem,
} from "../shared/types.js";

type FicheRow = RowDataPacket & {
  id: string;
  version: string;
  owner: string;
  pc_name: string;
  start_date: string | null;
  end_date: string | null;
  status: FicheStatus;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
};

type TaskRow = RowDataPacket & {
  id: string;
  fiche_id: string;
  text: string;
  done: number | boolean;
  sort_order: number;
  account: string | null;
};

function normalizeAccount(value: string | null | undefined): TaskAccount {
  return value === "admin" ? "admin" : "user";
}

function mapTasks(rows: TaskRow[]): TaskItem[] {
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    done: r.done === 1 || r.done === true,
    sortOrder: r.sort_order,
    account: normalizeAccount(r.account),
  }));
}

function mapFiche(row: FicheRow, tasks: TaskItem[]): PcTodoFiche {
  return {
    id: row.id,
    version: row.version,
    owner: row.owner,
    pcName: row.pc_name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
    tasks,
  };
}

async function loadTasks(ficheId: string): Promise<TaskItem[]> {
  const pool = getPool();
  const [rows] = await pool.query<TaskRow[]>(
    `SELECT * FROM tasks
     WHERE fiche_id = ?
     ORDER BY CASE account WHEN 'admin' THEN 0 ELSE 1 END, sort_order ASC`,
    [ficheId],
  );
  return mapTasks(rows);
}

export async function listFiches(status?: FicheStatus): Promise<PcTodoFiche[]> {
  const pool = getPool();
  const [rows] = status
    ? await pool.query<FicheRow[]>(
        `SELECT * FROM fiches WHERE status = ? ORDER BY updated_at DESC`,
        [status],
      )
    : await pool.query<FicheRow[]>(
        `SELECT * FROM fiches ORDER BY updated_at DESC`,
      );

  const result: PcTodoFiche[] = [];
  for (const row of rows) {
    result.push(mapFiche(row, await loadTasks(row.id)));
  }
  return result;
}

export async function getFiche(id: string): Promise<PcTodoFiche | null> {
  const pool = getPool();
  const [rows] = await pool.query<FicheRow[]>(
    `SELECT * FROM fiches WHERE id = ? LIMIT 1`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return mapFiche(row, await loadTasks(id));
}

export async function upsertFiche(input: FicheInput): Promise<PcTodoFiche> {
  const pool = getPool();
  const now = new Date().toISOString();
  const id = input.id?.trim() || randomUUID();
  const existing = await getFiche(id);

  const createdAt = existing?.createdAt ?? now;
  const finalizedAt =
    input.status === "finalized"
      ? (input.finalizedAt ?? existing?.finalizedAt ?? now)
      : null;

  const adminTasks = input.tasks.filter(
    (t) => normalizeAccount(t.account) === "admin",
  );
  const userTasks = input.tasks.filter(
    (t) => normalizeAccount(t.account) !== "admin",
  );
  const ordered = [...adminTasks, ...userTasks];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `
      INSERT INTO fiches (
        id, version, owner, pc_name, start_date, end_date, status,
        created_at, updated_at, finalized_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        version = VALUES(version),
        owner = VALUES(owner),
        pc_name = VALUES(pc_name),
        start_date = VALUES(start_date),
        end_date = VALUES(end_date),
        status = VALUES(status),
        updated_at = VALUES(updated_at),
        finalized_at = VALUES(finalized_at)
      `,
      [
        id,
        input.version.trim(),
        input.owner.trim(),
        input.pcName.trim(),
        input.startDate,
        input.endDate ?? null,
        input.status,
        createdAt,
        now,
        finalizedAt,
      ],
    );

    await conn.query(`DELETE FROM tasks WHERE fiche_id = ?`, [id]);

    for (const [index, task] of ordered.entries()) {
      await conn.query(
        `
        INSERT INTO tasks (id, fiche_id, text, done, sort_order, account)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          task.id?.trim() || randomUUID(),
          id,
          task.text.trim(),
          task.done ? 1 : 0,
          index,
          normalizeAccount(task.account),
        ],
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const fiche = await getFiche(id);
  if (!fiche) {
    throw new Error("Fiche introuvable après enregistrement.");
  }
  return fiche;
}

export async function deleteFiche(id: string): Promise<boolean> {
  const pool = getPool();
  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM fiches WHERE id = ?`,
    [id],
  );
  return result.affectedRows > 0;
}
