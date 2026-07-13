import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';

/**
 * Authentication - Plaintext password storage
 *
 * database.py stores users.password as plain TEXT with a code comment
 * confirming intent: `password TEXT NOT NULL, -- Vulnerability: Passwords
 * stored in plaintext`. That's not directly observable over HTTP on its
 * own, but GET /debug/users (fully unauthenticated) returns every user
 * row including the raw password field — this registers a fresh user with
 * a known password and confirms it comes back byte-for-byte in that
 * response, proving storage is plaintext rather than just asserting it
 * from the schema comment.
 */
test.describe('Authentication - Plaintext password storage', () => {
  test('GET /debug/users should not return a freshly-registered password in plaintext', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const user = createRandomUser('plaintext-pw', false);
    const register = await api.post('/register', {
      data: { username: user.username, password: user.password },
      headers: { 'Content-Type': 'application/json' }
    });
    if (![200, 201].includes(register.status())) {
      reporter.reportSkip('Could not register a fresh user for the plaintext-password probe on this target.');
      await api.dispose();
      test.skip(true, 'Registration unavailable');
      return;
    }

    const debugRes = await api.get('/debug/users');
    const status = debugRes.status();

    if (status === 404) {
      reporter.reportPass('GET /debug/users is not present on this target.', 'API9:2023 - Improper Inventory Management');
      await api.dispose();
      return;
    }

    const body = await debugRes.json().catch(() => null);
    await api.dispose();

    const matchedUser = body?.users?.find((u: any) => u.username === user.username);
    const plaintextExposed = matchedUser?.password === user.password;

    testInfo.attach('plaintext-password-probe', {
      body: JSON.stringify({ endpoint: 'GET /debug/users', username: user.username, plaintextExposed, matchedPasswordField: matchedUser?.password }, null, 2),
      contentType: 'application/json'
    });

    if (plaintextExposed) {
      reporter.reportVulnerability(
        'API3_DATA_EXPOSURE',
        {
          endpoint: 'GET /debug/users',
          issue: 'Unauthenticated endpoint returns every user\'s password in plaintext',
          exampleUsername: user.username
        },
        [
          'Hash passwords with bcrypt/argon2 (cost factor >= 12) at registration and reset time — never store or return plaintext.',
          'Remove GET /debug/users entirely, or at minimum require admin authentication and exclude the password field regardless.',
          'Audit for any other debug/*  routes with the same exposure pattern.'
        ]
      );
    } else {
      reporter.reportPass('Registered password was not returned in plaintext.', 'API3:2023 - Broken Object Property Level Authorization');
    }
  });
});
