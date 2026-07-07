import assert from 'node:assert/strict';
import { test } from 'node:test';

import { friendlyMessage, parseOAuthError } from './oauth-error';

test('parseOAuthError: returns null for a clean URL', () => {
  assert.equal(parseOAuthError('https://www.myjelli.site/'), null);
  assert.equal(parseOAuthError('https://www.myjelli.site/?foo=bar'), null);
});

test('parseOAuthError: reads error params from the query string', () => {
  const info = parseOAuthError(
    'https://www.myjelli.site/?error=server_error&error_code=unexpected_failure&error_description=Error+getting+user+profile+from+external+provider',
  );
  assert.deepEqual(info, {
    error: 'server_error',
    code: 'unexpected_failure',
    // '+' decodes to spaces via URLSearchParams.
    description: 'Error getting user profile from external provider',
  });
});

test('parseOAuthError: reads error params from the hash fragment', () => {
  const info = parseOAuthError('https://www.myjelli.site/#error=access_denied&error_description=nope');
  assert.equal(info?.error, 'access_denied');
  assert.equal(info?.description, 'nope');
});

test('parseOAuthError: handles the real Spotify redirect (query + hash)', () => {
  const info = parseOAuthError(
    'https://www.myjelli.site/?error=server_error&error_code=unexpected_failure&error_description=Error+getting+user+profile+from+external+provider#error=server_error&error_code=unexpected_failure&error_description=Error+getting+user+profile+from+external+provider&sb=',
  );
  assert.equal(info?.error, 'server_error');
  assert.equal(info?.code, 'unexpected_failure');
});

test('friendlyMessage: dev-mode profile failure nudges toward email', () => {
  const msg = friendlyMessage({
    error: 'server_error',
    code: 'unexpected_failure',
    description: 'Error getting user profile from external provider',
  });
  assert.match(msg, /beta/i);
  assert.match(msg, /email/i);
});

test('friendlyMessage: falls back to the raw description for unknown errors', () => {
  assert.equal(
    friendlyMessage({ error: 'weird_error', description: 'Something specific broke' }),
    'Something specific broke',
  );
});
