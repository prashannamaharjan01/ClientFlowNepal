import type { Env } from './types';
import {
  createSession,
  getSessionUser,
  deleteSession,
  sessionCookie,
  clearSessionCookie,
} from './auth';
import { getUserByEmail, getUserById } from './db';
import { hashPassword, verifyPassword } from './password';

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function publicUser(user: Record<string, unknown>) {
  return {
    id: String(user.id),
    email: String(user.email),
    name: String(user.name),
    role: String(user.role),
    workspaceId: String(user.workspace_id),
    workspaceName: String(user.workspace_name),
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        return withCors(
          json({
            ok: true,
            app: env.APP_NAME,
            environment: env.ENVIRONMENT,
          })
        );
      }

      /*
       * SIGN UP
       */
      if (
        url.pathname === '/api/auth/signup' &&
        request.method === 'POST'
      ) {
        const body = await request.json<{
          name?: string;
          workspace?: string;
          email?: string;
          password?: string;
        }>();

        const name = String(body.name || '').trim();
        const workspaceName = String(body.workspace || '').trim();
        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!name || !workspaceName || !email || !password) {
          return withCors(
            json(
              {
                error:
                  'Name, workspace, email and password are required',
              },
              400
            )
          );
        }

        if (name.length < 2 || name.length > 100) {
          return withCors(
            json(
              { error: 'Name must be between 2 and 100 characters' },
              400
            )
          );
        }

        if (
          workspaceName.length < 2 ||
          workspaceName.length > 120
        ) {
          return withCors(
            json(
              {
                error:
                  'Workspace name must be between 2 and 120 characters',
              },
              400
            )
          );
        }

        if (!isValidEmail(email)) {
          return withCors(
            json({ error: 'Please enter a valid email address' }, 400)
          );
        }

        if (password.length < 8) {
          return withCors(
            json(
              { error: 'Password must be at least 8 characters' },
              400
            )
          );
        }

        const existingUser = await getUserByEmail(env, email);

        if (existingUser) {
          return withCors(
            json(
              { error: 'An account with this email already exists' },
              409
            )
          );
        }

        const userId = crypto.randomUUID();
        const workspaceId = crypto.randomUUID();
        const passwordHash = await hashPassword(password);

        try {
          await env.DB.batch([
            env.DB
              .prepare(`
                INSERT INTO users
                  (id, email, password_hash, name)
                VALUES (?, ?, ?, ?)
              `)
              .bind(userId, email, passwordHash, name),

            env.DB
              .prepare(`
                INSERT INTO workspaces
                  (id, name)
                VALUES (?, ?)
              `)
              .bind(workspaceId, workspaceName),

            env.DB
              .prepare(`
                INSERT INTO workspace_members
                  (workspace_id, user_id, role)
                VALUES (?, ?, 'owner')
              `)
              .bind(workspaceId, userId),
          ]);
        } catch (error) {
          console.error('Signup database error:', error);

          return withCors(
            json(
              { error: 'Unable to create the account' },
              500
            )
          );
        }

        const token = await createSession(env, userId);

        return withCors(
          json(
            {
              message: 'Workspace created',
              user: {
                id: userId,
                email,
                name,
                role: 'owner',
                workspaceId,
                workspaceName,
              },
            },
            201,
            {
              'Set-Cookie': sessionCookie(token),
            }
          )
        );
      }

      /*
       * LOGIN
       */
      if (
        url.pathname === '/api/auth/login' &&
        request.method === 'POST'
      ) {
        const body = await request.json<{
          email?: string;
          password?: string;
        }>();

        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!email || !password) {
          return withCors(
            json(
              { error: 'Email and password are required' },
              400
            )
          );
        }

        const user = await getUserByEmail(env, email);

        if (!user) {
          return withCors(
            json(
              { error: 'Invalid email or password' },
              401
            )
          );
        }

        const validPassword = await verifyPassword(
          password,
          String(user.password_hash || '')
        );

        if (!validPassword) {
          return withCors(
            json(
              { error: 'Invalid email or password' },
              401
            )
          );
        }

        const token = await createSession(
          env,
          String(user.id)
        );

        return withCors(
          json(
            {
              message: 'Signed in',
              user: publicUser(
                user as Record<string, unknown>
              ),
            },
            200,
            {
              'Set-Cookie': sessionCookie(token),
            }
          )
        );
      }

      /*
       * CURRENT USER
       */
      if (
        url.pathname === '/api/auth/me' &&
        request.method === 'GET'
      ) {
        const user = await getSessionUser(env, request);

        return withCors(
          json({
            authenticated: Boolean(user),
            user,
          })
        );
      }

      /*
       * LOGOUT
       */
      if (
        url.pathname === '/api/auth/logout' &&
        request.method === 'POST'
      ) {
        await deleteSession(env, request);

        return withCors(
          json(
            { ok: true },
            200,
            {
              'Set-Cookie': clearSessionCookie(),
            }
          )
        );
      }

      /*
       * WORKSPACE
       */
      if (
        url.pathname === '/api/workspace' &&
        request.method === 'GET'
      ) {
        const user = await getSessionUser(env, request);

        if (!user) {
          return withCors(
            json({ error: 'Unauthorized' }, 401)
          );
        }

        return withCors(
          json({
            workspace: {
              id: user.workspaceId,
              name: user.workspaceName,
            },
            user,
          })
        );
      }

      return withCors(
        json({ error: 'Not found' }, 404)
      );
    } catch (error) {
      console.error(error);

      return withCors(
        json(
          {
            error: 'Internal server error',
          },
          500
        )
      );
    }
  },
};
