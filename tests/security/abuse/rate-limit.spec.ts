import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../utils/security-reporter';
import { probeBurstRequests } from '../sec-objects/abuse/rate-limit.logic';

/**
 * Abuse - Rate limiting outside AI chat
 *
 * app.py's `check_rate_limit`/`ai_rate_limit` machinery is wired to exactly
 * three routes (all under /api/ai/*, confirmed by grepping every
 * `@ai_rate_limit` usage in app.py) and nowhere else. This probes two
 * unauthenticated targets that have no rate limiting at all:
 * POST /login (bruteforce-able) and GET /api/bill-categories (public read,
 * confirmed reachable without a token in bill-payments.spec.ts).
 *
 * A target with real rate limiting should return at least one 429
 * somewhere in a concurrent burst; none appearing means nothing throttles
 * the endpoint.
 */
const BURST_SIZE = 20;

test.describe('Abuse - Rate limiting outside AI chat', () => {
  test('POST /login should rate-limit a burst of failed attempts', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const probe = await probeBurstRequests(
      () =>
        api.post('/login', {
          data: { username: 'rate-limit-probe-user', password: 'wrong-password' },
          headers: { 'Content-Type': 'application/json' }
        }),
      BURST_SIZE
    );
    await api.dispose();

    testInfo.attach('login-burst-probe', { body: JSON.stringify(probe, null, 2), contentType: 'application/json' });

    if (probe.any429) {
      reporter.reportPass(
        `POST /login returned a 429 within a ${BURST_SIZE}-request burst.`,
        'API4:2023 - Unrestricted Resource Consumption'
      );
    } else {
      reporter.reportVulnerability(
        'API4_RATE_LIMIT',
        { endpoint: 'POST /login', ...probe },
        [
          'Apply the existing check_rate_limit/ai_rate_limit machinery (or an equivalent) to /login by IP and/or username.',
          'Return 429 with a Retry-After header once a caller exceeds the threshold.',
          'Add account lockout or exponential backoff after repeated failed attempts for a given username.'
        ]
      );
    }
  });

  test('GET /api/bill-categories should rate-limit a burst of public reads', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const probe = await probeBurstRequests(() => api.get('/api/bill-categories'), BURST_SIZE);
    await api.dispose();

    testInfo.attach('bill-categories-burst-probe', {
      body: JSON.stringify(probe, null, 2),
      contentType: 'application/json'
    });

    if (probe.any429) {
      reporter.reportPass(
        `GET /api/bill-categories returned a 429 within a ${BURST_SIZE}-request burst.`,
        'API4:2023 - Unrestricted Resource Consumption'
      );
    } else {
      reporter.reportVulnerability(
        'API4_RATE_LIMIT',
        { endpoint: 'GET /api/bill-categories', ...probe },
        [
          'Apply rate limiting to public read endpoints by IP, not just AI chat routes.',
          'Use an API gateway or reverse-proxy layer for centralized rate limiting across all routes.'
        ]
      );
    }
  });
});
