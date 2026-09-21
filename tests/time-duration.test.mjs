import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editedDurationRange,
  durationMinutes,
  durationRange,
  trackedDuration,
} from '../apps/web/features/project-control/time-duration.ts';

test('unchanged edits preserve milliseconds and explicit duration edits alone replace elapsed time', () => {
  const original = {
    startedAt: Date.parse('2026-09-20T10:00:00.123+09:00'),
    endedAt: Date.parse('2026-09-20T11:30:15.456+09:00'),
  };
  const now = Date.parse('2026-09-21T12:00:00+09:00');
  assert.deepEqual(
    editedDurationRange(original, '2026-09-20', '1', '30', false, now),
    original,
  );
  assert.deepEqual(
    editedDurationRange(original, '2026-09-20', '2', '', true, now),
    { startedAt: original.endedAt - 7200000, endedAt: original.endedAt },
  );
  assert.equal(
    editedDurationRange(original, '2026-09-19', '1', '30', false, now).endedAt,
    Date.parse('2026-09-20T00:00:00+09:00'),
  );
  assert.equal(
    editedDurationRange(null, '2026-09-21', '', '45', false, now).endedAt,
    now,
  );
});

test('separate hours and minutes accept either field and exact 24 hours', () => {
  assert.equal(durationMinutes('1', '30'), 90);
  assert.equal(durationMinutes('', '45'), 45);
  assert.equal(durationMinutes('2', ''), 120);
  assert.equal(durationMinutes('24', '0'), 1440);
});
test('duration rejects blank, zero, fractional, negative and out of range fields', () => {
  for (const pair of [
    ['', ''],
    ['0', '0'],
    ['1', '60'],
    ['24', '1'],
    ['25', ''],
    ['-1', '30'],
    ['1.5', '0'],
    ['a', '1'],
  ]) {
    assert.throws(() => durationMinutes(...pair));
  }
});
test('simple duration ends now today, or at midnight following a past date', () => {
  const now = Date.parse('2026-09-21T12:00:00+09:00');
  assert.deepEqual(durationRange('2026-09-21', 90, now), {
    startedAt: now - 5400000,
    endedAt: now,
  });
  const end = Date.parse('2026-09-20T00:00:00+09:00');
  assert.deepEqual(durationRange('2026-09-19', 45, now), {
    startedAt: end - 2700000,
    endedAt: end,
  });
  assert.throws(() => durationRange('2026-09-22', 30, now));
  assert.throws(() => durationRange('2026-02-30', 30, now));
  assert.throws(() => durationRange('bad', 30, now));
});
test('tracked summaries use hours and minutes without hiding subminute records', () => {
  assert.equal(trackedDuration(5400), '1시간 30분');
  assert.equal(trackedDuration(3600), '1시간');
  assert.equal(trackedDuration(120), '2분');
  assert.equal(trackedDuration(15), '1분 미만');
  assert.equal(trackedDuration(0), '0분');
});
