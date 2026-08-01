import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

// Virtual card management: create cards, freeze/unfreeze, update limits, view details.
// Handles modal interactions and form-scoped locators to avoid label clashes.
export class VirtualCardsPage extends HelperBase {
	async openCreateCardModal() {
		const createCardButton = await LocatorFactory.find(
			this.page.getByTestId('open-create-card'),
			this.page.getByRole('button', { name: 'Create New Card' }),
		);
		await createCardButton.click();
	}

	// Create a virtual card with optional type selection.
	// Form-scoped locators prevent matching #card_limit_update from the update-limit modal.
	async createCard(limit: string, cardType?: 'standard' | 'premium') {
		await this.openCreateCardModal();
		const createForm = this.page.locator('#createCardForm');
		const limitInput = await LocatorFactory.find(
			this.page.getByTestId('card-limit'),
			createForm.getByLabel('Card Limit'),
			this.page.locator('#card_limit'),
		);
		await limitInput.fill(limit);
		if (cardType) {
			const typeSelect = await LocatorFactory.find(
				this.page.getByTestId('card-type'),
				createForm.getByLabel('Card Type'),
				this.page.locator('#card_type'),
			);
			await typeSelect.selectOption(cardType);
		}
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('create-card-submit'),
			createForm.getByRole('button', { name: 'Create Card' }),
			this.page.locator('#createCardForm button[type="submit"]'),
		);
		await submitButton.click();
	}

	async waitForMessage(pattern: RegExp, timeout = 7000) {
		await expect(this.page.locator('#message')).toHaveText(pattern, { timeout });
	}

	// Locate a card element by ID.
	cardLocator(cardId: number) {
		return this.page.locator(`#card-${cardId}`);
	}

	// Wait for a newly created card to appear in the card list and return its ID.
	async waitForCardWithLimit(limit: string, timeout = 7000) {
		const card = this.page.locator('.virtual-card').filter({ hasText: `Limit: $${limit}` });
		await expect(card.first()).toBeVisible({ timeout });
		const idAttr = await card.first().getAttribute('id');
		return idAttr ? parseInt(idAttr.replace('card-', ''), 10) : null;
	}

	// Toggle card freeze status.
	async toggleFreeze(cardId: number) {
		await this.cardLocator(cardId).getByRole('button', { name: /^(Freeze|Unfreeze)$/ }).click();
	}

	// Verify card is in the expected freeze state (frozen or unfrozen).
	async verifyFrozenState(cardId: number, frozen: boolean, timeout = 7000) {
		const label = frozen ? 'Unfreeze' : 'Freeze';
		await expect(this.cardLocator(cardId).getByRole('button', { name: label, exact: true })).toBeVisible({ timeout });
	}

	// Open the card details modal for a given card.
	async openDetails(cardId: number) {
		await this.cardLocator(cardId).getByRole('button', { name: 'Details' }).click();
		await expect(this.page.locator('#cardDetailsModal')).toBeVisible();
	}

	// Extract text content from the card details modal.
	async getDetailsModalText() {
		return this.page.locator('#cardDetailsContent').innerText();
	}

	// Close the card details modal.
	async closeDetailsModal() {
		await this.page.locator('#cardDetailsModal .modal-close').click();
	}

	// Open the update limit modal for a card.
	async openUpdateLimit(cardId: number) {
		await this.cardLocator(cardId).getByRole('button', { name: 'Update Limit' }).click();
		await expect(this.page.locator('#updateCardForm')).toBeVisible();
	}

	// Submit a new card limit in the update limit modal.
	async submitUpdateLimit(newLimit: string) {
		const updateForm = this.page.locator('#updateCardForm');
		const limitInput = await LocatorFactory.find(
			this.page.getByTestId('card-limit-update'),
			updateForm.getByLabel('Card Limit'),
			this.page.locator('#card_limit_update'),
		);
		await limitInput.fill(newLimit);
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('update-limit-submit'),
			updateForm.getByRole('button', { name: 'Update Limit', exact: true }),
			this.page.locator('#updateCardForm button[type="submit"]'),
		);
		await submitButton.click();
	}
}
