import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { validateSchema } from '../../helpers/schema-validator';
import { establishAccountSession } from '../../fixtures/api/transactions.helpers';
import { createVirtualCardAndFetch, updateCardLimit, listVirtualCards } from '../../fixtures/api/virtual-cards.helpers';
import {
  getBillCategories,
  getBillersByCategory,
  createBillPayment,
  getBillPaymentHistory,
  findPaymentByReference,
  discoverBiller
} from '../../fixtures/api/bill-payments.helpers';

/**
 * API Bill Payment Tests
 *
 * These tests exercise the bill payment surfaces:
 *   - GET  /api/bill-categories              (public, no auth)
 *   - GET  /api/billers/by-category/<id>     (public, no auth)
 *   - POST /api/bill-payments/create         (any authenticated user)
 *   - GET  /api/bill-payments/history        (owner-scoped via token)
 *
 * Test Strategy:
 * 1. Functional: the catalog endpoints are intentionally public; an
 *    authenticated user can pay a bill from their account balance or from a
 *    virtual card, and payment history is correctly scoped to the caller.
 * 2. Security: probe amount validation (including that a negative amount
 *    increases the payer's balance rather than merely being "accepted"),
 *    biller_id validation, a non-destructive SQL injection probe on
 *    card_id, BOLA via card_id (paying with another user's card), reference
 *    number predictability, and full card-number exposure in history.
 *
 * A funded virtual card is needed for several tests. A fresh card always
 * starts at current_balance: 0.0 with no legitimate way to add funds, so
 * these tests reuse the already-known mass-assignment vulnerability on
 * `/api/virtual-cards/<id>/update-limit` (see tests/api/virtual-cards.spec.ts)
 * purely as test setup — funding a card this way is not itself a new
 * finding here.
 *
 * Not covered: the balance-check-then-deduct race condition in
 * create_bill_payment (no row lock between the two queries) is real in the
 * code, but app.py runs a single-threaded Werkzeug dev server (no
 * threaded=True, plain `python app.py` per the Dockerfile), so concurrent
 * requests serialize and a Promise.all-based race test would reliably
 * false-negative "pass" against this deployment. Left as documented future
 * work rather than a misleading test.
 */

const AUTH_DENIED_STATUSES = [401, 403];

test.describe('@api @feature:bill-payments API - Bill categories & billers (public catalog)', () => {
  test('GET /api/bill-categories should be reachable without a token (public by design)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const body = await test.step('Fetch bill categories without a token', async () => {
      const anon = await request.newContext({ baseURL: baseURL.toString() });
      const res = await getBillCategories(anon);
      const status = res.status();
      const body = await res.json().catch(() => null);
      await anon.dispose();
      expect(status).toBe(200);
      return body;
    });

    await test.step('Verify the catalog is well-formed', async () => {
      expect(Array.isArray(body?.categories)).toBe(true);
      expect(body.categories.length).toBeGreaterThan(0);
      expect(body.categories[0]).toHaveProperty('id');
      expect(body.categories[0]).toHaveProperty('name');
      await validateSchema('bill-payments-schema', 'GET_categories', body);

      reporter.reportPass(
        'Bill categories are intentionally public per the application\'s design (no auth required to browse the catalog).',
        'API2:2023 - Broken Authentication'
      );
    });
  });

  test('GET /api/billers/by-category/<id> should be reachable without a token (public by design)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const discovered = await discoverBiller(anon);
    if (!discovered) {
      reporter.reportSkip('Could not discover a category/biller pair on this target.');
      await anon.dispose();
      test.skip(true, 'No biller catalog available');
      return;
    }

    const body = await test.step('Fetch billers for the discovered category', async () => {
      const res = await getBillersByCategory(anon, discovered.category.id);
      const status = res.status();
      const body = await res.json().catch(() => null);
      await anon.dispose();
      expect(status).toBe(200);
      return body;
    });

    await test.step('Verify the biller list is well-formed', async () => {
      expect(Array.isArray(body?.billers)).toBe(true);
      expect(body.billers.length).toBeGreaterThan(0);
      await validateSchema('bill-payments-schema', 'GET_billers', body);

      reporter.reportPass(
        'Biller listing is intentionally public per the application\'s design (no auth required to browse billers).',
        'API2:2023 - Broken Authentication'
      );
    });
  });

  test('should expose full biller account_number to anonymous callers (excessive data exposure)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const anon = await request.newContext({ baseURL: baseURL.toString() });
    const discovered = await discoverBiller(anon);
    await anon.dispose();

    if (!discovered) {
      reporter.reportSkip('Could not discover a category/biller pair on this target.');
      test.skip(true, 'No biller catalog available');
      return;
    }

    await test.step('Verify the biller account_number is disclosed', async () => {
      expect(typeof discovered.biller.account_number).toBe('string');
      expect(discovered.biller.account_number.length).toBeGreaterThan(0);

      reporter.reportVulnerability(
        'API3_DATA_EXPOSURE',
        {
          endpoint: '/api/billers/by-category/<id>',
          disclosedField: 'account_number',
          sampleBillerId: discovered.biller.id,
          requiresAuth: false
        },
        [
          'Do not return internal biller settlement account numbers to unauthenticated clients.',
          'Return only the fields the payment form needs (id, name, minimum_amount, maximum_amount) and mask or omit account_number.'
        ]
      );
    });
  });

  test('should return consistently-shaped category and biller objects', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });

    await test.step('Fetch categories and their billers, verifying shape', async () => {
      const catRes = await getBillCategories(api);
      const catBody = await catRes.json().catch(() => null);
      const categories = catBody?.categories || [];

      for (const category of categories.slice(0, 2)) {
        const billerRes = await getBillersByCategory(api, category.id);
        const billerBody = await billerRes.json().catch(() => null);
        for (const biller of billerBody?.billers || []) {
          expect(typeof biller.id).toBe('number');
          expect(typeof biller.name).toBe('string');
          expect(typeof biller.minimum_amount).toBe('number');
          expect(biller.maximum_amount === null || typeof biller.maximum_amount === 'number').toBe(true);
        }
      }
      await api.dispose();
    });

    reporter.reportPass(
      'Category and biller responses have a consistent, correctly-typed shape.',
      'N/A'
    );
  });
});

test.describe('API - Bill payment creation', () => {
  test('POST /api/bill-payments/create should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const status = await test.step('Attempt to create a bill payment without authentication', async () => {
      const anon = await request.newContext({ baseURL: baseURL.toString() });
      const discovered = await discoverBiller(anon);
      const res = await createBillPayment(anon, '', {
        biller_id: discovered?.biller.id ?? 1,
        amount: 50,
        payment_method: 'balance'
      });
      const status = res.status();
      await anon.dispose();
      return status;
    });

    await test.step('Verify the request was rejected', async () => {
      expect(AUTH_DENIED_STATUSES).toContain(status);
      reporter.reportPass(
        'Bill payment creation endpoint rejected a request without a valid token.',
        'API2:2023 - Broken Authentication'
      );
    });
  });

  test('should let an authenticated user pay a bill from their account balance', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-basic');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const amount = discovered.biller.minimum_amount + 5;
    const body = await test.step('Pay a bill from account balance', async () => {
      const res = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount,
        payment_method: 'balance',
        description: 'API test payment'
      });
      const body = await res.json().catch(() => null);

      expect(res.status()).toBe(200);
      expect(body?.status).toBe('success');
      expect(body?.payment_details?.reference).toMatch(/^BILL\d+$/);
      expect(body?.payment_details?.amount).toBe(amount);
      expect(body?.payment_details?.payment_method).toBe('balance');
      await validateSchema('bill-payments-schema', 'POST_create', body);
      return body;
    });

    await test.step('Verify the payment was persisted and correctly attributed', async () => {
      const persisted = await findPaymentByReference(api, session.token, body.payment_details.reference);
      await api.dispose();

      expect(persisted).toBeTruthy();
      expect(persisted?.amount).toBe(amount);
      expect(persisted?.biller_name).toBe(discovered.biller.name);
      expect(persisted?.category_name).toBe(discovered.category.name);
      expect(persisted?.card_number).toBeNull();

      reporter.reportPass(
        'Authenticated user paid a bill from their account balance and it was correctly persisted and attributed.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    });
  });

  test('should let an authenticated user pay a bill from a funded virtual card', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-card');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the card-funded payment check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }
    await updateCardLimit(api, session.token, card.id, { current_balance: 200 });

    const amount = discovered.biller.minimum_amount + 5;
    await test.step('Pay a bill from the funded virtual card', async () => {
      const res = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount,
        payment_method: 'virtual_card',
        card_id: card.id
      });
      const body = await res.json().catch(() => null);

      expect(res.status()).toBe(200);
      expect(body?.status).toBe('success');
    });

    await test.step('Verify the card balance was debited correctly', async () => {
      const listRes = await listVirtualCards(api, session.token);
      const listBody = await listRes.json().catch(() => null);
      const updatedCard = (listBody?.cards || []).find((c: { id: number }) => c.id === card.id);
      await api.dispose();

      expect(updatedCard?.balance).toBe(200 - amount);

      reporter.reportPass(
        'Authenticated user paid a bill from their own funded virtual card and the balance was debited correctly.',
        'API6:2023 - Unrestricted Access to Sensitive Business Flows'
      );
    });
  });

  test('GET /api/bill-payments/history should require authentication', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const status = await test.step('Request payment history without authentication', async () => {
      const anon = await request.newContext({ baseURL: baseURL.toString() });
      const res = await getBillPaymentHistory(anon, '');
      const status = res.status();
      await anon.dispose();
      return status;
    });

    await test.step('Verify the request was rejected', async () => {
      expect(AUTH_DENIED_STATUSES).toContain(status);
      reporter.reportPass(
        'Bill payment history endpoint rejected a request without a valid token.',
        'API2:2023 - Broken Authentication'
      );
    });
  });

  test('GET /api/bill-payments/history should be correctly scoped to the caller', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const userA = await establishAccountSession(api, 'bill-scope-a');
    const userB = await establishAccountSession(api, 'bill-scope-b');
    const discovered = await discoverBiller(api);
    if (!userA || !userB || !discovered) {
      reporter.reportSkip('Could not establish two account sessions or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    // Use distinct amounts (not references) to tell the two users' payments
    // apart: reference numbers are known-predictable (int(time.time())) and
    // two payments issued in the same second can share an identical
    // reference (see the dedicated reference-predictability test below), so
    // comparing by reference here would be unreliable.
    const amountA = discovered.biller.minimum_amount + 1;
    const amountB = discovered.biller.minimum_amount + 2;

    const { amountsA, amountsB } = await test.step('Create one payment per user and fetch each history', async () => {
      await createBillPayment(api, userA.token, { biller_id: discovered.biller.id, amount: amountA, payment_method: 'balance' });
      await createBillPayment(api, userB.token, { biller_id: discovered.biller.id, amount: amountB, payment_method: 'balance' });

      const historyA = await getBillPaymentHistory(api, userA.token);
      const historyABody = await historyA.json().catch(() => null);
      const historyB = await getBillPaymentHistory(api, userB.token);
      const historyBBody = await historyB.json().catch(() => null);
      await api.dispose();

      const amountsA = (historyABody?.payments || []).map((p: { amount: number }) => p.amount);
      const amountsB = (historyBBody?.payments || []).map((p: { amount: number }) => p.amount);
      return { amountsA, amountsB };
    });

    await test.step('Verify each history contains only its own payment', async () => {
      expect(amountsA).toContain(amountA);
      expect(amountsA).not.toContain(amountB);
      expect(amountsB).toContain(amountB);
      expect(amountsB).not.toContain(amountA);

      reporter.reportPass(
        'Payment history is correctly scoped to the authenticated caller via the token-derived user id.',
        'API1:2023 - Broken Object Level Authorization'
      );
    });
  });

  test('GET /api/bill-payments/history should return all payments with no pagination', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-nopage');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const amount = discovered.biller.minimum_amount + 1;
    const { references, historyBody } = await test.step('Create five payments and fetch history', async () => {
      const references: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await createBillPayment(api, session.token, { biller_id: discovered.biller.id, amount, payment_method: 'balance' });
        const body = await res.json().catch(() => null);
        if (body?.payment_details?.reference) references.push(body.payment_details.reference);
      }

      const historyRes = await getBillPaymentHistory(api, session.token);
      const historyBody = await historyRes.json().catch(() => null);
      await api.dispose();
      await validateSchema('bill-payments-schema', 'GET_history', historyBody);
      return { references, historyBody };
    });

    await test.step('Verify all five payments are present with no pagination', async () => {
      const returnedReferences = (historyBody?.payments || []).map((p: { reference: string }) => p.reference);
      for (const reference of references) {
        expect(returnedReferences).toContain(reference);
      }
    });
  });

  test('should never transition payment status away from pending after a "successful" payment', async ({ baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-status');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const amount = discovered.biller.minimum_amount + 1;
    const { body, persisted } = await test.step('Create a payment and fetch it back', async () => {
      const res = await createBillPayment(api, session.token, { biller_id: discovered.biller.id, amount, payment_method: 'balance' });
      const body = await res.json().catch(() => null);

      const persisted = await findPaymentByReference(api, session.token, body?.payment_details?.reference);
      await api.dispose();
      return { body, persisted };
    });

    await test.step('Verify the payment status remains pending', async () => {
      expect(body?.message).toBe('Payment processed successfully');
      expect(persisted?.status).toBe('pending');
      expect(persisted?.processed_at).toBeNull();
    });
  });

  test('should not validate that amount is positive (negative amount inflates the payer\'s balance)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-negative');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    // A fresh account starts with balance 1000.0 (database.py DEFAULT). Paying
    // a negative amount computes `balance - amount`, so -50 should raise the
    // balance to 1050 rather than lower it. Proving the inflation without a
    // dedicated balance-read endpoint: pay -50, then pay 1049 (an amount that
    // would fail "Insufficient balance" against the original 1000, but should
    // succeed against 1050).
    const { negativeStatus, negativeBody, followUpStatus, followUpBody } = await test.step('Pay a negative amount, then a follow-up amount that only succeeds if inflated', async () => {
      const negativeRes = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount: -50,
        payment_method: 'balance'
      });
      const negativeBody = await negativeRes.json().catch(() => null);

      const followUpRes = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount: 1049,
        payment_method: 'balance'
      });
      const followUpBody = await followUpRes.json().catch(() => null);
      await api.dispose();

      testInfo.attach('negative-amount-probe', {
        body: JSON.stringify({ negativeBody, followUpBody }, null, 2),
        contentType: 'application/json'
      });
      return { negativeStatus: negativeRes.status(), negativeBody, followUpStatus: followUpRes.status(), followUpBody };
    });

    await test.step('Verify the negative amount did not inflate the balance', async () => {
      const negativeAccepted = negativeStatus === 200 && negativeBody?.status === 'success';
      const balanceInflated = negativeAccepted && followUpStatus === 200 && followUpBody?.status === 'success';

      if (balanceInflated) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          {
            endpoint: '/api/bill-payments/create',
            technique: 'Negative amount payment (-50) increases balance instead of decreasing it',
            firstPaymentAmount: -50,
            secondPaymentAmount: 1049,
            secondPaymentSucceededAgainstInflatedBalance: true
          },
          [
            'Reject non-positive amount values before processing any bill payment.',
            'Never allow a payment to increase the payer\'s balance; enforce amount > 0 server-side.'
          ]
        );
      } else {
        expect(negativeStatus).toBeGreaterThanOrEqual(400);
        reporter.reportPass(
          'Bill payment creation rejected a negative amount.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should not validate that amount is non-zero', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-zero');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { status, body } = await test.step('Submit a bill payment with amount 0', async () => {
      const res = await createBillPayment(api, session.token, { biller_id: discovered.biller.id, amount: 0, payment_method: 'balance' });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();
      return { status, body };
    });

    await test.step('Verify the zero amount was rejected', async () => {
      const accepted = status === 200 && body?.status === 'success';

      if (accepted) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          { endpoint: '/api/bill-payments/create', amountSubmitted: 0, responseStatus: status },
          ['Reject a zero amount before processing any bill payment.']
        );
      } else {
        expect(status).toBeGreaterThanOrEqual(400);
        reporter.reportPass(
          'Bill payment creation rejected a zero amount.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should not enforce the biller\'s minimum_amount', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-min');
    const discovered = await discoverBiller(api);
    if (!session || !discovered || discovered.biller.minimum_amount <= 1) {
      reporter.reportSkip('Could not establish setup with a biller minimum_amount greater than 1 on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const belowMinimum = 1;
    const { status, body } = await test.step("Submit an amount below the biller's minimum_amount", async () => {
      const res = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount: belowMinimum,
        payment_method: 'balance'
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();
      return { status, body };
    });

    await test.step('Verify the below-minimum amount was rejected', async () => {
      const accepted = status === 200 && body?.status === 'success';

      if (accepted) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          {
            endpoint: '/api/bill-payments/create',
            billerId: discovered.biller.id,
            minimumAmount: discovered.biller.minimum_amount,
            amountSubmitted: belowMinimum
          },
          ["Enforce biller.minimum_amount/maximum_amount server-side before creating the payment."]
        );
      } else {
        expect(status).toBeGreaterThanOrEqual(400);
        reporter.reportPass(
          "Bill payment creation rejected an amount below the biller's minimum_amount.",
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should have no independent ceiling on amount beyond balance sufficiency', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-large');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { status, body } = await test.step('Submit an enormous payment amount', async () => {
      const res = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount: 999999999,
        payment_method: 'balance'
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();
      return { status, body };
    });

    await test.step('Verify rejection is not solely a balance-sufficiency check', async () => {
      const onlyRejectedForBalance = status === 400 && body?.message === 'Insufficient balance';

      if (onlyRejectedForBalance) {
        reporter.reportVulnerability(
          'API6_MASS_ASSIGNMENT',
          {
            endpoint: '/api/bill-payments/create',
            amountSubmitted: 999999999,
            rejectionReason: body?.message
          },
          ['Add an independent sanity ceiling on payment amount regardless of balance sufficiency.']
        );
      } else {
        reporter.reportPass(
          'A very large payment amount was rejected for a reason other than balance sufficiency.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should not validate biller_id against the billers table cleanly (nonexistent id)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-badid');
    if (!session) {
      reporter.reportSkip('Could not establish an account session on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { status, body } = await test.step('Submit a nonexistent biller_id', async () => {
      const res = await createBillPayment(api, session.token, {
        biller_id: 999999999,
        amount: 50,
        payment_method: 'balance'
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();

      testInfo.attach('bad-biller-id-probe', { body: JSON.stringify({ status, body }, null, 2), contentType: 'application/json' });
      return { status, body };
    });

    await test.step('Verify no raw DB error was exposed', async () => {
    const revealsRawDbError = status === 500 && /foreign key|violates|constraint|psycopg2/i.test(body?.message || '');

    if (revealsRawDbError) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        {
          endpoint: '/api/bill-payments/create',
          field: 'biller_id',
          technique: 'Nonexistent biller_id triggers an unhandled DB foreign-key violation instead of a clean 400',
          responseStatus: status,
          exposedMessage: body?.message
        },
        [
          'Validate biller_id exists (and is active) before attempting the insert, returning a clean 400.',
          'Do not return raw database exception text (str(e)) to API clients.'
        ]
      );
      } else {
        expect(status).toBe(400);
        reporter.reportPass(
          'Bill payment creation rejected a nonexistent biller_id without exposing a raw database error.',
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });

  test('should not build the card_id lookup with unsanitized input (SQL injection / error exposure)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-sqli');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { status, body } = await test.step('Submit an apostrophe in card_id', async () => {
      // card_id is f-string interpolated unquoted into `WHERE id = {card_id}`
      // with no int-cast, so a trailing apostrophe breaks the SQL syntax — the
      // same non-destructive single-quote probe used against card_type in
      // tests/api/virtual-cards.spec.ts.
      const res = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount: 50,
        payment_method: 'virtual_card',
        card_id: "1'"
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();

      testInfo.attach('card-id-sqli-probe', { body: JSON.stringify({ status, body }, null, 2), contentType: 'application/json' });
      return { status, body };
    });

    await test.step('Verify no raw SQL error was exposed', async () => {
      const revealsRawSqlError = status === 500 && /syntax error|psycopg2|SQL|LINE \d+/i.test(body?.message || '');

      if (revealsRawSqlError) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          {
            endpoint: '/api/bill-payments/create',
            field: 'card_id',
            technique: "Unescaped apostrophe in card_id (\"1'\") breaking out of the interpolated SQL WHERE clause",
            responseStatus: status,
            exposedMessage: body?.message
          },
          [
            'Cast card_id to int (or validate as numeric) before interpolating it into any SQL.',
            'Use parameterized queries for the card lookup.',
            'Do not return raw database exception text to API clients.'
          ]
        );
      } else {
        expect(status).not.toBe(500);
        reporter.reportPass(
          'Bill payment creation handled a non-numeric card_id without exposing a raw database error.',
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });

  test('should not let a user pay a bill using another user\'s virtual card (BOLA)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const owner = await establishAccountSession(api, 'bill-bola-owner');
    const attacker = await establishAccountSession(api, 'bill-bola-attacker');
    const discovered = await discoverBiller(api);
    if (!owner || !attacker || !discovered) {
      reporter.reportSkip('Could not establish two account sessions or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, owner.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the BOLA check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }
    await updateCardLimit(api, owner.token, card.id, { current_balance: 200 });

    const amount = discovered.biller.minimum_amount + 5;
    const { status, body, ownerCardAfter } = await test.step("Attempt to pay a bill using the owner's card as a different user", async () => {
      const crossUserRes = await createBillPayment(api, attacker.token, {
        biller_id: discovered.biller.id,
        amount,
        payment_method: 'virtual_card',
        card_id: card.id
      });
      const crossUserBody = await crossUserRes.json().catch(() => null);
      const status = crossUserRes.status();

      const listRes = await listVirtualCards(api, owner.token);
      const listBody = await listRes.json().catch(() => null);
      const ownerCardAfter = (listBody?.cards || []).find((c: { id: number }) => c.id === card.id);
      await api.dispose();

      testInfo.attach('bill-bola-probe', {
        body: JSON.stringify({ status, body: crossUserBody, ownerCardBalanceAfter: ownerCardAfter?.balance }, null, 2),
        contentType: 'application/json'
      });
      return { status, body: crossUserBody, ownerCardAfter };
    });

    await test.step('Verify the payment was rejected', async () => {
      const bolaConfirmed =
        status === 200 && body?.status === 'success' && ownerCardAfter?.balance === 200 - amount;

      if (bolaConfirmed) {
        reporter.reportVulnerability(
          'API1_BOLA',
          {
            endpoint: '/api/bill-payments/create',
            field: 'card_id',
            cardOwner: owner.userId,
            actingUser: attacker.userId,
            cardId: card.id,
            balanceBefore: 200,
            balanceAfter: ownerCardAfter?.balance,
            amountCharged: amount
          },
          [
            'Verify card_id belongs to current_user (WHERE id = %s AND user_id = %s) before using it for a bill payment.',
            'Return 403/404 when payment_method=virtual_card references a card the caller does not own.'
          ]
        );
      } else {
        expect(AUTH_DENIED_STATUSES.concat(400, 404)).toContain(status);
        reporter.reportPass(
          "Bill payment creation rejected a virtual_card payment against a card the caller does not own.",
          'API1:2023 - Broken Object Level Authorization'
        );
      }
    });
  });

  test('should generate predictable, second-resolution reference numbers', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-reference');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const amount = discovered.biller.minimum_amount + 1;
    const { referenceA, referenceB } = await test.step('Create two payments back-to-back', async () => {
      const [resA, resB] = await Promise.all([
        createBillPayment(api, session.token, { biller_id: discovered.biller.id, amount, payment_method: 'balance' }),
        createBillPayment(api, session.token, { biller_id: discovered.biller.id, amount, payment_method: 'balance' })
      ]);
      const bodyA = await resA.json().catch(() => null);
      const bodyB = await resB.json().catch(() => null);
      await api.dispose();

      const referenceA: string | undefined = bodyA?.payment_details?.reference;
      const referenceB: string | undefined = bodyB?.payment_details?.reference;

      expect(referenceA).toMatch(/^BILL\d+$/);
      expect(referenceB).toMatch(/^BILL\d+$/);

      testInfo.attach('reference-predictability-probe', { body: JSON.stringify({ referenceA, referenceB }, null, 2), contentType: 'application/json' });
      return { referenceA: referenceA!, referenceB: referenceB! };
    });

    await test.step('Assess reference predictability', async () => {
    const epochA = parseInt(referenceA.replace('BILL', ''), 10);
    const epochB = parseInt(referenceB.replace('BILL', ''), 10);
    const delta = Math.abs(epochB - epochA);

    if (referenceA === referenceB) {
      reporter.reportVulnerability(
        'API8_SECURITY_MISCONFIGURATION',
        { endpoint: '/api/bill-payments/create', referenceA, referenceB, collided: true },
        [
          'Generate reference numbers with a random/unique component (e.g. UUID or a DB sequence), not int(time.time()).',
          'Add a UNIQUE constraint on bill_payments.reference_number.'
        ]
      );
      } else if (delta <= 2) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          { endpoint: '/api/bill-payments/create', referenceA, referenceB, deltaSeconds: delta, collided: false },
          [
            'References are sequential, second-resolution, and trivially predictable even where they did not collide in this run.',
            'Generate reference numbers with a random/unique component (e.g. UUID or a DB sequence), not int(time.time()).'
          ]
        );
      } else {
        reporter.reportPass(
          'Two payments created back-to-back produced references outside the expected predictable-delta window in this run.',
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });

  test('should expose the full unmasked card number in payment history (excessive data exposure)', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-cardexposure');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the exposure check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }
    await updateCardLimit(api, session.token, card.id, { current_balance: 200 });

    const amount = discovered.biller.minimum_amount + 5;
    const persisted = await test.step('Pay a bill from the card and fetch the persisted payment', async () => {
      const payRes = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount,
        payment_method: 'virtual_card',
        card_id: card.id
      });
      const payBody = await payRes.json().catch(() => null);
      const persisted = await findPaymentByReference(api, session.token, payBody?.payment_details?.reference);
      await api.dispose();
      return persisted;
    });

    await test.step('Verify the card number is exposed unmasked', async () => {
      expect(persisted).toBeTruthy();
      expect(persisted?.card_number).toMatch(/^\d{16}$/);

      reporter.reportVulnerability(
        'API3_DATA_EXPOSURE',
        {
          endpoint: '/api/bill-payments/history',
          disclosedField: 'card_number (full, unmasked)',
          paymentId: persisted?.id
        },
        [
          'Mask all but the last four digits of card_number in payment history responses (the UI already only renders the last 4 — mask it server-side too).',
          'Do not join and return the full card_number from virtual_cards at all; return only last4 or a card display label.'
        ]
      );
    });
  });

  test('should complete a virtual card payment with no CVV or other transaction verification', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-no-verification');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    const { card } = await createVirtualCardAndFetch(api, session.token, { card_limit: 500 });
    if (!card) {
      reporter.reportSkip('Could not create a virtual card to run the verification check.');
      await api.dispose();
      test.skip(true, 'Card not created');
      return;
    }
    // A new card's current_balance defaults to 0 — fund it first so a
    // rejection below can only mean "verification required", not
    // "insufficient balance" for an unrelated reason.
    await updateCardLimit(api, session.token, card.id, { current_balance: 200 });

    const amount = discovered.biller.minimum_amount + 1;
    const { status, body } = await test.step('Pay from the virtual card without sending its CVV', async () => {
      // app.py's create_bill_payment only ever reads card_id for a virtual-card
      // payment (checks is_frozen and current_balance, nothing else) — the
      // card's own cvv is known here (from creation) but deliberately never
      // sent, to prove the payment succeeds without it.
      const res = await createBillPayment(api, session.token, {
        biller_id: discovered.biller.id,
        amount,
        payment_method: 'virtual_card',
        card_id: card.id
        // cvv intentionally omitted
      });
      const status = res.status();
      const body = await res.json().catch(() => null);
      await api.dispose();

      testInfo.attach('no-verification-probe', {
        body: JSON.stringify({ cvvKnown: card.cvv, cvvSent: false, status, body }, null, 2),
        contentType: 'application/json'
      });
      return { status, body };
    });

    await test.step('Verify the payment required additional verification', async () => {
    const succeededWithoutVerification = status === 200 && body?.status === 'success';

    if (succeededWithoutVerification) {
      reporter.reportVulnerability(
        'API6_MASS_ASSIGNMENT',
        {
          endpoint: '/api/bill-payments/create',
          paymentMethod: 'virtual_card',
          verificationSent: 'none (no CVV, no OTP, no re-authentication)',
          cardId: card.id
        },
        [
          'Require the card CVV (or another out-of-band verification step) on every virtual-card payment, not just an internal card_id.',
          'This compounds the existing BOLA finding on this same field (see "should not let a user pay a bill using another user\'s virtual card") — anyone who can guess/enumerate a card_id can both use it cross-account AND without ever proving they hold the card.'
        ]
      );
      } else {
        reporter.reportPass(
          'Virtual card payment was not completed without additional transaction verification.',
          'API6:2023 - Unrestricted Access to Sensitive Business Flows'
        );
      }
    });
  });

  test('should not expose a raw database error for malformed biller_id/category_id input', async ({ baseURL }, testInfo) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const reporter = new SecurityReporter(testInfo);

    const api = await request.newContext({ baseURL: baseURL.toString() });
    const session = await establishAccountSession(api, 'bill-biller-sqli');
    const discovered = await discoverBiller(api);
    if (!session || !discovered) {
      reporter.reportSkip('Could not establish an account session or discover a biller on this target.');
      await api.dispose();
      test.skip(true, 'Setup unavailable');
      return;
    }

    // Two distinct spots, both checked: neither is exploitable as classic
    // "auth bypass" SQL injection, but one still leaks a raw DB error.
    // 1. biller_id in POST /api/bill-payments/create — inserted via a
    //    parameterized query (%s placeholders), so a payload can't break out
    //    of a string literal the way card_id/card_type can elsewhere in this
    //    app (see the card_id SQLi test above). BUT: bill_payments.biller_id
    //    is an INTEGER column, so a non-integer value still fails at the
    //    database layer with psycopg2's own type-coercion error — and
    //    that raw error (revealing the exact VALUES clause, including
    //    another user's internal numeric id) is returned to the client
    //    verbatim. Confirmed live: sending "1 OR '1'='1'" as biller_id
    //    produces a 500 with the literal Postgres message
    //    `invalid input syntax for type integer: "1 OR '1'='1'" ... LINE 4: VALUES (1427, ...`.
    //    This is real detailed-error-exposure (API8), not injection (API8
    //    is still the right bucket — same category the SKILL.md convention
    //    table already uses for raw SQL/traceback exposure).
    // 2. category_id in GET /api/billers/by-category/<int:category_id> —
    //    interpolated into a raw f-string SQL query, but the route is
    //    declared with Flask's <int:> converter, which 404s any non-integer
    //    path segment before the handler runs at all — confirmed live, not
    //    exploitable.
    const { paymentStatus, paymentBody, categoryStatus } = await test.step('Submit SQL injection payloads for biller_id and category_id', async () => {
      const paymentRes = await createBillPayment(api, session.token, {
        biller_id: "1 OR '1'='1",
        amount: discovered.biller.minimum_amount + 1,
        payment_method: 'balance'
      });
      const paymentStatus = paymentRes.status();
      const paymentBody = await paymentRes.json().catch(() => null);

      const categoryRes = await api.get(`/api/billers/by-category/1%20OR%201=1`);
      const categoryStatus = categoryRes.status();
      await api.dispose();

      testInfo.attach('biller-sqli-probe', {
        body: JSON.stringify(
          { paymentStatus, paymentBody, categoryStatus, categoryRouteBlocked: categoryStatus === 404 },
          null,
          2
        ),
        contentType: 'application/json'
      });
      return { paymentStatus, paymentBody, categoryStatus };
    });

    await test.step('Verify neither endpoint exposed a raw error or was exploitable', async () => {
    const paymentRevealsDbError = paymentStatus === 500 && /syntax error|psycopg2|invalid input syntax|LINE \d+/i.test(paymentBody?.message || '');
    const categoryRouteBlocked = categoryStatus === 404;

      if (paymentRevealsDbError || !categoryRouteBlocked) {
        reporter.reportVulnerability(
          'API8_SECURITY_MISCONFIGURATION',
          { biller_id: paymentBody, categoryRouteStatus: categoryStatus },
          [
            'Validate biller_id is a positive integer before it ever reaches the database, and return a generic 400 for malformed input.',
            'Do not return raw database exception text (str(e)) to API clients for any endpoint; log it server-side and return a generic error message.',
            'If category_id\'s <int:> converter is ever loosened to a string type, parameterize that query before doing so.'
          ]
        );
      } else {
        reporter.reportPass(
          "Neither biller_id nor category_id exposed a raw database error or allowed a classic injection payload through.",
          'API8:2023 - Security Misconfiguration'
        );
      }
    });
  });
});
