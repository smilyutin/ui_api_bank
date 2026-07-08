import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';

export class BillPaymentsPage extends HelperBase {
	async openPayBillModal() {
		await this.page.getByRole('button', { name: 'Pay Bill' }).click();
		await expect(this.page.locator('#payBillModal')).toBeVisible();
	}

	async selectCategory(categoryName: string) {
		await this.page.locator('#billCategory').selectOption({ label: categoryName });
		// #biller is populated asynchronously by the category's onchange handler
		// and starts disabled, so wait for it to become usable before selecting.
		await expect(this.page.locator('#biller')).toBeEnabled({ timeout: 7000 });
	}

	async selectFirstCategory() {
		const firstOption = this.page.locator('#billCategory option:not([value=""])').first();
		const label = await firstOption.innerText();
		await this.selectCategory(label);
	}

	async selectBiller(billerName: string) {
		await this.page.locator('#biller').selectOption({ label: billerName });
	}

	async selectFirstBiller() {
		const firstOption = this.page.locator('#biller option:not([value=""])').first();
		const value = await firstOption.getAttribute('value');
		if (!value) throw new Error('No biller options available to select');
		await this.page.locator('#biller').selectOption(value);
	}

	async getSelectedBillerMinimumAmount(): Promise<number | null> {
		const value = await this.page.locator('#biller option:checked').getAttribute('data-min');
		return value ? parseFloat(value) : null;
	}

	async fillAmount(amount: string) {
		await this.page.locator('#bill_amount').fill(amount);
	}

	async selectPaymentMethod(method: 'balance' | 'virtual_card') {
		await this.page.locator('#payment_method').selectOption(method);
		if (method === 'virtual_card') {
			await expect(this.page.locator('#cardSelection')).toBeVisible();
		}
	}

	async selectCard(labelPattern: RegExp) {
		const select = this.page.locator('select[name="card_id"]');
		const option = select.locator('option').filter({ hasText: labelPattern }).first();
		const value = await option.getAttribute('value');
		if (!value) throw new Error(`No card option matched ${labelPattern}`);
		await select.selectOption(value);
	}

	async fillDescription(description: string) {
		await this.page.locator('#bill_description').fill(description);
	}

	async submit() {
		await this.page.locator('#payBillForm button[type="submit"]').click();
	}

	async waitForMessage(pattern: RegExp, timeout = 7000) {
		await expect(this.page.locator('#message')).toHaveText(pattern, { timeout });
	}

	paymentRow(hasText: string | RegExp) {
		return this.page.locator('#bill-payments-list .payment-item').filter({ hasText });
	}

	async waitForPaymentRow(hasText: string | RegExp, timeout = 7000) {
		const row = this.paymentRow(hasText);
		await expect(row.first()).toBeVisible({ timeout });
		return row.first();
	}
}
