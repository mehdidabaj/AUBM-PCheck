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

export async function ensureBootstrapAdmin(): Promise<{
  created: boolean;
  username?: string;
}> {
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM users`,
  );
  const count = Number((rows[0] as { c: number }).c || 0);
  if (count > 0) {
    // Le mot de passe en clair dans l'env ne sert plus après le bootstrap
    delete process.env.ADMIN_PASSWORD;
    return { created: false };
  }

  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "AdminChangeMe!2026";
  const displayName = process.env.ADMIN_DISPLAY_NAME || "Administrateur";
  const hash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();

  await pool.query(
    `INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'admin', ?, ?)`,
    [randomUUID(), username, displayName, hash, now, now],
  );

  // Ne pas garder le secret en clair dans le process Node
  delete process.env.ADMIN_PASSWORD;

  console.log(
    `Compte admin initial créé : ${username} (mot de passe hashé en MySQL — retirez ADMIN_PASSWORD du .env)`,
  );
  return { created: true, username };
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
): Promise<PublicUser> {
  const existing = await getUserById(id);
  if (!existing) throw new Error("Utilisateur introuvable.");

  const displayName = (patch.displayName ?? existing.displayName).trim();
  const role = normalizeRole(patch.role ?? existing.role);
  const now = new Date().toISOString();
  const pool = getPool();

  if (patch.password) {
    if (patch.password.length < 8) {
      throw new Error("Mot de passe trop court (8 caractères minimum).");
    }
    const hash = await bcrypt.hash(patch.password, 12);
    await pool.query(
      `UPDATE users SET display_name = ?, role = ?, password_hash = ?, updated_at = ? WHERE id = ?`,
      [displayName, role, hash, now, id],
    );
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
  return user;
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
