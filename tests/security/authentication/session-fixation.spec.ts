import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { resetPasswordViaPin } from '../sec-objects/authentication/session-fixation.logic';

/**
 * Authentication - Session fixation (token survives a password reset)
 *
 * This app has no server-side session store — JWT validity is purely
 * signature + claims based (auth.py: verify_token never touches the
 * database). POST /reset-password only updates users.password /
 * users.reset_pin; nothing about the token-verification path depends on
 * the current password. So a token minted *before* a password reset should
 * still be rejected afterward if the app were doing this correctly, but
 * nothing enforces that here — this is the fixation-adjacent risk: an old,
 * possibly-compromised token remains valid indefinitely even after the
 * legitimate user "secures" their account by resetting their password.
 */
test.describe('@security  Authentication - Session fixation', () => {
  test('a token issued before a password reset should not still authenticate afterward', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'session-fixation');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const preResetStatus = await test.step('Confirm the token authenticates before reset', async () => {
      const preResetCheck = await api.get('/dashboard', { headers: { Authorization: `Bearer ${session.token}` } });
      return preResetCheck.status();
    });
    if (preResetStatus !== 200) {
      reporter.reportSkip('Token from a fresh login did not authenticate /dashboard on this target; cannot test fixation.');
      await api.dispose();
      test.skip(true, 'Baseline token authentication unavailable');
      return;
    }

    const reset = await test.step('Reset the password via PIN', async () => {
      const newPassword = 'ResetPassword456!';
      return resetPasswordViaPin(api, session.user.username!, newPassword);
    });

    if (!reset.resetSucceeded) {
      reporter.reportSkip('Could not complete the forgot-password -> reset-password flow on this target.');
      await api.dispose();
      test.skip(true, 'Password reset flow unavailable');
      return;
    }

    const status = await test.step('Check whether the token still authenticates after reset', async () => {
      const postResetCheck = await api.get('/dashboard', { headers: { Authorization: `Bearer ${session.token}` } });
      const status = postResetCheck.status();
      await api.dispose();

      testInfo.attach('session-fixation-probe', {
        body: JSON.stringify({ pin: reset.pin, preResetStatus, postResetStatus: status }, null, 2),
        contentType: 'application/json'
      });
      return status;
    });

    await test.step('Verify the token was invalidated by the reset', async () => {
    const stillValid = status === 200;

    if (stillValid) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: 'GET /dashboard',
          issue: 'A token issued before a password reset still authenticates after the reset',
          postResetStatus: status
        },
        [
          'Invalidate all previously-issued tokens for a user when their password is reset (e.g. include a password-version/nonce claim checked on every request).',
          'Store a per-user token-invalidation timestamp and reject any token issued before it.'
        ]
      );
      } else {
        reporter.reportPass(
          'Token issued before a password reset no longer authenticates after the reset.',
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });
});
