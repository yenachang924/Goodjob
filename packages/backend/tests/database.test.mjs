import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
test('Postgres RLS, atomic revision checks and persistent limiter', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated, anon;
      insert into auth.users values ('${owner}'), ('${other}');`);
    await db.exec(
      await readFile(
        new URL('../migrations/001_cockpit.sql', import.meta.url),
        'utf8',
      ),
    );
    await db.query('insert into public.cockpit_owners values ($1)', [owner]);
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    const data = { projects: ['논리회로'], tasks: [], days: {} };
    const save = async (revision) =>
      (
        await db.query(
          'select public.save_cockpit_workspace($1::jsonb,$2) as revision',
          [JSON.stringify(data), revision],
        )
      ).rows[0].revision;
    assert.equal(await save(9), null);
    assert.equal(await save(0), 1);
    assert.equal(await save(0), null);
    assert.equal(await save(1), 2);
    assert.equal(await save(1), null);
    await assert.rejects(() =>
      db.query('update public.cockpit_workspaces set data=$1', [
        JSON.stringify({ projects: null, tasks: null, days: null }),
      ]),
    );
    await assert.rejects(() =>
      db.query('select public.save_cockpit_workspace($1,2)', [
        JSON.stringify({ projects: null, tasks: null, days: null }),
      ]),
    );
    assert.deepEqual(
      (await db.query('select data from public.cockpit_workspaces')).rows[0]
        .data,
      data,
    );
    assert.equal(
      (await db.query('select public.consume_cockpit_request() as allowed'))
        .rows[0].allowed,
      true,
    );
    await db.exec(
      `reset role; update cockpit_private.request_limits set hits=120; set role authenticated;`,
    );
    assert.equal(
      (await db.query('select public.consume_cockpit_request() as allowed'))
        .rows[0].allowed,
      false,
    );
    await db.exec(
      `select set_config('request.jwt.claim.sub','${other}',false)`,
    );
    assert.equal(
      (await db.query('select * from public.cockpit_workspaces')).rows.length,
      0,
    );
    await assert.rejects(() => save(0));
    await assert.rejects(() =>
      db.query(
        'insert into public.cockpit_workspaces(user_id,data) values ($1,$2)',
        [owner, JSON.stringify(data)],
      ),
    );
    await db.exec('reset role; set role anon;');
    await assert.rejects(() =>
      db.query('select * from public.cockpit_workspaces'),
    );
    await assert.rejects(() =>
      db.query('select public.save_cockpit_workspace($1,0)', [
        JSON.stringify(data),
      ]),
    );
  } finally {
    await db.close();
  }
});
