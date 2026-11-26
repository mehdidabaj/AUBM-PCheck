import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getPool } from "./db.js";
import type { AppRole, PublicUser, UserInput } from "../shared/types.js";

type UserRow = RowDataPacket & {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
};

function mapUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role === "admin" ? "admin" : "reader",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRole(role: string | undefined): AppRole {
  return role === "admin" ? "admin" : "reader";
}

export async function countUsers(): Promise<number> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM users`,
  );
  return Number((rows[0] as { c: number }).c || 0);
}

export async function needsInitialSetup(): Promise<boolean> {
  return (await countUsers()) === 0;
}

/**
 * Crée le tout premier compte (admin) de façon atomique (GET_LOCK).
 * Refusé s’il existe déjà des utilisateurs.
 */
export async function setupInitialAdmin(input: {
  username: string;
  displayName: string;
  password: string;
}): Promise<PublicUser> {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    const [lockRows] = await conn.query<RowDataPacket[]>(
      `SELECT GET_LOCK('aubm_pcheck_setup', 10) AS acquired`,
    );
    const acquired = Number((lockRows[0] as { acquired: number | null }).acquired);
    if (acquired !== 1) {
      throw new Error(
        "Impossible de verrouiller l’installation. Réessayez dans un instant.",
      );
    }

    try {
      await conn.beginTransaction();

      const [countRows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM users`,
      );
      if (Number((countRows[0] as { c: number }).c) > 0) {
        throw new Error("L’installation est déjà initialisée.");
      }

      const username = input.username.trim().toLowerCase();
      const displayName = (input.displayName || input.username).trim();
      const password = input.password;

      if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
        throw new Error(
          "Identifiant invalide (3–64 caractères : lettres, chiffres, . _ -).",
        );
      }
      if (!displayName || displayName.length > 120) {
        throw new Error("Nom affiché invalide.");
      }
      if (!password || password.length < 8) {
        throw new Error("Mot de passe trop court (8 caractères minimum).");
      }

      const hash = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();
      const id = randomUUID();

      await conn.query(
        `INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', ?, ?)`,
        [id, username, displayName, hash, now, now],
      );

      await conn.commit();

      const [rows] = await conn.query<UserRow[]>(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [id],
      );
      if (!rows[0]) throw new Error("Utilisateur introuvable après création.");
      return mapUser(rows[0]);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      await conn.query(`SELECT RELEASE_LOCK('aubm_pcheck_setup')`);
    }
  } finally {
    conn.release();
  }
}

export async function authenticate(
  username: string,
  password: string,
): Promise<PublicUser | null> {
  const pool = getPool();
  const [rows] = await pool.query<UserRow[]>(
    `SELECT * FROM users WHERE username = ? LIMIT 1`,
    [username.trim().toLowerCase()],
  );
  const row = rows[0];
  if (!row) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return mapUser(row);
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  const pool = getPool();
  const [rows] = await pool.query<UserRow[]>(
    `SELECT * FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function listUsers(): Promise<PublicUser[]> {
  const pool = getPool();
  const [rows] = await pool.query<UserRow[]>(
    `SELECT * FROM users ORDER BY username ASC`,
  );
  return rows.map(mapUser);
}

export async function createUser(input: UserInput): Promise<PublicUser> {
  const username = input.username.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = input.password;
  const role = normalizeRole(input.role);

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new Error(
      "Identifiant invalide (3–64 caractères : lettres, chiffres, . _ -).",
    );
  }
  if (!displayName || displayName.length > 120) {
    throw new Error("Nom affiché invalide.");
  }
  if (!password || password.length < 8) {
    throw new Error("Mot de passe trop court (8 caractères minimum).");
  }

  const pool = getPool();
  const hash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const id = randomUUID();

  try {
    await pool.query(
      `INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, username, displayName, hash, role, now, now],
    );
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === "ER_DUP_ENTRY") {
      throw new Error("Cet identifiant existe déjà.");
    }
    throw err;
  }

  const user = await getUserById(id);
  if (!user) throw new Error("Utilisateur introuvable après création.");
  return user;
}

export async function updateUser(
  id: string,
  patch: {
    displayName?: string;
    role?: AppRole;
    password?: string;
  },
): Promise<{ user: PublicUser; passwordChanged: boolean }> {
  const existing = await getUserById(id);
  if (!existing) throw new Error("Utilisateur introuvable.");

  const displayName = (patch.displayName ?? existing.displayName).trim();
  const role = normalizeRole(patch.role ?? existing.role);
  const now = new Date().toISOString();
  const pool = getPool();
  let passwordChanged = false;

  if (patch.password) {
    if (patch.password.length < 8) {
      throw new Error("Mot de passe trop court (8 caractères minimum).");
    }
    const hash = await bcrypt.hash(patch.password, 12);
    await pool.query(
      `UPDATE users SET display_name = ?, role = ?, password_hash = ?, updated_at = ? WHERE id = ?`,
      [displayName, role, hash, now, id],
    );
    passwordChanged = true;
  } else {
    await pool.query(
      `UPDATE users SET display_name = ?, role = ?, updated_at = ? WHERE id = ?`,
      [displayName, role, now, id],
    );
  }

  // Empêcher de se retrouver sans aucun admin
  const [admins] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`,
  );
  if (Number((admins[0] as { c: number }).c) < 1) {
    await pool.query(
      `UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?`,
      [now, id],
    );
    throw new Error("Impossible : il doit rester au moins un administrateur.");
  }

  const user = await getUserById(id);
  if (!user) throw new Error("Utilisateur introuvable.");
  return { user, passwordChanged };
}

export async function deleteUser(id: string, actorId: string): Promise<void> {
  if (id === actorId) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }
  const pool = getPool();
  const target = await getUserById(id);
  if (!target) throw new Error("Utilisateur introuvable.");

  if (target.role === "admin") {
    const [admins] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM users WHERE role = 'admin'`,
    );
    if (Number((admins[0] as { c: number }).c) <= 1) {
      throw new Error("Impossible de supprimer le dernier administrateur.");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    `DELETE FROM users WHERE id = ?`,
    [id],
  );
  if (result.affectedRows < 1) {
    throw new Error("Utilisateur introuvable.");
  }
}
