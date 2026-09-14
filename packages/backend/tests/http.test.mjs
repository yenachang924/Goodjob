import test from 'node:test';
import assert from 'node:assert/strict';
import { boundedText } from '../src/http.ts';

test('bounded text times out stalled streams and cancels the reader', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{'));
    },
    cancel() {
      cancelled = true;
    },
  });
  const outcome = await Promise.race([
    boundedText(stream, 100, AbortSignal.timeout(20)).then(
      () => 'resolved',
      () => 'timed-out',
    ),
    new Promise((resolve) => setTimeout(() => resolve('still-pending'), 200)),
  ]);
  assert.equal(outcome, 'timed-out');
  assert.equal(cancelled, true);
});
