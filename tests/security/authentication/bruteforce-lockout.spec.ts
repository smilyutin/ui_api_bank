import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';
import { probeBruteforceLockout } from '../sec-objects/authentication/bruteforce-lockout.logic';

/**
 * Authentication - Bruteforce lockout
 *
 * app.py has no failed-attempt tracking or account-lockout logic anywhere
 * (confirmed by inspection — there is no `failed_attempts`/`locked` column
 * or check in the schema or /login route). This is distinct from
 * tests/security/abuse/rate-limit.spec.ts, which checks for generic
 * per-request throttling (429s); this test checks specifically whether
 * repeated *wrong-password* attempts against one real account ever disable
 * that account, independent of whether individual requests get throttled.
 */
const WRONG_ATTEMPTS = 15;

test.describe('@security  Authentication - Bruteforce lockout', () => {
  test('an account should lock out after repeated failed login attempts', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const user = await test.step('Register a fresh user', async () => {
      const user = createRandomUser('bruteforce');
      const register = await api.post('/register', {
        data: { username: user.username, password: user.password },
        headers: { 'Content-Type': 'application/json' }
      });
      if (![200, 201].includes(register.status())) {
        reporter.reportSkip('Could not register a fresh user for the bruteforce probe on this target.');
        await api.dispose();
        test.skip(true, 'Registration unavailable');
      }
      return user;
    });

    const probe = await test.step(`Send ${WRONG_ATTEMPTS} wrong-password attempts, then the correct password`, async () => {
      const probe = await probeBruteforceLockout(api, user.username!, user.password, WRONG_ATTEMPTS);
      await api.dispose();

      testInfo.attach('bruteforce-lockout-probe', { body: JSON.stringify(probe, null, 2), contentType: 'application/json' });
      return probe;
    });

    await test.step('Verify the account locked out', async () => {
    if (probe.stillAuthenticatesAfterBurst) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: 'POST /login',
          wrongAttempts: probe.attempts,
          failureStatuses: probe.failureStatuses,
          correctPasswordStatusAfterBurst: probe.correctPasswordStatusAfterBurst
        },
        [
          'Track failed login attempts per account (and/or per IP) and lock the account temporarily after a threshold (e.g. 5 attempts).',
          'Return a distinct status (423 Locked, or a generic 401 with backoff) once locked, without confirming whether the account itself exists.',
          'Add exponential backoff between attempts in addition to a hard lockout threshold.'
        ]
      );
      } else {
        reporter.reportPass(
          `Account did not authenticate immediately with the correct password after ${probe.attempts} failed attempts.`,
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });
});
