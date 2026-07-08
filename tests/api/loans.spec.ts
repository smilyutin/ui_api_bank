import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { establishAccountSession } from '../../fixtures/api/transactions.helpers';
import { forgeToken } from '../../fixtures/api/jwt-forge.helpers';
import {
  requestLoan,
  approveLoan,
  fetchDashboardHtml,
  extractLoanRowsFromDashboardHtml,
  fetchAdminPanelHtml,
  extractPendingLoansFromAdminHtml,
  findPendingLoanId,
  loginAsSeededAdmin
} from '../../fixtures/api/loans.helpers';

/**
 * API Loan Tests
 *
 * These tests exercise the loan surfaces:
 *   - POST /request_loan                (any authenticated user)
 *   - POST /admin/approve_loan/<loan_id> (admin only)
 *
 * Test Strategy:
 * 1. Functional: an authenticated user can request a loan and see it appear
 *    as "pending" on their dashboard; admin-only approval is rejected for a
 *    genuine non-admin token.
 * 2. Security: probe loan amount validation, and probe whether the app's
 *    hardcoded/weak JWT secret (auth.py: JWT_SECRET = "secret123") lets a
 *    normal user forge an admin claim and approve their own loan — a
 *    Broken Function Level Authorization finding with a real financial
 *    impact (fabricated balance).
 *
 * Each test establishes its own account session (rather than sharing one from
 * beforeAll) because these tests assert on exact balance deltas, and
 * Playwright runs this suite with fullyParallel enabled.
 */

const AUTH_DENIED_STATUSES = [401, 403];

test.describe('API - Loan requests', () => {
  test('POST /request_loan should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const res = await requestLoan(anon, '', 500);
    const status = res.status();
    await anon.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(status);
    reporter.reportPass(
      'Loan request endpoint rejected a request without a valid token.',
      'API2:2023 - Broken Authentication'
    );
  });

  test('POST /request_loan should let an authenticated user submit a loan that appears as pending', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'loan-basic');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const amount = 750;
    const res = await requestLoan(api, session.token, amount);
    const status = res.status();
    const body = await res.json().catch(() => null);

    expect(status).toBe(200);
    expect(body?.status).toBe('success');

    const dashboardHtml = await fetchDashboardHtml(api, session.token);
    const loans = extractLoanRowsFromDashboardHtml(dashboardHtml);
    await api.dispose();

    testInfo.attach('loan-rows', { body: JSON.stringify(loans, null, 2), contentType: 'application/json' });

    expect(loans.some((loan) => loan.amount === amount && loan.status === 'pending')).toBe(true);

    reporter.reportPass(
      'Authenticated user requested a loan and it was persisted with pending status.',
      'API6:2023 - Unrestricted Access to Sensitive Business Flows'
    );
  });

  test('POST /request_loan should not accept a negative loan amount without validation', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'loan-negative');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const amount = -500;
    const res = await requestLoan(api, session.token, amount);
    const status = res.status();
    const body = await res.json().catch(() => null);
    await api.dispose();

    testInfo.attach('negative-loan-request', { body: JSON.stringify({ status, body }, null, 2), contentType: 'application/json' });

    const accepted = status === 200 && body?.status === 'success';

    if (accepted) {
      reporter.reportVulnerability(
        'API6_MASS_ASSIGNMENT',
        {
          endpoint: '/request_loan',
          amountSubmitted: amount,
          responseStatus: status
        },
        [
          'Reject non-positive loan amounts server-side (amount <= 0) before persisting a loan application.',
          'Apply a sane maximum loan amount to prevent unbounded liabilities from a single request.'
        ]
      );
    } else {
      expect(status).toBeGreaterThanOrEqual(400);
      reporter.reportPass(
        'Loan request endpoint rejected a negative loan amount.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    }
  });
});

test.describe('API - Loan approval authorization', () => {
  test('POST /admin/approve_loan/<id> should reject a non-admin authenticated user', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'loan-bfla-check');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    // The is_admin check in /admin/approve_loan happens before any loan
    // lookup, so a real (non-forged) loan id is not required to prove
    // authorization is enforced for a genuine non-admin token.
    const res = await approveLoan(api, session.token, 999999999);
    const status = res.status();
    await api.dispose();

    expect(AUTH_DENIED_STATUSES).toContain(status);
    reporter.reportPass(
      'Loan approval endpoint rejected a genuine non-admin token.',
      'API5:2023 - Broken Function Level Authorization'
    );
  });

  test('POST /admin/approve_loan/<id> should not be reachable via a forged admin claim (weak JWT secret)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'loan-escalate');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const amount = 500;
    await requestLoan(api, session.token, amount);

    const balanceBeforeRes = await api.get(`/check_balance/${session.accountNumber}`);
    const balanceBefore = (await balanceBeforeRes.json().catch(() => null))?.balance;

    // Forge a token for this same user claiming is_admin=true, signed with the
    // app's hardcoded HS256 secret (auth.py: JWT_SECRET = "secret123"). No
    // admin credentials are ever used or required.
    const forgedAdminToken = forgeToken({ userId: session.userId, username: session.user.username || '', isAdmin: true });

    const adminHtml = await fetchAdminPanelHtml(api, forgedAdminToken);
    const adminPanelReachable = adminHtml.status() === 200;

    const pending = extractPendingLoansFromAdminHtml(await adminHtml.text());
    const loanId = findPendingLoanId(pending, session.userId, amount);

    let approvalSucceeded = false;
    let balanceAfter: number | undefined;

    if (loanId !== null) {
      const approveRes = await approveLoan(api, forgedAdminToken, loanId);
      const approveBody = await approveRes.json().catch(() => null);
      approvalSucceeded = approveRes.status() === 200 && approveBody?.status === 'success';

      const balanceAfterRes = await api.get(`/check_balance/${session.accountNumber}`);
      balanceAfter = (await balanceAfterRes.json().catch(() => null))?.balance;
    }

    await api.dispose();

    testInfo.attach('privilege-escalation-probe', {
      body: JSON.stringify({ adminPanelReachable, loanId, approvalSucceeded, balanceBefore, balanceAfter }, null, 2),
      contentType: 'application/json'
    });

    const escalationConfirmed = adminPanelReachable && approvalSucceeded && balanceAfter === balanceBefore + amount;

    if (escalationConfirmed) {
      reporter.reportVulnerability(
        'API5_BFLA',
        {
          endpoint: '/admin/approve_loan/<loan_id>',
          technique: 'Forged JWT with is_admin=true, signed using the hardcoded weak secret from auth.py',
          loanId,
          balanceBefore,
          balanceAfter,
          fundsFabricated: amount
        },
        [
          'Replace the hardcoded JWT secret with a strong, environment-provided secret that is never committed to source control.',
          'Do not trust an `is_admin` claim from the token payload alone — verify the user\'s role against the database on every privileged request.',
          'Reject tokens signed with unexpected algorithms and enforce a single expected algorithm (no "none", no algorithm confusion).'
        ]
      );
    } else {
      reporter.reportPass(
        'Forging an admin claim with the application\'s JWT secret did not result in a successful, financially-impactful loan approval.',
        'API5:2023 - Broken Function Level Authorization'
      );
    }
  });

  test('POST /admin/approve_loan/<id> should not allow the same loan to be approved twice', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'loan-double-approve');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const amount = 300;
    await requestLoan(api, session.token, amount);

    const admin = await loginAsSeededAdmin(api);
    if (!admin) {
      reporter.reportSkip('Could not log in as the seeded admin account to run the double-approval check.');
      await api.dispose();
      test.skip(true, 'No admin session available');
      return;
    }

    const adminHtml = await fetchAdminPanelHtml(api, admin.token);
    const pending = extractPendingLoansFromAdminHtml(await adminHtml.text());
    const loanId = findPendingLoanId(pending, session.userId, amount);

    if (loanId === null) {
      reporter.reportSkip('Could not locate the created loan id to run the double-approval check.');
      await api.dispose();
      test.skip(true, 'Loan id not found');
      return;
    }

    const firstApproval = await approveLoan(api, admin.token, loanId);
    const firstBody = await firstApproval.json().catch(() => null);
    const balanceAfterFirstRes = await api.get(`/check_balance/${session.accountNumber}`);
    const balanceAfterFirst = (await balanceAfterFirstRes.json().catch(() => null))?.balance;

    const secondApproval = await approveLoan(api, admin.token, loanId);
    const secondBody = await secondApproval.json().catch(() => null);
    const balanceAfterSecondRes = await api.get(`/check_balance/${session.accountNumber}`);
    const balanceAfterSecond = (await balanceAfterSecondRes.json().catch(() => null))?.balance;

    await api.dispose();

    testInfo.attach('double-approval-probe', {
      body: JSON.stringify({ firstBody, secondBody, balanceAfterFirst, balanceAfterSecond }, null, 2),
      contentType: 'application/json'
    });

    const doubleCredited = secondBody?.status === 'success' && balanceAfterSecond === balanceAfterFirst + amount;

    if (doubleCredited) {
      reporter.reportVulnerability(
        'API6_MASS_ASSIGNMENT',
        {
          endpoint: '/admin/approve_loan/<loan_id>',
          loanId,
          balanceAfterFirstApproval: balanceAfterFirst,
          balanceAfterSecondApproval: balanceAfterSecond,
          extraFundsCredited: amount
        },
        [
          'Guard loan approval with a status check (only transition pending -> approved) inside the same transaction that credits the balance.',
          'Make the balance credit and status update atomic to close the race condition already flagged in app.py.'
        ]
      );
    } else {
      reporter.reportPass(
        'Re-approving an already-approved loan did not credit the balance a second time.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    }
  });
});
