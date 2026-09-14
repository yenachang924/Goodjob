import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createDependencies } from '../src/supabase.ts';
import { initialData } from '@cockpit/shared';
import { migrateWorkspace } from '@cockpit/shared/control';

test('real Supabase SDK forwards bearer and validates provider responses', async () => {
  let reply = { status: 200, body: null };
  let seen;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    seen = {
      url: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString(),
    };
    response.writeHead(reply.status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(reply.body));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const deps = createDependencies(
      {
        url: `http://127.0.0.1:${server.address().port}`,
        publishableKey: 'test-public-key',
        ownerId: 'owner',
      },
      'Bearer test-token',
    );
    reply = { status: 200, body: { id: 'owner' } };
    assert.equal(await deps.authenticate('test-token'), 'owner');
    assert.equal(seen.url, '/auth/v1/user');
    assert.equal(seen.headers.authorization, 'Bearer test-token');
    reply = { status: 401, body: { message: 'expired', code: 'bad_jwt' } };
    assert.equal(await deps.authenticate('expired-token'), null);
    reply = { status: 200, body: null };
    assert.deepEqual(await deps.repository.read('owner'), {
      data: initialData,
      revision: 0,
    });
    assert.match(seen.url, /user_id=eq.owner/);
    assert.equal(seen.headers.authorization, 'Bearer test-token');
    reply = { status: 200, body: { data: initialData, revision: 2 } };
    assert.equal((await deps.repository.read('owner')).revision, 2);
    const upgraded = migrateWorkspace(initialData);
    reply = { status: 200, body: { data: upgraded, revision: 3 } };
    assert.deepEqual(await deps.repository.read('owner'), {
      data: upgraded,
      revision: 3,
    });
    reply = {
      status: 200,
      body: { data: { ...upgraded, version: 3 }, revision: 3 },
    };
    await assert.rejects(deps.repository.read('owner'), /Invalid stored/);
    reply = { status: 200, body: { data: {}, revision: 2 } };
    await assert.rejects(deps.repository.read('owner'), /Invalid stored/);
    reply = { status: 200, body: 3 };
    assert.equal(await deps.repository.save('owner', initialData, 2), 3);
    assert.equal(seen.url, '/rest/v1/rpc/save_cockpit_workspace');
    assert.deepEqual(JSON.parse(seen.body), {
      p_data: initialData,
      p_revision: 2,
    });
    reply = { status: 200, body: null };
    assert.equal(await deps.repository.save('owner', initialData, 2), null);
    reply = { status: 200, body: 'invalid' };
    await assert.rejects(
      deps.repository.save('owner', initialData, 2),
      /Invalid revision/,
    );
    reply = { status: 200, body: true };
    assert.equal(await deps.repository.consumeRateLimit('owner'), true);
    reply = { status: 200, body: false };
    assert.equal(await deps.repository.consumeRateLimit('owner'), false);
    reply = { status: 200, body: null };
    await assert.rejects(
      deps.repository.consumeRateLimit('owner'),
      /unavailable/,
    );
    reply = { status: 403, body: { message: 'private provider error' } };
    await assert.rejects(
      deps.repository.read('owner'),
      /Workspace read failed/,
    );
    await assert.rejects(
      deps.repository.save('owner', initialData, 2),
      /Workspace write failed/,
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
