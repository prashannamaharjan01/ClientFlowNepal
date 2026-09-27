import type { Env, SessionUser } from './types';
import { getUserById } from './db';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

export function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function createSession(
  env: Env,
  userId: string,
  days = 30
): Promise<string> {
  const token = createToken();
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  ).toISOString();

  await env.DB
    .prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(crypto.randomUUID(), userId, tokenHash, expiresAt)
    .run();

  return token;
}

export async function getSessionUser(
  env: Env,
  request: Request
): Promise<SessionUser | null> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)clientflow_session=([^;]+)/);

  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  const tokenHash = await hashToken(token);

  const session = await env.DB
    .prepare(`
      SELECT user_id, expires_at
      FROM sessions
      WHERE token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<{ user_id: string; expires_at: string }>();

  if (!session) return null;
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await env.DB
      .prepare(`DELETE FROM sessions WHERE token_hash = ?`)
      .bind(tokenHash)
      .run();
    return null;
  }

  const user = await getUserById(env, session.user_id);
  if (!user) return null;

  return {
    id: String(user.id),
    email: String(user.email),
    name: String(user.name),
    role: String(user.role),
    workspaceId: String(user.workspace_id),
    workspaceName: String(user.workspace_name),
  };
}

export async function deleteSession(
  env: Env,
  request: Request
): Promise<void> {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)clientflow_session=([^;]+)/);

  if (!match) return;

  const token = decodeURIComponent(match[1]);
  const tokenHash = await hashToken(token);

  await env.DB
    .prepare(`DELETE FROM sessions WHERE token_hash = ?`)
    .bind(tokenHash)
    .run();
}

export function sessionCookie(token: string): string {
  return [
    `clientflow_session=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=2592000',
  ].join('; ');
}

export function clearSessionCookie(): string {
  return [
    'clientflow_session=',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ].join('; ');
}
