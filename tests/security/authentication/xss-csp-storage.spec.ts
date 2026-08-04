import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { fetchHeaderAcrossEndpoints, buildRepresentativeEndpoints } from '../sec-objects/headers/security-headers.logic';

/**
 * Authentication - CSP and token storage hardening
 *
 * Two independent, compounding findings:
 *
 * 1. No Content-Security-Policy header anywhere (confirmed by grepping
 *    app.py for every security-header name — none are set). A CSP is the
 *    standard mitigation that limits what an XSS payload can actually do
 *    even once it executes (see tests/api/xss.spec.ts and
 *    tests/ui/specs/xss.spec.ts for two confirmed-live XSS vectors).
 *
 * 2. POST /login sets the token as an HttpOnly cookie (safe from
 *    JavaScript) *and* static/dashboard.js separately stores the same
 *    token in localStorage (`localStorage.getItem('jwt_token')` is read
 *    throughout dashboard.js to build the Authorization header for every
 *    API call). The HttpOnly cookie can't be read by an XSS payload, but
 *    the localStorage copy can — so the HttpOnly protection is
 *    circumvented by the app's own client-side code duplicating the same
 *    credential into a JS-readable location.
 */
test.describe('Authentication - CSP and storage hardening', () => {
  test('every representative endpoint should send a Content-Security-Policy header', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const results = await test.step('Fetch the Content-Security-Policy header across representative endpoints', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const session = await establishAccountSession(api, 'headers-csp');
      const endpoints = buildRepresentativeEndpoints(session?.token);
      const { results } = await fetchHeaderAcrossEndpoints(api, endpoints, 'content-security-policy');
      await api.dispose();

      testInfo.attach('csp-header-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      return results;
    });

    await test.step('Verify it is set on every endpoint', async () => {
      const missing = results.filter((r) => !r.headerValue);

      if (missing.length > 0) {
        reporter.reportVulnerability(
          'API7_MISCONFIGURATION',
          { missingEndpoints: missing.map((r) => `${r.path} (${r.label})`), allResults: results },
          [
            'Add a Content-Security-Policy header (e.g. via Flask-Talisman or an after_request hook) restricting script-src to trusted origins.',
            'A CSP limits the impact of any XSS that does execute (see tests/api/xss.spec.ts / tests/ui/specs/xss.spec.ts for confirmed live vectors) even if the underlying injection isn\'t fixed immediately.'
          ]
        );
      } else {
        reporter.reportPass(`Content-Security-Policy header present on all ${results.length} checked endpoints.`, 'API7:2023 - Server Side Request Forgery');
      }
    });
  });

  test('the auth token should not be duplicated into a JS-readable storage location', async ({ page, baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const { storageToken, httpOnlyCookie } = await test.step('Authenticate and inspect token storage locations', async () => {
      await ensureDashboardAuthenticated(page, {
        baseURL: baseURL.toString(),
        role: 'user',
        fallbackUserPrefix: 'xss-storage',
      });

      const storageToken = await page.evaluate(() => {
        const keys = ['jwt_token', 'token', 'jwt', 'access_token'];
        for (const key of keys) {
          const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
          if (value) return { key, storage: window.localStorage.getItem(key) ? 'localStorage' : 'sessionStorage' };
        }
        return null;
      });

      const cookies = await page.context().cookies();
      const httpOnlyCookie = cookies.find((c) => c.name === 'token' && c.httpOnly);

      testInfo.attach('token-storage-probe', {
        body: JSON.stringify({ storageToken, hasHttpOnlyCookie: !!httpOnlyCookie }, null, 2),
        contentType: 'application/json'
      });
      return { storageToken, httpOnlyCookie };
    });

    await test.step('Verify the token is not duplicated into a JS-readable location', async () => {
      if (storageToken) {
        reporter.reportVulnerability(
          'API2_AUTH',
          {
            issue: 'Auth token is readable from JavaScript via ' + storageToken.storage,
            storageKey: storageToken.key,
            hasHttpOnlyCookieAlso: !!httpOnlyCookie
          },
          [
            'Stop writing the token to localStorage/sessionStorage in static/dashboard.js — rely solely on the HttpOnly cookie the server already sets.',
            'If client-side JS needs to know auth state, use a non-sensitive flag (e.g. a boolean) instead of the raw token.'
          ]
        );
      } else {
        reporter.reportPass('Auth token is not present in localStorage or sessionStorage.', 'API2:2023 - Broken Authentication');
      }
    });
  });
});
