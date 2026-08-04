import { test, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { fetchHeaderAcrossEndpoints, buildRepresentativeEndpoints } from '../sec-objects/headers/security-headers.logic';

/**
 * Headers - Referrer-Policy
 *
 * No security response headers are set anywhere in app.py, including
 * Referrer-Policy. Without it, browsers fall back to their own default
 * (modern browsers default to strict-origin-when-cross-origin, but that's
 * an implicit browser behavior, not something this app controls or can
 * rely on across all clients) — outbound links can leak the full
 * referring URL, which matters here because some URLs in this app carry
 * sensitive query parameters (e.g. money-transfer.spec.ts already confirms
 * /transfer accepted a token via ?token=). Checked across a public HTML
 * page, a public JSON API, and the authenticated dashboard, not just
 * /login.
 */
test.describe('Headers - Referrer-Policy', () => {
  test('every representative endpoint should set an explicit Referrer-Policy', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const results = await test.step('Fetch the Referrer-Policy header across representative endpoints', async () => {
      const api = await request.newContext({ baseURL: baseURL.toString() });
      const session = await establishAccountSession(api, 'headers-referrer-policy');
      const endpoints = buildRepresentativeEndpoints(session?.token);
      const { results } = await fetchHeaderAcrossEndpoints(api, endpoints, 'referrer-policy');
      await api.dispose();

      testInfo.attach('referrer-policy-probe', { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
      return results;
    });

    await test.step('Verify it is set on every endpoint', async () => {
      const missing = results.filter((r) => !r.headerValue);

      if (missing.length > 0) {
        reporter.reportVulnerability(
          'API7_MISCONFIGURATION',
          { missingEndpoints: missing.map((r) => `${r.path} (${r.label})`), allResults: results },
          ['Set Referrer-Policy: strict-origin-when-cross-origin (or stricter, e.g. same-origin) explicitly rather than relying on browser defaults.']
        );
      } else {
        reporter.reportPass(`Referrer-Policy present on all ${results.length} checked endpoints.`, 'API7:2023 - Server Side Request Forgery');
      }
    });
  });
});
