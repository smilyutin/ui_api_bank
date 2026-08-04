import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';

/**
 * Authentication - Generic login error messages (username enumeration)
 *
 * app.py's /login runs one query matching both username AND password
 * together (`WHERE username='{u}' AND password='{p}'`), so "no such user"
 * and "wrong password for a real user" both fall through to the exact same
 * `else` branch — there is no separate code path that could leak whether a
 * username exists. This test confirms that's actually true by comparing
 * both cases directly, rather than assuming it from reading the code.
 *
 * (This is a different endpoint from /forgot-password, which *does*
 * distinguish "user not found" (404) from "user found" (200 with a PIN) —
 * a real, separate username-enumeration vector on that endpoint, tracked
 * in TODO.md alongside the wider password-reset gap rather than here.)
 */
test.describe('@security  Authentication - Generic login errors', () => {
  test('a nonexistent username and a wrong password for a real user should return identical errors', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const user = await test.step('Register a fresh user', async () => {
      const user = createRandomUser('generic-errors');
      const register = await api.post('/register', {
        data: { username: user.username, password: user.password },
        headers: { 'Content-Type': 'application/json' }
      });
      if (![200, 201].includes(register.status())) {
        reporter.reportSkip('Could not register a fresh user for the generic-errors probe on this target.');
        await api.dispose();
        test.skip(true, 'Registration unavailable');
      }
      return user;
    });

    const probe = await test.step('Log in with a nonexistent username and a wrong password', async () => {
      const nonexistentRes = await api.post('/login', {
        data: { username: `${user.username}-does-not-exist`, password: 'irrelevant' },
        headers: { 'Content-Type': 'application/json' }
      });
      const wrongPasswordRes = await api.post('/login', {
        data: { username: user.username, password: 'definitely-wrong-password' },
        headers: { 'Content-Type': 'application/json' }
      });
      await api.dispose();

      const nonexistentBody = await nonexistentRes.json().catch(() => null);
      const wrongPasswordBody = await wrongPasswordRes.json().catch(() => null);

      const probe = {
        nonexistentUser: { status: nonexistentRes.status(), message: nonexistentBody?.message },
        wrongPassword: { status: wrongPasswordRes.status(), message: wrongPasswordBody?.message }
      };
      testInfo.attach('generic-login-errors-probe', { body: JSON.stringify(probe, null, 2), contentType: 'application/json' });
      return probe;
    });

    await test.step('Verify the errors are identical', async () => {
      const identical =
        probe.nonexistentUser.status === probe.wrongPassword.status &&
        probe.nonexistentUser.message === probe.wrongPassword.message;

      if (!identical) {
        reporter.reportVulnerability(
          'API2_AUTH',
          { endpoint: 'POST /login', ...probe },
          [
            'Return the exact same status and message for "user not found" and "wrong password" — do not let the two cases diverge.',
            'Apply the same fix to /forgot-password, which currently does distinguish the two cases (404 "User not found" vs 200 with a PIN).'
          ]
        );
      } else {
        reporter.reportPass(
          'Login returns identical errors for a nonexistent username and a wrong password on a real account.',
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });
});
