import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { probeLegacyApiLogin } from '../sec-objects/authentication/broken-authentication.logic';

/**
 * Authentication - Legacy /api/login route
 *
 * app.py imports and calls `init_auth_routes(app)` (line ~1960), which
 * registers a second, older login implementation from auth.py at
 * `/api/login` — separate from the real `/login` route the app actually
 * uses, and backed by `sqlite3.connect('bank.db')` instead of the Postgres
 * database the rest of the app runs on. That SQLite database has no
 * `users` table in this deployment, so every call raises an unhandled
 * `sqlite3.OperationalError`.
 *
 * The interesting finding isn't that route being broken — it's *how* it
 * fails: Flask is running with DEBUG=True, so the unhandled exception
 * renders the full interactive Werkzeug debugger (file paths, stack
 * frames, library versions, source line numbers) straight to the client.
 * This test only confirms that disclosure; it deliberately does not
 * attempt to unlock or use the debugger's code-execution console.
 */
test.describe('Authentication - Broken authentication (legacy /api/login)', () => {
  test('POST /api/login should not leak an interactive debugger traceback on failure', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const probe = await test.step('Probe the legacy /api/login route', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const probe = await probeLegacyApiLogin(api, { username: 'probe', password: 'probe' });
      await api.dispose();

      testInfo.attach('legacy-api-login-probe', { body: JSON.stringify(probe, null, 2), contentType: 'application/json' });
      return probe;
    });

    if (probe.status === 404) {
      reporter.reportPass('Legacy /api/login route is not registered on this target.', 'API9:2023 - Improper Inventory Management');
      return;
    }

    await test.step('Verify no debugger/traceback was leaked', async () => {
      if (probe.isWerkzeugDebugger || probe.leaksFilePaths) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          {
            endpoint: 'POST /api/login',
            status: probe.status,
            isWerkzeugDebugger: probe.isWerkzeugDebugger,
            leaksFilePaths: probe.leaksFilePaths,
            bodySnippet: probe.bodySnippet
          },
          [
            'Run the app with Flask DEBUG=False (or FLASK_ENV=production) in any shared/deployed environment.',
            'Remove the dead /api/login, /api/check_balance, and /api/transfer routes (auth.py init_auth_routes) — they target a SQLite database the app no longer uses.',
            'Add centralized error handling that returns a generic message and logs the real exception server-side only.'
          ]
        );
      } else {
        reporter.reportPass(
          `Legacy /api/login route did not leak a debugger/traceback (status ${probe.status}).`,
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });
});
