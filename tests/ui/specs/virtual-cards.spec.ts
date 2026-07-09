import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';

/**
 * Virtual Card Tests (UI)
 *
 * These tests verify that the dashboard's virtual card section lets an
 * authenticated user create, freeze/unfreeze, and update the limit on a
 * virtual card, and that the card list reflects each change.
 *
 * Test Strategy:
 * 1. Authenticate and load the dashboard.
 * 2. Create a card through the VirtualCardsPage POM and confirm it renders
 *    with the requested limit.
 * 3. Exercise freeze/unfreeze and limit-update round trips against that card.
 *
 * The details-modal case documents actual current behavior rather than
 * asserting a "should mask" expectation: `renderVirtualCards()` /
 * `showCardDetails()` (static/dashboard.js) render the full card_number and
 * cvv returned by `GET /api/virtual-cards` verbatim, with no masking. The
 * equivalent API-level finding is reported via SecurityReporter in
 * tests/api/virtual-cards.spec.ts; this UI test just confirms the same data
 * is visible through the dashboard.
 */
test.describe('Virtual cards', () => {
  let pm: PageManager;

  test.beforeEach(async ({ page, baseURL }) => {
    if (!baseURL) throw new Error('baseURL is not defined');

    await ensureDashboardAuthenticated(page, {
      baseURL: baseURL.toString(),
      role: 'user',
      fallbackUserPrefix: 'vcards-ui',
    });

    pm = new PageManager(page);
    await pm.dashboard().waitForLoad();
  });

  test('should create a virtual card and show it in the cards list', async () => {
    const cards = pm.virtualCards();
    const limit = '850';

    await cards.createCard(limit, 'premium');

    await cards.waitForMessage(/virtual card created successfully/i);
    const cardId = await cards.waitForCardWithLimit(limit);
    expect(cardId).not.toBeNull();

    await expect(cards.cardLocator(cardId!)).toContainText(/premium/i);
  });

  test('should freeze and unfreeze a virtual card', async () => {
    const cards = pm.virtualCards();
    const limit = '650';

    await cards.createCard(limit, 'standard');
    await cards.waitForMessage(/virtual card created successfully/i);
    const cardId = await cards.waitForCardWithLimit(limit);
    expect(cardId).not.toBeNull();

    await cards.verifyFrozenState(cardId!, false);
    await cards.toggleFreeze(cardId!);
    await cards.verifyFrozenState(cardId!, true);

    await cards.toggleFreeze(cardId!);
    await cards.verifyFrozenState(cardId!, false);
  });

  test('should update a card\'s limit', async () => {
    const cards = pm.virtualCards();
    const initialLimit = '500';
    const updatedLimit = '900';

    await cards.createCard(initialLimit, 'standard');
    await cards.waitForMessage(/virtual card created successfully/i);
    const cardId = await cards.waitForCardWithLimit(initialLimit);
    expect(cardId).not.toBeNull();

    await cards.openUpdateLimit(cardId!);
    await cards.submitUpdateLimit(updatedLimit);

    await cards.waitForMessage(/card limit updated successfully/i);
    await cards.waitForCardWithLimit(updatedLimit);
  });

  test('should show the full card number and CVV in the details modal (no masking)', async () => {
    const cards = pm.virtualCards();
    const limit = '750';

    await cards.createCard(limit, 'standard');
    await cards.waitForMessage(/virtual card created successfully/i);
    const cardId = await cards.waitForCardWithLimit(limit);
    expect(cardId).not.toBeNull();

    await cards.openDetails(cardId!);
    const detailsText = await cards.getDetailsModalText();

    expect(detailsText).toMatch(/\d{4}\s\d{4}\s\d{4}\s\d{4}/);
    expect(detailsText).toMatch(/CVV\s*\n?\d{3}/i);
  });
});
