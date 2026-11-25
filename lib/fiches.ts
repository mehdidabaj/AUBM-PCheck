import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { FicheInput, FicheStatus, PcTodoFiche, TaskItem } from "./types";

type FicheRow = {
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

type TaskRow = {
  id: string;
  fiche_id: string;
  text: string;
  done: number;
  sort_order: number;
};

function mapTasks(rows: TaskRow[]): TaskItem[] {
  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    done: r.done === 1,
    sortOrder: r.sort_order,
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

export function listFiches(status?: FicheStatus): PcTodoFiche[] {
  const database = getDb();
  const rows = status
    ? (database
        .prepare(
          `SELECT * FROM fiches WHERE status = ? ORDER BY updated_at DESC`,
        )
        .all(status) as FicheRow[])
    : (database
        .prepare(`SELECT * FROM fiches ORDER BY updated_at DESC`)
        .all() as FicheRow[]);

  const taskStmt = database.prepare(
    `SELECT * FROM tasks WHERE fiche_id = ? ORDER BY sort_order ASC`,
  );

  return rows.map((row) =>
    mapFiche(row, mapTasks(taskStmt.all(row.id) as TaskRow[])),
  );
}

export function getFiche(id: string): PcTodoFiche | null {
  const database = getDb();
  const row = database
    .prepare(`SELECT * FROM fiches WHERE id = ?`)
    .get(id) as FicheRow | undefined;
  if (!row) return null;
  const tasks = mapTasks(
    database
      .prepare(`SELECT * FROM tasks WHERE fiche_id = ? ORDER BY sort_order ASC`)
      .all(id) as TaskRow[],
  );
  return mapFiche(row, tasks);
}

export function upsertFiche(input: FicheInput): PcTodoFiche {
  const database = getDb();
  const now = new Date().toISOString();
  const id = input.id?.trim() || randomUUID();
  const existing = getFiche(id);

  const createdAt = existing?.createdAt ?? now;
  const finalizedAt =
    input.status === "finalized"
      ? (input.finalizedAt ?? existing?.finalizedAt ?? now)
      : null;

  const tx = database.transaction(() => {
    database
      .prepare(
        `
        INSERT INTO fiches (
          id, version, owner, pc_name, start_date, end_date, status,
          created_at, updated_at, finalized_at
        ) VALUES (
          @id, @version, @owner, @pc_name, @start_date, @end_date, @status,
          @created_at, @updated_at, @finalized_at
        )
        ON CONFLICT(id) DO UPDATE SET
          version = excluded.version,
          owner = excluded.owner,
          pc_name = excluded.pc_name,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          status = excluded.status,
          updated_at = excluded.updated_at,
          finalized_at = excluded.finalized_at
      `,
      )
      .run({
        id,
        version: input.version.trim(),
        owner: input.owner.trim(),
        pc_name: input.pcName.trim(),
        start_date: input.startDate,
        end_date: input.endDate ?? null,
        status: input.status,
        created_at: createdAt,
        updated_at: now,
        finalized_at: finalizedAt,
      });

    database.prepare(`DELETE FROM tasks WHERE fiche_id = ?`).run(id);

    const insertTask = database.prepare(
      `
      INSERT INTO tasks (id, fiche_id, text, done, sort_order)
      VALUES (@id, @fiche_id, @text, @done, @sort_order)
    `,
    );

    input.tasks.forEach((task, index) => {
      insertTask.run({
        id: task.id?.trim() || randomUUID(),
        fiche_id: id,
        text: task.text.trim(),
        done: task.done ? 1 : 0,
        sort_order: index,
      });
    });
  });

  tx();
  return getFiche(id)!;
}

export function deleteFiche(id: string): boolean {
  const database = getDb();
  const result = database.prepare(`DELETE FROM fiches WHERE id = ?`).run(id);
  return result.changes > 0;
}
