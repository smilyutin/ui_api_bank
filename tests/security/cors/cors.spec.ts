import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';

/**
 * CORS
 *
 * app.py:46 calls `CORS(app)` with Flask-CORS defaults on every route —
 * confirmed live: a request with an arbitrary Origin header gets that exact
 * origin reflected back in Access-Control-Allow-Origin (not a fixed
 * allowlist, not a static '*'), on both a public GET and an authenticated
 * POST's preflight OPTIONS response.
 *
 * `Access-Control-Allow-Credentials` is not set (confirmed — Flask-CORS
 * only adds it when `supports_credentials=True` is explicitly configured,
 * which app.py doesn't do), so a cross-origin `fetch(..., {credentials:
 * 'include'})` can't have its *response* read by the reflected origin.
 * That's a real, distinct mitigation from full CORS-based data theft — but
 * reflecting any origin at all is still a misconfiguration (bad practice,
 * one config change away from becoming exploitable, and the request itself
 * still reaches the server regardless — see crossSiteReqForgery/csrf.spec.ts
 * for the state-changing consequence of that).
 */
const FOREIGN_ORIGIN = 'https://evil.example.com';

test.describe('CORS', () => {
  test('Access-Control-Allow-Origin should not reflect an arbitrary Origin', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const res = await api.get('/api/bill-categories', { headers: { Origin: FOREIGN_ORIGIN } });
    const allowOrigin = res.headers()['access-control-allow-origin'];
    const allowCredentials = res.headers()['access-control-allow-credentials'];
    await api.dispose();

    testInfo.attach('cors-origin-probe', {
      body: JSON.stringify({ requestedOrigin: FOREIGN_ORIGIN, allowOrigin: allowOrigin ?? null, allowCredentials: allowCredentials ?? null }, null, 2),
      contentType: 'application/json'
    });

    const reflectsArbitraryOrigin = allowOrigin === FOREIGN_ORIGIN;

    if (reflectsArbitraryOrigin) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        { endpoint: 'GET /api/bill-categories', allowOrigin, allowCredentials: allowCredentials ?? null },
        [
          'Configure Flask-CORS with an explicit origins allowlist (CORS(app, origins=[...])) instead of the wide-open default.',
          'Never combine origin-reflection with supports_credentials=True — that combination allows any site to make authenticated requests and read the response.',
          'Scope CORS per-blueprint/route to only the endpoints that actually need cross-origin access, rather than applying it globally.'
        ]
      );
    } else {
      reporter.reportPass(`Access-Control-Allow-Origin did not reflect an arbitrary origin (got: ${allowOrigin ?? 'none'}).`, 'API8:2023 - Security Misconfiguration');
    }
  });

  test('a preflight request for a state-changing endpoint should not allow an arbitrary origin', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const res = await api.fetch('/transfer', {
      method: 'OPTIONS',
      headers: { Origin: FOREIGN_ORIGIN, 'Access-Control-Request-Method': 'POST' }
    });
    const allowOrigin = res.headers()['access-control-allow-origin'];
    const allowMethods = res.headers()['access-control-allow-methods'];
    await api.dispose();

    testInfo.attach('cors-preflight-probe', {
      body: JSON.stringify({ endpoint: 'OPTIONS /transfer', allowOrigin: allowOrigin ?? null, allowMethods: allowMethods ?? null }, null, 2),
      contentType: 'application/json'
    });

    const reflectsArbitraryOrigin = allowOrigin === FOREIGN_ORIGIN;

    if (reflectsArbitraryOrigin) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        { endpoint: 'OPTIONS /transfer', allowOrigin, allowMethods },
        ['Restrict CORS on state-changing endpoints (/transfer, /request_loan, etc.) to the app\'s own real origin(s) only.']
      );
    } else {
      reporter.reportPass('Preflight for /transfer did not allow an arbitrary origin.', 'API8:2023 - Security Misconfiguration');
    }
  });
});
