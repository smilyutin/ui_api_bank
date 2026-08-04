import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { decodeJwtNoVerify } from '../sec-objects/authentication/jwt.logic';

/**
 * Authentication - Session timeout
 *
 * Complements tests/security/authentication/jwt.spec.ts (which checks the
 * token's `exp` claim in isolation): this test asks the black-box
 * question a real session-timeout check needs answered — does *anything*
 * in the app enforce a session lifetime independent of the token itself?
 * There's no server-side session store here (auth.py's token_required only
 * checks the JWT signature/claims), so if there's no `exp` claim, there is
 * categorically no timeout mechanism at all: the same token keeps
 * authenticating indefinitely.
 *
 * This replaces the toothless check that used to live in
 * tests/ui/specs/dashboard.spec.ts ("should handle session timeout
 * gracefully"), which passed on either outcome and never actually asserted
 * anything — that test and its supporting page-object helper have since
 * been deleted (see TODO.md).
 */
test.describe('Authentication - Session timeout', () => {
  test('a session should not remain authenticated indefinitely with no expiration mechanism', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'session-timeout');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { hasExp, decoded, status } = await test.step('Decode the JWT and confirm it still authenticates', async () => {
      const decoded = decodeJwtNoVerify(session.token);
      const hasExp = !!decoded?.payload && 'exp' in decoded.payload;

      // Functional proof, not just claim inspection: the same token
      // authenticates a protected endpoint right now, with no session-store
      // side channel that could independently expire it.
      const res = await api.get('/dashboard', { headers: { Authorization: `Bearer ${session.token}` } });
      const status = res.status();
      await api.dispose();

      testInfo.attach('session-timeout-probe', {
        body: JSON.stringify({ hasExp, payload: decoded?.payload, dashboardStatus: status }, null, 2),
        contentType: 'application/json'
      });
      return { hasExp, decoded, status };
    });

    await test.step('Verify a session expiration mechanism exists', async () => {
    const noTimeoutMechanism = !hasExp && status === 200;

    if (noTimeoutMechanism) {
        reporter.reportVulnerability(
          'API2_AUTH',
          {
            endpoint: 'GET /dashboard',
            issue: 'Token has no exp claim and there is no server-side session store, so no mechanism exists to ever time out a session',
            payload: decoded?.payload
          },
          [
            'Add an exp claim to issued tokens and enforce it server-side.',
            'Track session/token issuance server-side (even a lightweight last-active timestamp) so sessions can be timed out independent of the JWT claims.'
          ]
        );
      } else {
        reporter.reportPass(
          'Session has an expiration mechanism (exp claim present or endpoint rejected the token).',
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });
});
