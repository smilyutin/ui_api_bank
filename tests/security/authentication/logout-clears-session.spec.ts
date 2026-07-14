import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';

/**
 * Authentication - Logout clears session
 *
 * app.py has no `/logout` route at all (confirmed by inspection — the app
 * is stateless JWT-only, and pages/dashboard.page.ts's logout() is purely
 * a client-side UI action: clearing localStorage/cookies in the browser).
 * There is nothing server-side that could invalidate a token. This test
 * proves the consequence directly: the exact token from before "logout"
 * still authenticates a protected endpoint after it.
 */
test.describe('Authentication - Logout clears session', () => {
  test('a token should not still authenticate a protected endpoint after logout', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'logout-session');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const preLogout = await api.get('/dashboard', { headers: { Authorization: `Bearer ${session.token}` } });

    // Probe for a server-side logout endpoint under common names; app.py
    // has none, so all of these are expected to 404.
    const logoutCandidates = ['/logout', '/api/logout', '/api/auth/logout'];
    const logoutAttempts: { path: string; status: number }[] = [];
    for (const path of logoutCandidates) {
      const res = await api.post(path, { headers: { Authorization: `Bearer ${session.token}` } }).catch(() => null);
      if (res) logoutAttempts.push({ path, status: res.status() });
    }

    const postLogout = await api.get('/dashboard', { headers: { Authorization: `Bearer ${session.token}` } });
    const postLogoutStatus = postLogout.status();
    await api.dispose();

    testInfo.attach('logout-session-probe', {
      body: JSON.stringify(
        { preLogoutStatus: preLogout.status(), logoutAttempts, postLogoutStatus },
        null,
        2
      ),
      contentType: 'application/json'
    });

    const noServerSideLogout = logoutAttempts.every((a) => a.status === 404);
    const tokenStillValid = postLogoutStatus === 200;

    if (noServerSideLogout && tokenStillValid) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: 'GET /dashboard',
          issue: 'No server-side logout endpoint exists, and the token used before logout still authenticates afterward',
          logoutAttempts,
          postLogoutStatus
        },
        [
          'Add a server-side logout mechanism: a token denylist/blocklist keyed by jti, or move to short-lived tokens plus revocable refresh tokens.',
          'If staying fully stateless, at minimum shorten token lifetime significantly so a stolen/leaked token has a small exploitation window after logout.'
        ]
      );
    } else {
      reporter.reportPass(
        'Token no longer authenticates after logout, or a server-side logout endpoint exists.',
        'API2:2023 - Broken Authentication'
      );
    }
  });
});
