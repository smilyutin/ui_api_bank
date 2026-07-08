import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { validateSchema } from '../../helpers/schema-validator';
import {
  establishAccountSession,
  type AccountSession
} from '../../fixtures/api/transactions.helpers';

/**
 * API Transaction & Balance Access Tests
 *
 * These tests exercise the account balance and transaction-history surfaces and
 * verify how they enforce object-level authorization:
 *   - GET /check_balance/<account_number>       (expected: authorization required)
 *   - GET /transactions/<account_number>        (expected: authorization required)
 *   - GET /api/transactions?account_number=...  (expected: token required)
 *
 * Test Strategy:
 * 1. Register and log in a fresh user to obtain a real account number + token.
 * 2. Probe each endpoint anonymously and with the account owner's token.
 * 3. Assert the authenticated owner can read their own data.
 * 4. Flag any endpoint that returns account data to an anonymous caller as a
 *    Broken Object Level Authorization (BOLA) finding.
 */

const READ_SUCCESS_STATUSES = [200, 201];
const AUTH_DENIED_STATUSES = [401, 403];

test.describe('API - Transaction & balance access', () => {
  let session: AccountSession | null = null;

  test.beforeAll(async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const api = await request.newContext({ baseURL: baseURL.toString() });
    session = await establishAccountSession(api);
    await api.dispose();
  });

  test('GET /check_balance should require authorization for account balances', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      test.skip(true, 'No account session available');
      return;
    }

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const anonRes = await anon.get(`/check_balance/${session.accountNumber}`);
    const anonStatus = anonRes.status();
    const anonBody = await anonRes.json().catch(() => null);
    await anon.dispose();

    const readableAnonymously = READ_SUCCESS_STATUSES.includes(anonStatus) && anonBody?.status === 'success';
    if (readableAnonymously) {
      await validateSchema('transactions-schema', 'GET_check_balance', anonBody);
    }

    testInfo.attach('check_balance-anonymous', {
      body: JSON.stringify({ status: anonStatus, body: anonBody }, null, 2),
      contentType: 'application/json'
    });

    if (readableAnonymously) {
      reporter.reportVulnerability(
        'API1_BOLA',
        {
          endpoint: `/check_balance/${session.accountNumber}`,
          requestAuth: 'none',
          responseStatus: anonStatus,
          disclosedFields: Object.keys(anonBody || {})
        },
        [
          'Require a valid session/token on /check_balance and confirm the caller owns the requested account_number.',
          'Do not disclose username or balance for arbitrary account numbers to unauthenticated callers.'
        ]
      );
    } else {
      expect(AUTH_DENIED_STATUSES).toContain(anonStatus);
      reporter.reportPass(
        'Account balance endpoint rejected an unauthenticated request.',
        'API1:2023 - Broken Object Level Authorization'
      );
    }
  });

  test('GET /transactions should require authorization for account history', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      test.skip(true, 'No account session available');
      return;
    }

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const anonRes = await anon.get(`/transactions/${session.accountNumber}`);
    const anonStatus = anonRes.status();
    const anonBody = await anonRes.json().catch(() => null);
    await anon.dispose();

    const readableAnonymously = READ_SUCCESS_STATUSES.includes(anonStatus) && anonBody?.status === 'success';
    if (readableAnonymously) {
      await validateSchema('transactions-schema', 'GET_transactions', anonBody);
    }

    testInfo.attach('transactions-anonymous', {
      body: JSON.stringify({ status: anonStatus, body: anonBody }, null, 2),
      contentType: 'application/json'
    });

    if (readableAnonymously) {
      reporter.reportVulnerability(
        'API1_BOLA',
        {
          endpoint: `/transactions/${session.accountNumber}`,
          requestAuth: 'none',
          responseStatus: anonStatus,
          transactionCount: Array.isArray(anonBody?.transactions) ? anonBody.transactions.length : 'unknown'
        },
        [
          'Require authentication on /transactions and verify the caller owns the requested account_number.',
          'Avoid returning server_time or raw account activity to unauthenticated callers.'
        ]
      );
    } else {
      expect(AUTH_DENIED_STATUSES).toContain(anonStatus);
      reporter.reportPass(
        'Transaction history endpoint rejected an unauthenticated request.',
        'API1:2023 - Broken Object Level Authorization'
      );
    }
  });

  test('GET /api/transactions should require a token and return the owner history', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      test.skip(true, 'No account session available');
      return;
    }

    // Anonymous request must be rejected.
    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const anonRes = await anon.get(`/api/transactions?account_number=${session.accountNumber}`);
    const anonStatus = anonRes.status();
    await anon.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(anonStatus);

    // Authenticated owner request must succeed and be scoped to their account.
    const authed = await request.newContext({
      baseURL: baseURL.toString(),
      extraHTTPHeaders: { Authorization: `Bearer ${session.token}` }
    });
    const authedRes = await authed.get(`/api/transactions?account_number=${session.accountNumber}`);
    const authedStatus = authedRes.status();
    const authedBody = await authedRes.json().catch(() => null);
    await authed.dispose();

    testInfo.attach('api-transactions', {
      body: JSON.stringify({ anonStatus, authedStatus, body: authedBody }, null, 2),
      contentType: 'application/json'
    });

    expect(READ_SUCCESS_STATUSES).toContain(authedStatus);
    expect(authedBody?.account_number).toBe(session.accountNumber);
    expect(Array.isArray(authedBody?.transactions)).toBe(true);
    await validateSchema('transactions-schema', 'GET_api_transactions', authedBody);

    reporter.reportPass(
      'Protected transaction API rejected anonymous access and returned owner-scoped history for a valid token.',
      'API1:2023 - Broken Object Level Authorization'
    );
  });
});
