import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { fetchSecurityHeaders, buildRepresentativeEndpoints } from '../sec-objects/headers/security-headers.logic';

/**
 * Headers - Clickjacking (X-Frame-Options)
 *
 * app.py sets no security response headers anywhere (confirmed by grepping
 * every header name across the whole file). Without X-Frame-Options (or an
 * equivalent frame-ancestors CSP directive, also absent — see
 * tests/security/authentication/xss-csp-storage.spec.ts), the app can be
 * embedded in an attacker's <iframe> and clickjacked. Checked across a
 * public HTML page, a public JSON API, and — the highest-value target —
 * the authenticated dashboard, not just /login.
 */
test.describe('Headers - Clickjacking', () => {
  test('every representative endpoint should set X-Frame-Options or an equivalent frame-ancestors policy', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const results = await test.step('Fetch framing-related headers across representative endpoints', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const session = await establishAccountSession(api, 'headers-clickjacking');
      const endpoints = buildRepresentativeEndpoints(session?.token);

      const results = [];
      for (const ep of endpoints) {
        const probe = await fetchSecurityHeaders(api, ep.path, ep.headers);
        const xfo = probe.headers['x-frame-options'];
        const csp = probe.headers['content-security-policy'];
        const hasFrameAncestors = !!csp && /frame-ancestors/i.test(csp);
        results.push({ label: ep.label, path: ep.path, 'x-frame-options': xfo, hasFrameAncestors, protected: !!xfo || hasFrameAncestors });
      }
      await api.dispose();

      testInfo.attach('clickjacking-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      return results;
    });

    await test.step('Verify framing is restricted on every endpoint', async () => {
      const unprotected = results.filter((r) => !r.protected);

      if (unprotected.length > 0) {
        reporter.reportVulnerability(
          'API7_MISCONFIGURATION',
          { unprotectedEndpoints: unprotected.map((r) => `${r.path} (${r.label})`), allResults: results },
          [
            'Set X-Frame-Options: DENY (or SAMEORIGIN if framing by the app itself is needed) on every response.',
            'Alternatively/additionally set a CSP frame-ancestors directive, which supersedes X-Frame-Options in modern browsers.'
          ]
        );
      } else {
        reporter.reportPass(`Framing is restricted on all ${results.length} checked endpoints.`, 'API7:2023 - Server Side Request Forgery');
      }
    });
  });
});
