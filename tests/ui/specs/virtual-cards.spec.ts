import { test, expect } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { ensureDashboardAuthenticated } from '../../../helpers/auth-bootstrap';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

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
    setupAssertionLogging('should create a virtual card and show it in the cards list');
    const cards = pm.virtualCards();
    const limit = '850';

    const cardId = await test.step('Create a virtual card', async () => {
      await cards.createCard(limit, 'premium');
      await cards.waitForMessage(/virtual card created successfully/i);
      const cardId = await cards.waitForCardWithLimit(limit);
      loggedExpect(cardId, 'cardId').not.toBeNull();
      return cardId;
    });

    await test.step('Verify it shows in the cards list with the right type', async () => {
      await expect(cards.cardLocator(cardId!)).toContainText(/premium/i);
      endAssertionLogging('passed');
    });
  });

  test('should freeze and unfreeze a virtual card', async () => {
    setupAssertionLogging('should freeze and unfreeze a virtual card');
    const cards = pm.virtualCards();
    const limit = '650';

    const cardId = await test.step('Create a virtual card', async () => {
      await cards.createCard(limit, 'standard');
      await cards.waitForMessage(/virtual card created successfully/i);
      const cardId = await cards.waitForCardWithLimit(limit);
      loggedExpect(cardId, 'cardId').not.toBeNull();
      return cardId;
    });

    await test.step('Freeze the card and verify its state', async () => {
      await cards.verifyFrozenState(cardId!, false);
      await cards.toggleFreeze(cardId!);
      await cards.verifyFrozenState(cardId!, true);
    });

    await test.step('Unfreeze the card and verify its state', async () => {
      await cards.toggleFreeze(cardId!);
      await cards.verifyFrozenState(cardId!, false);
      endAssertionLogging('passed');
    });
  });

  test('should update a card\'s limit', async () => {
    setupAssertionLogging('should update a card\'s limit');
    const cards = pm.virtualCards();
    const initialLimit = '500';
    const updatedLimit = '900';

    const cardId = await test.step('Create a virtual card', async () => {
      await cards.createCard(initialLimit, 'standard');
      await cards.waitForMessage(/virtual card created successfully/i);
      const cardId = await cards.waitForCardWithLimit(initialLimit);
      loggedExpect(cardId, 'cardId').not.toBeNull();
      return cardId;
    });

    await test.step('Update the limit and verify it changed', async () => {
      await cards.openUpdateLimit(cardId!);
      await cards.submitUpdateLimit(updatedLimit);

      await cards.waitForMessage(/card limit updated successfully/i);
      await cards.waitForCardWithLimit(updatedLimit);
      endAssertionLogging('passed');
    });
  });

  test('should show the full card number and CVV in the details modal (no masking)', async () => {
    setupAssertionLogging('should show the full card number and CVV in the details modal (no masking)');
    const cards = pm.virtualCards();
    const limit = '750';

    const cardId = await test.step('Create a virtual card', async () => {
      await cards.createCard(limit, 'standard');
      await cards.waitForMessage(/virtual card created successfully/i);
      const cardId = await cards.waitForCardWithLimit(limit);
      loggedExpect(cardId, 'cardId').not.toBeNull();
      return cardId;
    });

    await test.step('Open the details modal and verify no masking', async () => {
      await cards.openDetails(cardId!);
      const detailsText = await cards.getDetailsModalText();

      loggedExpect(detailsText, 'detailsText card number').toMatch(/\d{4}\s\d{4}\s\d{4}\s\d{4}/);
      loggedExpect(detailsText, 'detailsText CVV').toMatch(/CVV\s*\n?\d{3}/i);
      endAssertionLogging('passed');
    });
  });
});
