import test from 'node:test';
import assert from 'node:assert/strict';

import * as recovery from '../apps/web/features/auth/recovery.ts';
test('password validation rejects short, long and mismatched values without trimming', () => {
  assert.equal(typeof recovery.validatePassword, 'function');
  assert.ok(recovery.validatePassword('short', 'short'));
  assert.ok(recovery.validatePassword('a'.repeat(129), 'a'.repeat(129)));
  assert.ok(
    recovery.validatePassword('long-password-one', 'long-password-two'),
  );
  assert.equal(
    recovery.validatePassword('a safe password ', 'a safe password '),
    null,
  );
});
test('callback reads recovery intent and only safe error messages', () => {
  assert.equal(typeof recovery.readAuthCallback, 'function');
  assert.deepEqual(
    recovery.readAuthCallback(
      '#type=recovery&access_token=private&refresh_token=private',
    ),
    { recovery: true, error: null },
  );
  assert.match(
    recovery.readAuthCallback('#error=access_denied&error_code=otp_expired')
      .error,
    /만료/,
  );
  assert.doesNotMatch(
    recovery.readAuthCallback('#error=bad&error_description=private').error,
    /private/,
  );
  assert.deepEqual(recovery.readAuthCallback(''), {
    recovery: false,
    error: null,
  });
  assert.match(recovery.readAuthCallback('#type=recovery').error, /링크/);
});
test('auth errors distinguish email confirmation, throttling, network and credentials', () => {
  assert.equal(typeof recovery.authErrorMessage, 'function');
  assert.match(
    recovery.authErrorMessage({ code: 'email_not_confirmed' }),
    /인증/,
  );
  assert.match(recovery.authErrorMessage({ status: 429 }), /잠시/);
  assert.match(
    recovery.authErrorMessage({ code: 'invalid_credentials' }),
    /이메일/,
  );
  assert.match(recovery.authErrorMessage(new TypeError('secret-url')), /연결/);
  assert.match(recovery.authErrorMessage({ code: 'same_password' }), /다른/);
  assert.match(recovery.authErrorMessage({ code: 'weak_password' }), /조건/);
  assert.doesNotMatch(
    recovery.authErrorMessage({ message: 'private-token' }),
    /private/,
  );
});
