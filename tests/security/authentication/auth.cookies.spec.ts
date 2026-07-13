import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';
import { parseCookieAttributes } from '../sec-objects/authentication/cookies.logic';

/**
 * Authentication - Cookie-based authentication
 *
 * app.py's POST /login sets a `token` cookie via
 * `response.set_cookie('token', token, httponly=True)`, and auth.py's
 * token_required checks `request.cookies['token']` as one of four accepted
 * token locations (header, query string, form body, cookie — the comment
 * there literally says "Vulnerability: Multiple token locations"). This
 * confirms both halves: that a cookie is actually issued, and that it
 * alone (no Authorization header at all) authenticates a protected
 * endpoint. See inspect-cookies.spec.ts for the cookie's security
 * attributes.
 */
test.describe('Authentication - Cookie-based auth', () => {
  test('POST /login should issue a session cookie usable on its own for authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const user = createRandomUser('auth-cookie', false);
    await api.post('/register', {
      data: { username: user.username, password: user.password },
      headers: { 'Content-Type': 'application/json' }
    });

    const login = await api.post('/login', {
      data: { username: user.username, password: user.password },
      headers: { 'Content-Type': 'application/json' }
    });
    const setCookieHeader = login.headers()['set-cookie'];
    const cookie = parseCookieAttributes(setCookieHeader, 'token');

    if (!cookie) {
      reporter.reportSkip('Login did not set a token cookie on this target.');
      await api.dispose();
      test.skip(true, 'No login cookie issued');
      return;
    }

    // A fresh, cookie-less context, authenticating purely by manually
    // attaching the cookie header — proving the cookie alone is sufficient.
    const cookieOnlyApi = await request.newContext({
      baseURL: baseURL.toString(),
      extraHTTPHeaders: { Cookie: `token=${cookie.value}` }
    });
    const dashRes = await cookieOnlyApi.get('/dashboard');
    const status = dashRes.status();
    await cookieOnlyApi.dispose();
    await api.dispose();

    testInfo.attach('auth-cookie-probe', {
      body: JSON.stringify({ cookieIssued: true, cookie, dashboardStatusViaCookieOnly: status }, null, 2),
      contentType: 'application/json'
    });

    const cookieAuthenticates = status === 200;

    if (cookieAuthenticates) {
      reporter.reportVulnerability(
        'API2_AUTH',
        {
          endpoint: 'GET /dashboard',
          issue: 'The token cookie alone (no Authorization header) authenticates a protected endpoint',
          cookie
        },
        [
          'Pick one token transport mechanism (Authorization header is the standard for bearer tokens) rather than accepting header, cookie, query string, and form body interchangeably.',
          'If a cookie-based session is intentional, add CSRF protection — cookies are sent automatically by the browser on cross-site requests, unlike an Authorization header.'
        ]
      );
    } else {
      reporter.reportPass(
        'Cookie alone did not authenticate a protected endpoint.',
        'API2:2023 - Broken Authentication'
      );
    }
  });
});
