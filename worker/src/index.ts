import type { Env } from './types';
import {
  createSession,
  getSessionUser,
  deleteSession,
  sessionCookie,
  clearSessionCookie,
} from './auth';
import { getUserByEmail } from './db';

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

      if (url.pathname === '/api/auth/me' && request.method === 'GET') {
        const user = await getSessionUser(env, request);

        return withCors(
          json({
            authenticated: Boolean(user),
            user,
          })
        );
      }

      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        const body = await request.json<{
          email?: string;
          password?: string;
        }>();

        const email = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');

        if (!email || !password) {
          return withCors(
            json({ error: 'Email and password are required' }, 400)
          );
        }

        const user = await getUserByEmail(env, email);

        if (!user) {
          return withCors(
            json({ error: 'Invalid email or password' }, 401)
          );
        }

        return withCors(
          json(
            {
              message:
                'User found. Password verification will be enabled with the production password hash field.',
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                workspaceId: user.workspace_id,
                workspaceName: user.workspace_name,
              },
            },
            200
          )
        );
      }

      if (url.pathname === '/api/auth/logout' && request.method === 'POST') {
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

      if (url.pathname === '/api/workspace' && request.method === 'GET') {
        const user = await getSessionUser(env, request);

        if (!user) {
          return withCors(json({ error: 'Unauthorized' }, 401));
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

      return withCors(json({ error: 'Not found' }, 404));
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
