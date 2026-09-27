import type { Env } from './types';

export async function getUserByEmail(env: Env, email: string) {
  return env.DB
    .prepare(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.password_hash,
        wm.role,
        w.id AS workspace_id,
        w.name AS workspace_name
      FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE lower(u.email) = lower(?)
      LIMIT 1
    `)
    .bind(email)
    .first();
}

export async function getUserById(env: Env, userId: string) {
  return env.DB
    .prepare(`
      SELECT
        u.id,
        u.email,
        u.name,
        wm.role,
        w.id AS workspace_id,
        w.name AS workspace_name
      FROM users u
      JOIN workspace_members wm ON wm.user_id = u.id
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE u.id = ?
      LIMIT 1
    `)
    .bind(userId)
    .first();
}
