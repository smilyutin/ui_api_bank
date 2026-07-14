import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';

/**
 * Authentication - Password policy
 *
 * app.py's /register reads `user_data.get('password')` and inserts it
 * directly with no length, complexity, or blocklist check of any kind —
 * confirmed live across four representative weak passwords, including an
 * empty string.
 */
const WEAK_PASSWORDS = ['', 'a', '123', 'password'];

test.describe('Authentication - Password policy', () => {
  test('POST /register should reject passwords with no length or complexity', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });

    const results: { password: string; status: number; accepted: boolean }[] = [];
    for (const password of WEAK_PASSWORDS) {
      const user = createRandomUser('pw-policy', false);
      const res = await api.post('/register', {
        data: { username: user.username, password },
        headers: { 'Content-Type': 'application/json' }
      });
      results.push({ password, status: res.status(), accepted: [200, 201].includes(res.status()) });
    }
    await api.dispose();

    testInfo.attach('password-policy-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });

    const acceptedWeakPasswords = results.filter((r) => r.accepted);

    if (acceptedWeakPasswords.length > 0) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: 'POST /register',
          acceptedWeakPasswords: acceptedWeakPasswords.map((r) => (r.password === '' ? '(empty string)' : r.password)),
          allResults: results
        },
        [
          'Enforce a minimum length (e.g. 8-12 characters) and reject an empty password outright.',
          'Require a mix of character classes, or better, check against a common-password/breached-password list (e.g. via zxcvbn or the Have I Been Pwned Pwned Passwords API) rather than rigid composition rules.',
          'Apply the same validation to /reset-password\'s new_password field, which has the same gap.'
        ]
      );
    } else {
      reporter.reportPass(
        `All ${results.length} weak passwords tested were rejected at registration.`,
        'API2:2023 - Broken Authentication'
      );
    }
  });
});
