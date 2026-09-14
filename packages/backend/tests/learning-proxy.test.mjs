import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { learningProxy } from '../src/learning-proxy.ts';

const auth = `Basic ${Buffer.from('learner:test-password').toString('base64')}`;
const request = (path = '', options = {}) =>
  new Request(`http://app/api/learn/tasks${path}`, {
    ...options,
    headers: { authorization: auth, ...options.headers },
  });

test('learning proxy deadlines include inbound streaming and client cancellation', async () => {
  for (const abortClient of [true, false]) {
    let cancelled = false;
    const controller = new AbortController();
    const stream = new ReadableStream({
      start(output) {
        output.enqueue(new TextEncoder().encode('{'));
      },
      cancel() {
        cancelled = true;
      },
    });
    const pending = learningProxy(
      request('', {
        method: 'POST',
        body: stream,
        duplex: 'half',
        signal: controller.signal,
        headers: { origin: 'http://app', 'content-type': 'application/json' },
      }),
      'http://127.0.0.1:1',
    );
    if (abortClient) controller.abort();
    let timer;
    try {
      const result = await Promise.race([
        pending,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('proxy exceeded entire lifecycle deadline')),
            6500,
          );
        }),
      ]);
      assert.equal(result.status, 503);
      assert.equal(cancelled, true);
    } finally {
      clearTimeout(timer);
    }
  }
});

test('learning proxy fails closed on configuration, auth, origin and invalid route', async () => {
  assert.equal((await learningProxy(request(), undefined)).status, 503);
  assert.equal(
    (await learningProxy(request(), 'http://remote.example')).status,
    503,
  );
  assert.equal(
    (
      await learningProxy(
        request('', { headers: { authorization: '' } }),
        'http://127.0.0.1:8080',
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await learningProxy(
        request('', { method: 'POST', headers: { origin: 'http://evil' } }),
        'http://127.0.0.1:8080',
      )
    ).status,
    403,
  );
  assert.equal(
    (await learningProxy(request(), 'http://127.0.0.1:8080', '../private'))
      .status,
    400,
  );
  assert.equal(
    (
      await learningProxy(
        request('?redirect=http://evil'),
        'http://127.0.0.1:8080',
      )
    ).status,
    400,
  );
});

test('learning proxy forwards only allowed headers to fixed task API and preserves safe statuses', async () => {
  let seen;
  let result = {
    status: 200,
    body: { success: true, data: [], meta: { total: 0, page: 0, limit: 20 } },
  };
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    seen = {
      path: req.url,
      headers: req.headers,
      body: Buffer.concat(chunks).toString(),
    };
    res.writeHead(result.status, {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Basic',
      'Set-Cookie': 'unsafe=value',
    });
    res.end(JSON.stringify(result.body));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await learningProxy(
      request('?page=1&size=10', { headers: { cookie: 'session=private' } }),
      base,
    );
    assert.equal(response.status, 200);
    assert.equal(seen.path, '/api/v1/tasks?page=1&size=10');
    assert.equal(seen.headers.authorization, auth);
    assert.equal(seen.headers.cookie, undefined);
    assert.equal(response.headers.get('set-cookie'), null);
    assert.equal(response.headers.get('www-authenticate'), null);
    assert.match(response.headers.get('cache-control'), /no-store/);
    result = { status: 201, body: { success: true, data: { id: 'example' } } };
    const body = JSON.stringify({ title: '배우기' });
    assert.equal(
      (
        await learningProxy(
          request('', {
            method: 'POST',
            headers: {
              origin: 'http://app',
              'content-type': 'application/json',
            },
            body,
          }),
          base,
        )
      ).status,
      201,
    );
    assert.equal(seen.body, body);
    const browserRequest = (origin) =>
      request('', {
        method: 'POST',
        headers: {
          origin,
          'content-type': 'application/json',
          'x-forwarded-host': 'evil.example',
        },
        body,
      });
    assert.equal(
      (
        await learningProxy(
          browserRequest('http://127.0.0.1:5317'),
          base,
          undefined,
          'http://127.0.0.1:5317',
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await learningProxy(
          browserRequest('http://evil.example'),
          base,
          undefined,
          'http://127.0.0.1:5317',
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await learningProxy(
          browserRequest('http://app'),
          base,
          undefined,
          'http://127.0.0.1:5317',
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await learningProxy(
          browserRequest('http://app'),
          base,
          undefined,
          'invalid',
        )
      ).status,
      503,
    );
    for (const status of [401, 404, 409, 429]) {
      result = { status, body: { error: 'SQL credentials should not leak' } };
      const failure = await learningProxy(request(), base);
      assert.equal(failure.status, status);
      assert.doesNotMatch(await failure.text(), /SQL credentials/);
    }
    result = { status: 302, body: {} };
    assert.equal((await learningProxy(request(), base)).status, 503);
    result = { status: 500, body: { message: 'private failure' } };
    assert.equal((await learningProxy(request(), base)).status, 503);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test('learning proxy rejects oversized UTF-8 writes and unreachable upstream', async () => {
  const options = {
    method: 'POST',
    headers: { origin: 'http://app', 'content-type': 'application/json' },
    body: '가'.repeat(6000),
  };
  assert.equal(
    (await learningProxy(request('', options), 'http://127.0.0.1:1')).status,
    413,
  );
  assert.equal(
    (await learningProxy(request(), 'http://127.0.0.1:1')).status,
    503,
  );
});
