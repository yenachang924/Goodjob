// Local test double for Supabase HTTP, backed by the actual app SQL in PGlite.
// Never imported by application code. No hosted credentials or external writes.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const owner = '11111111-1111-4111-8111-111111111111';
const email = 'test-owner@example.test';
const password = 'fixture-password';
const user = {
  id: owner,
  email,
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2026-09-01T00:00:00Z',
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');
const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: owner, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 })}.fixture-signature`;
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to authenticated, anon;`);
await db.query('insert into auth.users values ($1)', [owner]);
await db.exec(
  await readFile(
    new URL(
      '../../packages/backend/migrations/001_cockpit.sql',
      import.meta.url,
    ),
    'utf8',
  ),
);
await db.query('insert into public.cockpit_owners values ($1)', [owner]);
await db.exec(
  `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`,
);

const respond = (res, status, body) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': 'http://127.0.0.1:5321',
    'Access-Control-Allow-Headers':
      'authorization,apikey,content-type,x-client-info,x-supabase-api-version',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Expose-Headers': 'x-supabase-api-version',
  });
  res.end(JSON.stringify(body));
};

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('oversize');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:55439');
    if (req.method === 'OPTIONS') return respond(res, 200, {});
    if (url.pathname === '/health') return respond(res, 200, { fixture: true });
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      const value = await body(req);
      if (
        (value.email !== email || value.password !== password) &&
        value.refresh_token !== 'fixture-refresh'
      )
        return respond(res, 400, {
          error: 'invalid_grant',
          message: 'Invalid fixture credentials',
        });
      return respond(res, 200, {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Math.floor(Date.now() / 1000) + 86400,
        refresh_token: 'fixture-refresh',
        user,
      });
    }
    if (req.headers.authorization !== `Bearer ${accessToken}`)
      return respond(res, 401, { message: 'Unauthorized fixture token' });
    if (url.pathname === '/auth/v1/user') return respond(res, 200, user);
    if (url.pathname === '/auth/v1/logout') return respond(res, 200, {});
    if (url.pathname === '/rest/v1/cockpit_workspaces') {
      const result = await db.query(
        'select data,revision from public.cockpit_workspaces where user_id=$1',
        [owner],
      );
      return respond(res, 200, result.rows[0] ?? null);
    }
    if (url.pathname === '/rest/v1/rpc/consume_cockpit_request') {
      const result = await db.query(
        'select public.consume_cockpit_request() as value',
      );
      return respond(res, 200, result.rows[0].value);
    }
    if (url.pathname === '/rest/v1/rpc/save_cockpit_workspace') {
      const value = await body(req);
      const result = await db.query(
        'select public.save_cockpit_workspace($1::jsonb,$2) as value',
        [JSON.stringify(value.p_data), value.p_revision],
      );
      return respond(res, 200, result.rows[0].value);
    }
    return respond(res, 404, { message: 'Fixture endpoint not found' });
  } catch {
    return respond(res, 500, { message: 'Fixture request failed' });
  }
});
server.listen(55439, '127.0.0.1');
process.once('SIGINT', () => {
  server.closeAllConnections();
  server.close(() => void db.close());
});
process.once('SIGTERM', () => {
  server.closeAllConnections();
  server.close(() => void db.close());
});
