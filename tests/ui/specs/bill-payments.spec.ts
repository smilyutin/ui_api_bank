import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { loadStoredToken } from '../../../helpers/credentials';
import { request } from '@playwright/test';
import { updateCardLimit, listVirtualCards } from '../../../fixtures/api/virtual-cards.helpers';

/**
 * Bill Payment Tests (UI)
 *
 * These tests verify that the dashboard's Pay Bill form lets an
 * authenticated user pay a bill from their account balance or from a
 * virtual card, and that the payment shows up in payment history.
 *
 * Test Strategy:
 * 1. Authenticate and load the dashboard.
 * 2. Pay a bill through the BillPaymentsPage POM (category -> biller ->
 *    amount -> payment method [-> card] -> description -> submit).
 * 3. Verify the confirmation message and effect (balance/card decreased,
 *    payment visible in history after reload).
 *
 * The negative-amount case documents actual current behavior rather than
 * asserting a "should reject" expectation: `#bill_amount` has no `min`
 * attribute (templates/dashboard.html) and `/api/bill-payments/create`
 * performs no server-side validation on `amount` (app.py) — a negative
 * amount is accepted end-to-end and actually inflates the payer's balance.
 * The equivalent API-level finding is reported via SecurityReporter in
 * tests/api/bill-payments.spec.ts; this UI test just confirms the same
 * behavior is reachable through the dashboard form.
 */
test.describe('Bill payments', () => {
  let pm: PageManager;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'bills-ui',
    });

    pm = new PageManager(page);
    await pm.dashboard().waitForLoad();
  });

  test('should pay a bill from account balance', async () => {
    const bills = pm.billPayments();
    const description = `UI balance payment ${Date.now()}`;

    await bills.openPayBillModal();
    await bills.selectFirstCategory();
    await bills.selectFirstBiller();
    const minimumAmount = await bills.getSelectedBillerMinimumAmount();
    const amount = (minimumAmount ?? 0) + 5;

    await bills.fillAmount(String(amount));
    await bills.selectPaymentMethod('balance');
    await bills.fillDescription(description);
    await bills.submit();

    // Not asserted here: the exact resulting account balance. UI specs in
    // this suite share one persisted test user (helpers/credentials.ts) and
    // Playwright runs test files in parallel, so other specs' balance
    // mutations can interleave with this one — the same reason
    // money-transfer.spec.ts only asserts on the success indicator rather
    // than an exact final balance. The payment-history row is a stable,
    // test-scoped signal instead (matched by its unique description).
    await bills.waitForMessage(/bill payment successful/i);
    await bills.waitForPaymentRow(description);
  });

  test('should pay a bill from a funded virtual card', async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');
    const bills = pm.billPayments();
    const cards = pm.virtualCards();

    // Create the card through the UI (documents the real user flow), then
    // fund it through the API using the already-known mass-assignment
    // vulnerability on update-limit (see tests/api/virtual-cards.spec.ts) —
    // there is no legitimate way to add funds to a fresh card otherwise.
    await cards.createCard('500', 'standard');
    await cards.waitForMessage(/virtual card created successfully/i);
    const cardId = await cards.waitForCardWithLimit('500');
    expect(cardId).not.toBeNull();

    const token = loadStoredToken('user') || process.env.API_AUTH_TOKEN;
    if (!token) throw new Error('No auth token available to fund the virtual card via the API');
    const api = await request.newContext({ baseURL: baseURL.toString() });
    await updateCardLimit(api, token, cardId!, { current_balance: 200 });

    // The shared test user accumulates cards across other UI runs, so the
    // "Select Card" dropdown can contain several non-frozen options — look up
    // this specific card's last 4 digits rather than matching the first
    // "ending in ####" option, which could be a stale, unfunded card.
    const listRes = await listVirtualCards(api, token);
    const listBody = await listRes.json().catch(() => null);
    const fundedCard = (listBody?.cards || []).find((c: { id: number }) => c.id === cardId);
    await api.dispose();
    expect(fundedCard).toBeTruthy();
    const last4 = String(fundedCard.card_number).slice(-4);

    // Reload so loadVirtualCardsForPayment() picks up the funded, non-frozen card.
    await page.reload();
    await pm.dashboard().waitForLoad();

    await bills.openPayBillModal();
    await bills.selectFirstCategory();
    await bills.selectFirstBiller();
    const minimumAmount = await bills.getSelectedBillerMinimumAmount();
    const amount = (minimumAmount ?? 0) + 5;

    await bills.fillAmount(String(amount));
    await bills.selectPaymentMethod('virtual_card');
    await bills.selectCard(new RegExp(`ending in ${last4}`, 'i'));
    await bills.submit();

    await bills.waitForMessage(/bill payment successful/i);
  });

  test('should keep a payment visible in history after the dashboard is reloaded', async ({ page }) => {
    const bills = pm.billPayments();
    const description = `UI reload persistence check ${Date.now()}`;

    await bills.openPayBillModal();
    await bills.selectFirstCategory();
    await bills.selectFirstBiller();
    const minimumAmount = await bills.getSelectedBillerMinimumAmount();
    const amount = (minimumAmount ?? 0) + 5;

    await bills.fillAmount(String(amount));
    await bills.selectPaymentMethod('balance');
    await bills.fillDescription(description);
    await bills.submit();
    await bills.waitForMessage(/bill payment successful/i);

    await page.reload();
    await pm.dashboard().waitForLoad();

    await bills.waitForPaymentRow(description);
  });

  test('should accept a negative amount (no client or server-side validation)', async () => {
    const bills = pm.billPayments();

    await bills.openPayBillModal();
    await bills.selectFirstCategory();
    await bills.selectFirstBiller();

    await bills.fillAmount('-50');
    await bills.selectPaymentMethod('balance');
    await bills.submit();

    await bills.waitForMessage(/bill payment successful/i);
  });
});
