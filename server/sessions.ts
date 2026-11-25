import { randomBytes } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db.js";
import { getUserById } from "./users.js";
import type { PublicUser } from "../shared/types.js";

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);

export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const pool = getPool();
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const createdAt = new Date().toISOString();

  await pool.query(
    `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    [token, userId, expiresAt, createdAt],
  );

  return { token, expiresAt };
}

export async function getSessionUser(
  token: string | undefined,
): Promise<PublicUser | null> {
  if (!token) return null;
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT user_id, expires_at FROM sessions WHERE id = ? LIMIT 1`,
    [token],
  );
  const row = rows[0] as
    | { user_id: string; expires_at: Date | string }
    | undefined;
  if (!row) return null;

  const expires =
    row.expires_at instanceof Date
      ? row.expires_at
      : new Date(row.expires_at);
  if (Number.isNaN(expires.getTime()) || expires.getTime() < Date.now()) {
    await destroySession(token);
    return null;
  }

  return getUserById(row.user_id);
}

export async function destroySession(token: string | undefined) {
  if (!token) return;
  const pool = getPool();
  await pool.query<ResultSetHeader>(`DELETE FROM sessions WHERE id = ?`, [
    token,
  ]);
}

export async function destroyUserSessions(userId: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM sessions WHERE user_id = ?`, [userId]);
}

export async function purgeExpiredSessions() {
  const pool = getPool();
  await pool.query(`DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP()`);
}
