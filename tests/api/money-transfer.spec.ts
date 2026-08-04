import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { validateSchema } from '../../helpers/schema-validator';
import { establishAccountSession } from '../../fixtures/api/transactions.helpers';
import { forgeToken } from '../../fixtures/api/jwt-forge.helpers';
import { transfer } from '../../fixtures/api/money-transfer.helpers';

/**
 * API Money Transfer Tests
 *
 * These tests exercise the transfer surface:
 *   - POST /transfer (any authenticated user)
 *
 * Test Strategy:
 * 1. Functional: an authenticated user can transfer funds to another account,
 *    with both parties' balances and the persisted transaction record
 *    verified afterward.
 * 2. Security: probe amount-sign validation (a negative amount reverses the
 *    transfer direction rather than merely being accepted), recipient
 *    validation (a nonexistent to_account silently destroys the sender's
 *    funds), detailed error exposure on malformed input, insecure
 *    query-string token transmission, and forged-JWT impersonation.
 *
 * Each test establishes its own fresh account session(s) (rather than
 * sharing one from beforeAll) because these tests assert on exact balance
 * deltas, and Playwright runs this suite with fullyParallel enabled — same
 * rationale as tests/api/loans.spec.ts and tests/api/bill-payments.spec.ts.
 *
 * Not covered: the balance-check-then-deduct race condition (no row lock
 * between the SELECT and the two sequential UPDATEs in app.py's transfer()).
 * app.py runs a single-threaded Werkzeug dev server (no threaded=True), so a
 * Promise.all-based concurrency test would reliably false-negative "pass"
 * against this deployment — same reasoning already documented in
 * tests/api/bill-payments.spec.ts. Left as documented future work.
 */

const AUTH_DENIED_STATUSES = [401, 403];

test.describe('@api @feature:money-transfer API - Money transfer authentication', () => {
  test('POST /transfer should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const status = await test.step('Attempt a transfer without authentication', async () => {
      const anon = await request.newContext({ baseURL: baseURL.toString() });
      const res = await transfer(anon, '', { to_account: '9999999999', amount: 10 });
      const status = res.status();
      await anon.dispose();
      return status;
    });

    await test.step('Verify the request was rejected', async () => {
      expect(AUTH_DENIED_STATUSES).toContain(status);
      reporter.reportPass(
        'Money transfer endpoint rejected a request without a valid token.',
        'API2:2023 - Broken Authentication'
      );
    });
  });
});

test.describe('API - Money transfer happy path & transaction record', () => {
  test('should transfer funds between two accounts and record a matching transaction', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const sender = await establishAccountSession(api, 'transfer-sender');
    const recipient = await establishAccountSession(api, 'transfer-recipient');
    if (!sender || !recipient) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const amount = 25;

    const { balanceBeforeSender, balanceBeforeRecipient } = await test.step('Capture starting balances', async () => {
      const balanceBeforeSenderRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceBeforeSender = (await balanceBeforeSenderRes.json().catch(() => null))?.balance;
      const balanceBeforeRecipientRes = await api.get(`/check_balance/${recipient.accountNumber}`);
      const balanceBeforeRecipient = (await balanceBeforeRecipientRes.json().catch(() => null))?.balance;
      return { balanceBeforeSender, balanceBeforeRecipient };
    });

    await test.step('Transfer funds and verify the API response', async () => {
      const res = await transfer(api, sender.token, {
        to_account: recipient.accountNumber,
        amount,
        description: 'API test transfer'
      });
      const body = await res.json().catch(() => null);

      expect(res.status()).toBe(200);
      expect(body?.status).toBe('success');
      expect(body?.message).toBe('Transfer Completed');
      expect(body?.new_balance).toBe(balanceBeforeSender - amount);
      await validateSchema('money-transfer-schema', 'POST_transfer', body);
    });

    await test.step('Verify balances and the persisted transaction record', async () => {
      const balanceAfterSenderRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceAfterSender = (await balanceAfterSenderRes.json().catch(() => null))?.balance;
      const balanceAfterRecipientRes = await api.get(`/check_balance/${recipient.accountNumber}`);
      const balanceAfterRecipient = (await balanceAfterRecipientRes.json().catch(() => null))?.balance;

      expect(balanceAfterSender).toBe(balanceBeforeSender - amount);
      expect(balanceAfterRecipient).toBe(balanceBeforeRecipient + amount);

      const historyRes = await api.get(`/transactions/${sender.accountNumber}`);
      const historyBody = await historyRes.json().catch(() => null);
      const transactions = historyBody?.transactions || [];
      const matched = transactions.find(
        (t: { from_account: string; to_account: string; amount: number; type: string }) =>
          t.from_account === sender.accountNumber && t.to_account === recipient.accountNumber && t.amount === amount && t.type === 'transfer'
      );
      await api.dispose();

      expect(matched).toBeTruthy();

      reporter.reportPass(
        'Authenticated user transferred funds between two accounts; both balances and the persisted transaction record are correct.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    });
  });
});

test.describe('API - Money transfer amount validation abuse', () => {
  test('should not validate amount sign (negative amount reverses the transfer direction)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const sender = await establishAccountSession(api, 'transfer-negative-sender');
    const victim = await establishAccountSession(api, 'transfer-negative-victim');
    if (!sender || !victim) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const { status, body, balanceBeforeSender, balanceAfterSender, balanceBeforeVictim, balanceAfterVictim } = await test.step('Attempt a negative-amount transfer', async () => {
      const balanceBeforeSenderRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceBeforeSender = (await balanceBeforeSenderRes.json().catch(() => null))?.balance;
      const balanceBeforeVictimRes = await api.get(`/check_balance/${victim.accountNumber}`);
      const balanceBeforeVictim = (await balanceBeforeVictimRes.json().catch(() => null))?.balance;

      const res = await transfer(api, sender.token, { to_account: victim.accountNumber, amount: -100 });
      const status = res.status();
      const body = await res.json().catch(() => null);

      const balanceAfterSenderRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceAfterSender = (await balanceAfterSenderRes.json().catch(() => null))?.balance;
      const balanceAfterVictimRes = await api.get(`/check_balance/${victim.accountNumber}`);
      const balanceAfterVictim = (await balanceAfterVictimRes.json().catch(() => null))?.balance;
      await api.dispose();

      testInfo.attach('negative-amount-directional-probe', {
        body: JSON.stringify({ status, body, balanceBeforeSender, balanceAfterSender, balanceBeforeVictim, balanceAfterVictim }, null, 2),
        contentType: 'application/json'
      });
      return { status, body, balanceBeforeSender, balanceAfterSender, balanceBeforeVictim, balanceAfterVictim };
    });

    await test.step('Verify the transfer direction was not reversed', async () => {
      const inflationConfirmed =
        status === 200 &&
        body?.status === 'success' &&
        balanceAfterSender === balanceBeforeSender + 100 &&
        balanceAfterVictim === balanceBeforeVictim - 100;

      if (inflationConfirmed) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          {
            endpoint: '/transfer',
            technique: "Negative amount (-100) increases the sender's balance while decreasing the victim's — a reversed transfer, not merely an accepted negative value",
            senderDelta: +100,
            victimDelta: -100
          },
          [
            'Validate amount > 0 before processing any transfer.',
            'The sufficiency check (balance >= abs(amount)) must use the same signed value that is later applied in the debit/credit UPDATEs.'
          ]
        );
      } else {
        expect(balanceAfterSender).not.toBe(balanceBeforeSender + 100);
        reporter.reportPass(
          "Negative-amount transfer did not reverse the balance direction.",
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should have no independent ceiling on amount beyond balance sufficiency', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const sender = await establishAccountSession(api, 'transfer-ceiling-sender');
    const recipient = await establishAccountSession(api, 'transfer-ceiling-recipient');
    if (!sender || !recipient) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const { status, body } = await test.step('Attempt a transfer for an enormous amount', async () => {
      const res = await transfer(api, sender.token, { to_account: recipient.accountNumber, amount: 999999999 });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();

      testInfo.attach('transfer-ceiling-probe', { body: JSON.stringify({ status, body }, null, 2), contentType: 'application/json' });
      return { status, body };
    });

    await test.step('Verify rejection is not solely a balance-sufficiency check', async () => {
      const onlyRejectedForBalance = status === 400 && body?.message === 'Insufficient funds';

      if (onlyRejectedForBalance) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          { endpoint: '/transfer', amountSubmitted: 999999999, rejectionReason: body?.message },
          ['Add an independent sanity ceiling on transfer amount regardless of balance sufficiency (mirrors the same gap already fixed for bill payments).']
        );
      } else {
        reporter.reportPass(
          'A very large transfer amount was rejected for a reason other than balance sufficiency.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should not expose a raw exception message for a malformed/missing amount', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'transfer-malformed');
    if (!session) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const { status, body } = await test.step('Submit a transfer with the amount field missing', async () => {
      const res = await transfer(api, session.token, { to_account: session.accountNumber });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();

      testInfo.attach('malformed-amount-probe', { body: JSON.stringify({ status, body }, null, 2), contentType: 'application/json' });
      return { status, body };
    });

    await test.step('Verify no raw exception message was exposed', async () => {
      const revealsRawError = status === 500 && /float\(\)|NoneType|argument must be/i.test(body?.message || '');

      if (revealsRawError) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          {
            endpoint: '/transfer',
            field: 'amount',
            technique: "Missing amount raises inside float(data.get('amount')); str(e) returned verbatim in the JSON 500 body",
            responseStatus: status,
            exposedMessage: body?.message
          },
          [
            'Validate amount is present and numeric before calling float() on it, returning a clean 400.',
            'Do not return raw Python exception text (str(e)) to API clients.'
          ]
        );
      } else {
        expect(status).not.toBe(500);
        reporter.reportPass(
          'Money transfer rejected a malformed amount without exposing a raw exception.',
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });

  test('self-transfer should net to zero', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'transfer-self');
    if (!session) {
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const balanceBefore = await test.step('Capture balance and perform a self-transfer', async () => {
      const balanceBeforeRes = await api.get(`/check_balance/${session.accountNumber}`);
      const balanceBefore = (await balanceBeforeRes.json().catch(() => null))?.balance;
      await transfer(api, session.token, { to_account: session.accountNumber, amount: 50 });
      return balanceBefore;
    });

    const balanceAfterRes = await api.get(`/check_balance/${session.accountNumber}`);
    const balanceAfter = (await balanceAfterRes.json().catch(() => null))?.balance;
    await api.dispose();

    expect(balanceAfter).toBe(balanceBefore);
  });
});

test.describe('API - Money transfer recipient validation', () => {
  test('should debit the sender for a transfer to a nonexistent to_account (money vanishes)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const sender = await establishAccountSession(api, 'transfer-ghost-sender');
    if (!sender) {
      reporter.reportSkip('Could not establish an account session (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account session available');
      return;
    }

    const amount = 30;
    const ghostAccount = await test.step('Confirm the target account does not exist', async () => {
      // generate_account_number() (app.py) only ever produces exactly 10
      // digits, so an 11-digit string is guaranteed to never match a real
      // account.
      const ghostAccount = '9'.repeat(11);
      const ghostCheck = await api.get(`/check_balance/${ghostAccount}`);
      expect(ghostCheck.status()).toBe(404);
      return ghostAccount;
    });

    const { status, body, balanceBefore, balanceAfter } = await test.step('Transfer to the nonexistent account', async () => {
      const balanceBeforeRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceBefore = (await balanceBeforeRes.json().catch(() => null))?.balance;

      const res = await transfer(api, sender.token, { to_account: ghostAccount, amount });
      const status = res.status();
      const body = await res.json().catch(() => null);

      const balanceAfterRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceAfter = (await balanceAfterRes.json().catch(() => null))?.balance;
      await api.dispose();

      testInfo.attach('ghost-account-probe', { body: JSON.stringify({ status, body, balanceBefore, balanceAfter }, null, 2), contentType: 'application/json' });
      return { status, body, balanceBefore, balanceAfter };
    });

    await test.step('Verify the sender was not silently debited', async () => {
      const vanishingConfirmed = status === 200 && body?.status === 'success' && balanceAfter === balanceBefore - amount;

      if (vanishingConfirmed) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          {
            endpoint: '/transfer',
            field: 'to_account',
            technique: 'to_account is never validated to reference an existing user; the recipient UPDATE affects 0 rows with no exception, funds are destroyed, and the API still reports success',
            senderBalanceBefore: balanceBefore,
            senderBalanceAfter: balanceAfter,
            amountLost: amount
          },
          [
            'Validate to_account exists (a real user account_number) before debiting the sender.',
            'Check UPDATE row counts (or use a JOIN/existence check) and roll back / return an error if the recipient update affected 0 rows.'
          ]
        );
      } else {
        expect(balanceAfter).toBe(balanceBefore);
        reporter.reportPass(
          'Money transfer rejected/reverted a transfer to a nonexistent to_account.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });
});

test.describe('API - Money transfer token handling & impersonation', () => {
  test('POST /transfer should not accept a token via the ?token= query string (insecure transmission)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const sender = await establishAccountSession(api, 'transfer-qstoken-sender');
    const recipient = await establishAccountSession(api, 'transfer-qstoken-recipient');
    if (!sender || !recipient) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const { status, body, balanceBefore, balanceAfter } = await test.step('Attempt a transfer authenticated via ?token= query string', async () => {
      const balanceBeforeRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceBefore = (await balanceBeforeRes.json().catch(() => null))?.balance;

      // No Authorization header at all — proving the token in the URL alone
      // authenticated the request.
      const res = await api.post(`/transfer?token=${sender.token}`, {
        data: { to_account: recipient.accountNumber, amount: 10 }
      });
      const status = res.status();
      const body = await res.json().catch(() => null);

      const balanceAfterRes = await api.get(`/check_balance/${sender.accountNumber}`);
      const balanceAfter = (await balanceAfterRes.json().catch(() => null))?.balance;
      await api.dispose();

      testInfo.attach('query-string-token-probe', { body: JSON.stringify({ status, body, balanceBefore, balanceAfter }, null, 2), contentType: 'application/json' });
      return { status, body, balanceBefore, balanceAfter };
    });

    await test.step('Verify the query-string token was not accepted', async () => {
    const queryTokenAccepted = status === 200 && body?.status === 'success' && balanceAfter === balanceBefore - 10;

      if (queryTokenAccepted) {
        reporter.reportVulnerability(
          'API2_AUTH',
          {
            endpoint: '/transfer',
            technique: 'Bearer token accepted via ?token= query string, no Authorization header sent',
            note: 'Query-string tokens are logged in server/proxy access logs and browser history'
          },
          [
            'Only accept the token from the Authorization: Bearer header.',
            'Reject tokens supplied via query string, form body, or cookie (auth.py: token_required currently checks all four locations).'
          ]
        );
      } else {
        expect(AUTH_DENIED_STATUSES).toContain(status);
        reporter.reportPass(
          'Money transfer did not authenticate a request via a query-string token.',
          'API2:2023 - Broken Authentication'
        );
      }
    });
  });

  test('POST /transfer with a forged token should be rejected (JWT_SECRET is no longer a fixed/guessable value)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const victim = await establishAccountSession(api, 'transfer-forged-victim');
    const attacker = await establishAccountSession(api, 'transfer-forged-attacker');
    if (!victim || !attacker) {
      reporter.reportSkip('Could not establish two account sessions (register/login) on this target.');
      await api.dispose();
      test.skip(true, 'No account sessions available');
      return;
    }

    const amount = 50;
    const { status, body, balanceBeforeVictim, balanceAfterVictim, balanceBeforeAttacker, balanceAfterAttacker } = await test.step('Forge a token for the victim and attempt to transfer their funds', async () => {
      const balanceBeforeVictimRes = await api.get(`/check_balance/${victim.accountNumber}`);
      const balanceBeforeVictim = (await balanceBeforeVictimRes.json().catch(() => null))?.balance;
      const balanceBeforeAttackerRes = await api.get(`/check_balance/${attacker.accountNumber}`);
      const balanceBeforeAttacker = (await balanceBeforeAttackerRes.json().catch(() => null))?.balance;

      // fixtures/api/jwt-forge.helpers.ts signs with a previously-hardcoded weak
      // secret ('secret123'). auth.py has since been changed to derive
      // JWT_SECRET from the environment (random per-process fallback), so this
      // forged token is expected to fail signature verification today. Kept as
      // a live probe (not a hardcoded assumption) so this test automatically
      // starts reporting a real finding again if the secret is ever
      // reintroduced or reset to a guessable value.
      const forgedToken = forgeToken({ userId: victim.userId, username: victim.user.username || '', isAdmin: false });

      const res = await transfer(api, forgedToken, { to_account: attacker.accountNumber, amount });
      const status = res.status();
      const body = await res.json().catch(() => null);

      const balanceAfterVictimRes = await api.get(`/check_balance/${victim.accountNumber}`);
      const balanceAfterVictim = (await balanceAfterVictimRes.json().catch(() => null))?.balance;
      const balanceAfterAttackerRes = await api.get(`/check_balance/${attacker.accountNumber}`);
      const balanceAfterAttacker = (await balanceAfterAttackerRes.json().catch(() => null))?.balance;
      await api.dispose();

      testInfo.attach('forged-jwt-transfer-probe', {
        body: JSON.stringify({ status, body, balanceBeforeVictim, balanceAfterVictim, balanceBeforeAttacker, balanceAfterAttacker }, null, 2),
        contentType: 'application/json'
      });
      return { status, body, balanceBeforeVictim, balanceAfterVictim, balanceBeforeAttacker, balanceAfterAttacker };
    });

    await test.step("Verify the forged token did not move the victim's funds", async () => {
    const bolaConfirmed =
      status === 200 &&
      body?.status === 'success' &&
      balanceAfterVictim === balanceBeforeVictim - amount &&
      balanceAfterAttacker === balanceBeforeAttacker + amount;

    if (bolaConfirmed) {
      reporter.reportVulnerability(
        'API1_BOLA',
        {
          endpoint: '/transfer',
          technique: "JWT forged with a previously-known weak secret, claiming another user's user_id, used to move that user's real funds",
          victimUserId: victim.userId,
          victimAccountNumber: victim.accountNumber,
          attackerAccountNumber: attacker.accountNumber,
          amountStolen: amount
        },
        [
          'Keep JWT_SECRET environment-provided and never fall back to a fixed/guessable value.',
          "Do not trust current_user['user_id'] from a token alone for a funds-moving operation without re-verifying the session server-side."
        ]
      );
    } else {
      expect(AUTH_DENIED_STATUSES).toContain(status);
      reporter.reportPass(
        "Money transfer did not move the victim's funds for a token forged with a previously-known weak JWT secret — the JWT_SECRET fix holds on this endpoint too.",
        'API2:2023 - Broken Authentication'
      );
    }
    });
  });
});
