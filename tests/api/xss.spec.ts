import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { establishXssUsernameSession } from '../../fixtures/api/xss.helpers';

/**
 * API - Stored XSS probe
 *
 * templates/dashboard.html renders `{{ username | safe }}` — the `safe`
 * filter disables Jinja's default auto-escaping, so anything stored as a
 * user's username is emitted into the page verbatim. `/register` applies no
 * validation to `username` (app.py inserts it directly into the users
 * table), so this is reachable end-to-end through the public API.
 *
 * This spec proves the server-side half: unescaped reflection in the raw
 * dashboard HTML. The companion DOM-execution proof — a payload in a
 * transfer `description` executing via the unsanitized
 * `transaction-list.innerHTML = ...` in static/dashboard.js — needs a real
 * browser and lives in tests/ui/specs/xss.spec.ts instead.
 */
test.describe('API - Stored XSS via username', () => {
  test('GET /dashboard should not reflect an unescaped <script> payload from a malicious username', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });

    const session = await test.step('Register/login a user whose username is an XSS payload', async () => {
      const s = await establishXssUsernameSession(api);
      if (!s) {
        reporter.reportSkip('Could not register/login a user whose username is an XSS payload on this target.');
        await api.dispose();
        test.skip(true, 'XSS username session unavailable');
      }
      return s;
    });
    if (!session) return;

    const { status, html } = await test.step('Fetch the dashboard as that user', async () => {
      const res = await api.get('/dashboard', {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const status = res.status();
      const html = await res.text();
      await api.dispose();
      return { status, html };
    });

    const reflectedUnescaped = html.includes(session.username);

    testInfo.attach('xss-username-probe', {
      body: JSON.stringify({ status, payload: session.username, reflectedUnescaped }, null, 2),
      contentType: 'application/json'
    });

    await test.step('Verify the request succeeded', async () => {
      expect(status, `Expected 200 from GET /dashboard, got ${status}`).toBe(200);
    });

    await test.step('Verify the username payload was not reflected unescaped', async () => {
      if (reflectedUnescaped) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          {
            endpoint: 'GET /dashboard',
            vector: 'username',
            payload: session.username,
            issue: 'The registered username is rendered into dashboard.html via {{ username | safe }}, which disables Jinja\'s auto-escaping, so a malicious username executes as HTML/JS for every viewer of the dashboard.'
          },
          [
            'Remove the `|safe` filter from `{{ username }}` in templates/dashboard.html — Jinja\'s default auto-escaping is the correct behavior here.',
            'Validate/restrict the allowed character set for usernames at registration time.',
            'Add a Content-Security-Policy header to reduce the blast radius of any HTML that does get injected.'
          ]
        );
      } else {
        reporter.reportPass(
          'A malicious <script> payload used as a username was not reflected unescaped in the dashboard HTML.',
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });
});
