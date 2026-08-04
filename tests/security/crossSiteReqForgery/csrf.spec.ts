import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';

/**
 * Cross-Site Request Forgery
 *
 * app.py:1393 has an explicit `# Vulnerability: No CSRF protection`
 * comment — there is no CSRF token issuance or validation anywhere.
 * Combined with two already-confirmed facts:
 *   - the login cookie alone authenticates state-changing requests with no
 *     Authorization header at all (tests/security/authentication/auth.cookies.spec.ts)
 *   - that cookie has no SameSite attribute (tests/security/authentication/inspect-cookies.spec.ts)
 * ...a real cross-site request — simulated here via a foreign Origin/
 * Referer header and no CSRF token, same as a victim's browser would send
 * automatically to a malicious page's auto-submitting form/fetch — should
 * still succeed against a state-changing endpoint.
 */
const FOREIGN_ORIGIN = 'https://evil.example.com';

test.describe('Cross-Site Request Forgery', () => {
  test('POST /transfer should not process a cross-site request with no CSRF token', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const setupApi = await request.newContext({ baseURL: baseURL.toString() });
    const sender = await establishAccountSession(setupApi, 'csrf-sender');
    const recipient = await establishAccountSession(setupApi, 'csrf-recipient');
    await setupApi.dispose();

    if (!sender || !recipient) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      test.skip(true, 'No account sessions available');
      return;
    }

    const { status, forgedBody, balanceBefore, balanceAfter } = await test.step('Simulate a cross-site transfer request', async () => {
      // Cookie-only context — no Authorization header at all, matching what a
      // victim's browser sends automatically on a cross-site request.
      const cookieOnlyApi = await request.newContext({
        baseURL: baseURL.toString(),
        extraHTTPHeaders: {
          Cookie: `token=${sender.token}`,
          Origin: FOREIGN_ORIGIN,
          Referer: `${FOREIGN_ORIGIN}/attack.html`
        }
      });

      const balanceBeforeRes = await cookieOnlyApi.get(`/check_balance/${sender.accountNumber}`);
      const balanceBefore = (await balanceBeforeRes.json().catch(() => null))?.balance;

      const forgedRes = await cookieOnlyApi.post('/transfer', {
        data: { to_account: recipient.accountNumber, amount: 10 }
      });
      const forgedBody = await forgedRes.json().catch(() => null);
      const status = forgedRes.status();

      const balanceAfterRes = await cookieOnlyApi.get(`/check_balance/${sender.accountNumber}`);
      const balanceAfter = (await balanceAfterRes.json().catch(() => null))?.balance;
      await cookieOnlyApi.dispose();

      testInfo.attach('csrf-probe', {
        body: JSON.stringify(
          { origin: FOREIGN_ORIGIN, status, forgedBody, balanceBefore, balanceAfter },
          null,
          2
        ),
        contentType: 'application/json'
      });
      return { status, forgedBody, balanceBefore, balanceAfter };
    });

    await test.step('Verify the transfer was not processed', async () => {
    const csrfSucceeded = status === 200 && forgedBody?.status === 'success' && balanceAfter === balanceBefore - 10;

    if (csrfSucceeded) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: 'POST /transfer',
          technique: 'Cookie-only auth, foreign Origin/Referer, no CSRF token',
          balanceBefore,
          balanceAfter
        },
        [
          'Require a CSRF token (double-submit cookie or synchronizer token) on every state-changing request authenticated via cookie.',
          'Set the token cookie\'s SameSite attribute to Lax or Strict (see inspect-cookies.spec.ts) as a second layer of defense.',
          'Validate the Origin/Referer header on state-changing requests and reject mismatches.'
        ]
      );
      } else {
        reporter.reportPass(
          'A cross-site request (foreign Origin/Referer, cookie-only auth, no CSRF token) did not complete the transfer.',
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });
});
