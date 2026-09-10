import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspaceHandlers } from '../src/handlers.ts';
import { initialData } from '../../shared/src/planner.ts';
const url = 'https://cockpit.test/api/workspace';
function fixture({
  user = 'owner',
  unavailable = false,
  limited = false,
} = {}) {
  let snapshot = { data: initialData, revision: 0 };
  const dependencies = {
    ownerId: 'owner',
    authenticate: async () => user,
    repository: {
      read: async () => {
        if (unavailable) throw Error('secret');
        return snapshot;
      },
      save: async (id, data, revision) => {
        if (unavailable) throw Error('secret');
        if (revision !== snapshot.revision) return null;
        snapshot = { data, revision: revision + 1 };
        return snapshot.revision;
      },
      consumeRateLimit: async () => !limited,
    },
  };
  return createWorkspaceHandlers(dependencies);
}
const request = (body, token = 'valid') =>
  new Request(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Origin: 'https://cockpit.test',
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
test('unauthenticated and nonowner cannot read', async () => {
  assert.equal((await fixture().GET(new Request(url))).status, 401);
  assert.equal(
    (
      await fixture({ user: null }).GET(
        new Request(url, { headers: { Authorization: 'Bearer invalid' } }),
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await fixture({ user: 'other' }).PUT(
        request({ data: initialData, revision: 0 }),
      )
    ).status,
    403,
  );
});
test('save and reload preserve workspace; stale write rejected', async () => {
  const app = fixture();
  const payload = {
    ...initialData,
    tasks: [
      {
        id: 'a',
        title: 'study',
        project: '논리회로',
        minutes: 30,
        priority: 1,
        done: false,
        due: '',
      },
    ],
  };
  assert.equal(
    (await app.PUT(request({ data: payload, revision: 0, userId: 'other' })))
      .status,
    200,
  );
  const response = await app.GET(
    new Request(url, { headers: { Authorization: 'Bearer valid' } }),
  );
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await response.json(), { data: payload, revision: 1 });
  assert.equal(
    (await app.PUT(request({ data: initialData, revision: 0 }))).status,
    409,
  );
});
test('new workspace cannot be inserted at nonzero revision', async () => {
  assert.equal(
    (await fixture().PUT(request({ data: initialData, revision: 5 }))).status,
    409,
  );
});
test('malformed and invalid payloads return 400', async () => {
  for (const body of [
    '{',
    'null',
    { data: {}, revision: 0 },
    { data: initialData, revision: -1 },
    { data: initialData, revision: 0.5 },
  ])
    assert.equal((await fixture().PUT(request(body))).status, 400);
});
test('UTF-8 limits apply before parsing, cross-origin rejected', async () => {
  assert.equal((await fixture().PUT(request('한'.repeat(350000)))).status, 413);
  const r = request({ data: initialData, revision: 0 });
  r.headers.set('Origin', 'https://evil.test');
  assert.equal((await fixture().PUT(r)).status, 403);
});
test('storage errors sanitized and rate limits enforced', async () => {
  const response = await fixture({ unavailable: true }).PUT(
    request({ data: initialData, revision: 0 }),
  );
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret/);
  assert.equal(
    (
      await fixture({ limited: true }).PUT(
        request({ data: initialData, revision: 0 }),
      )
    ).status,
    429,
  );
});
