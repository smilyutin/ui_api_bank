import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { createRandomUser } from '../utils/test-users';
import { parseCookieAttributes } from '../sec-objects/authentication/cookies.logic';

/**
 * Authentication - Cookie security attributes
 *
 * app.py's POST /login: `response.set_cookie('token', token, httponly=True)`
 * — the comment directly above it says "Vulnerability: Cookie without
 * secure flag". HttpOnly is set (so document.cookie can't read it), but
 * there's no `secure=True` and no explicit `samesite` argument. This
 * inspects the real Set-Cookie header rather than trusting the comment.
 */
test.describe('Authentication - Cookie attributes', () => {
  test('the token cookie should be Secure and HttpOnly with an explicit SameSite policy', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const cookie = await test.step('Register, log in, and capture the token cookie', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const user = createRandomUser('inspect-cookie', false);
      await api.post('/register', {
        data: { username: user.username, password: user.password },
        headers: { 'Content-Type': 'application/json' }
      });
      const login = await api.post('/login', {
        data: { username: user.username, password: user.password },
        headers: { 'Content-Type': 'application/json' }
      });
      const cookie = parseCookieAttributes(login.headers()['set-cookie'], 'token');
      await api.dispose();
      return cookie;
    });

    if (!cookie) {
      reporter.reportSkip('Login did not set a token cookie on this target.');
      test.skip(true, 'No login cookie issued');
      return;
    }

    await test.step('Verify HttpOnly, Secure, and SameSite are set', async () => {
      testInfo.attach('cookie-attributes-probe', { body: JSON.stringify(cookie, null, 2), contentType: 'application/json' });

      const issues: string[] = [];
      if (!cookie.httpOnly) issues.push('missing HttpOnly');
      if (!cookie.secure) issues.push('missing Secure');
      if (!cookie.sameSite) issues.push('missing SameSite');

      if (issues.length > 0) {
        reporter.reportVulnerability(
          'API2_AUTH',
          { endpoint: 'POST /login', cookie, issues },
          [
            'Set secure=True on the token cookie (response.set_cookie in app.py) — required for any HTTPS deployment, and best practice regardless.',
            'Set an explicit samesite policy (e.g. samesite="Lax" or "Strict") instead of leaving it to browser defaults.',
            issues.includes('missing HttpOnly')
              ? 'Set httponly=True — without it, any XSS can read the cookie directly via document.cookie.'
              : 'HttpOnly is already set correctly on this cookie.'
          ]
        );
      } else {
        reporter.reportPass('Token cookie has HttpOnly, Secure, and an explicit SameSite attribute.', 'API2:2023 - Broken Authentication');
      }
    });
  });
});
