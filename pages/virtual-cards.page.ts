import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';

export class VirtualCardsPage extends HelperBase {
	async openCreateCardModal() {
		await this.page.getByRole('button', { name: 'Create New Card' }).click();
	}

	async createCard(limit: string, cardType?: 'standard' | 'premium') {
		await this.openCreateCardModal();
		await this.page.locator('#card_limit').fill(limit);
		if (cardType) {
			await this.page.locator('#card_type').selectOption(cardType);
		}
		await this.page.locator('#createCardForm button[type="submit"]').click();
	}

	async waitForMessage(pattern: RegExp, timeout = 7000) {
		await expect(this.page.locator('#message')).toHaveText(pattern, { timeout });
	}

	cardLocator(cardId: number) {
		return this.page.locator(`#card-${cardId}`);
	}

	async waitForCardWithLimit(limit: string, timeout = 7000) {
		const card = this.page.locator('.virtual-card').filter({ hasText: `Limit: $${limit}` });
		await expect(card.first()).toBeVisible({ timeout });
		const idAttr = await card.first().getAttribute('id');
		return idAttr ? parseInt(idAttr.replace('card-', ''), 10) : null;
	}

	async toggleFreeze(cardId: number) {
		await this.cardLocator(cardId).getByRole('button', { name: /^(Freeze|Unfreeze)$/ }).click();
	}

	async verifyFrozenState(cardId: number, frozen: boolean, timeout = 7000) {
		const label = frozen ? 'Unfreeze' : 'Freeze';
		await expect(this.cardLocator(cardId).getByRole('button', { name: label, exact: true })).toBeVisible({ timeout });
	}

	async openDetails(cardId: number) {
		await this.cardLocator(cardId).getByRole('button', { name: 'Details' }).click();
		await expect(this.page.locator('#cardDetailsModal')).toBeVisible();
	}

	async getDetailsModalText() {
		return this.page.locator('#cardDetailsContent').innerText();
	}

	async closeDetailsModal() {
		await this.page.locator('#cardDetailsModal .modal-close').click();
	}

	async openUpdateLimit(cardId: number) {
		await this.cardLocator(cardId).getByRole('button', { name: 'Update Limit' }).click();
		await expect(this.page.locator('#updateCardForm')).toBeVisible();
	}

	async submitUpdateLimit(newLimit: string) {
		await this.page.locator('#card_limit_update').fill(newLimit);
		await this.page.locator('#updateCardForm button[type="submit"]').click();
	}
}
