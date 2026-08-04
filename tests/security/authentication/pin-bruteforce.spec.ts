import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';
import { probePinBruteforce } from '../sec-objects/authentication/pin-bruteforce.logic';

/**
 * Authentication - Weak password reset PIN (bruteforce)
 *
 * app.py's /reset-password has two code comments directly relevant here:
 * "Vulnerability: No rate limiting on PIN attempts" and "Vulnerability:
 * Timing attack possible in PIN verification". The PIN itself is only 3
 * digits (random.randint(100, 999) — 900 possibilities), which is only a
 * real problem if nothing throttles guesses. This fires a burst of wrong
 * guesses and then confirms the real PIN still works immediately after —
 * proving there's no lockout/backoff mechanism protecting the reset flow.
 */
const WRONG_GUESSES = 20;

test.describe('@security  Authentication - PIN reset bruteforce', () => {
  test('POST /reset-password should throttle or lock out repeated wrong PIN guesses', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const user = await test.step('Register a fresh user', async () => {
      const user = createRandomUser('pin-bruteforce');
      const register = await api.post('/register', {
        data: { username: user.username, password: user.password },
        headers: { 'Content-Type': 'application/json' }
      });
      if (![200, 201].includes(register.status())) {
        reporter.reportSkip('Could not register a fresh user for the PIN-bruteforce probe on this target.');
        await api.dispose();
        test.skip(true, 'Registration unavailable');
      }
      return user;
    });

    const probe = await test.step(`Request a reset PIN and send ${WRONG_GUESSES} wrong guesses`, async () => {
      const probe = await probePinBruteforce(api, user.username!, 'NewResetPassword789!', WRONG_GUESSES);
      await api.dispose();
      return probe;
    });

    if (!probe.requestedPin) {
      reporter.reportSkip('Could not obtain a reset PIN via /forgot-password on this target.');
      test.skip(true, 'Reset PIN unavailable');
      return;
    }

    await test.step('Verify wrong guesses were throttled or locked out', async () => {
      testInfo.attach('pin-bruteforce-probe', { body: JSON.stringify(probe, null, 2), contentType: 'application/json' });

      const any429 = probe.wrongGuessStatuses.includes(429);
      const noThrottleAndStillWorks = !any429 && probe.realPinStillWorks;

      if (noThrottleAndStillWorks) {
        reporter.reportVulnerability(
          'API4_RATE_LIMIT',
          {
            endpoint: 'POST /reset-password',
            wrongAttempts: probe.wrongAttempts,
            wrongGuessStatuses: probe.wrongGuessStatuses,
            realPinStillWorks: probe.realPinStillWorks
          },
          [
            'Rate-limit or lock out /reset-password after a small number of wrong PIN attempts for a given username.',
            'Use a longer, higher-entropy reset token (e.g. a UUID sent by email) instead of a 3-digit PIN.',
            'Use a constant-time comparison for the PIN check to close the timing-attack angle noted in app.py.'
          ]
        );
      } else {
        reporter.reportPass(
          `${WRONG_GUESSES} wrong PIN guesses were throttled/locked out, or the real PIN no longer worked afterward.`,
          'API4:2023 - Unrestricted Resource Consumption'
        );
      }
    });
  });
});
