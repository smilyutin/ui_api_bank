import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

export class BillPaymentsPage extends HelperBase {
	async openPayBillModal() {
		const payBillButton = await LocatorFactory.find(
			this.page.getByTestId('open-pay-bill'),
			this.page.getByRole('button', { name: 'Pay Bill' }),
		);
		await payBillButton.click();
		await expect(this.page.locator('#payBillModal')).toBeVisible();
	}

	async selectCategory(categoryName: string) {
		const categorySelect = await LocatorFactory.find(
			this.page.getByTestId('bill-category'),
			this.page.getByLabel('Bill Category'),
			this.page.locator('#billCategory'),
		);
		await categorySelect.selectOption({ label: categoryName });
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
		const billerSelect = await LocatorFactory.find(
			this.page.getByTestId('biller'),
			this.page.getByLabel('Biller'),
			this.page.locator('#biller'),
		);
		await billerSelect.selectOption({ label: billerName });
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

	// #bill_amount/#bill_description labels are duplicated by the always-in-DOM
	// (just hidden) transfer form, so label-based lookups here are scoped to
	// #payBillModal to avoid a strict-mode match against both forms.
	async fillAmount(amount: string) {
		const amountInput = await LocatorFactory.find(
			this.page.getByTestId('bill-amount'),
			this.page.locator('#payBillModal').getByLabel('Amount', { exact: true }),
			this.page.locator('#bill_amount'),
		);
		await amountInput.fill(amount);
	}

	async selectPaymentMethod(method: 'balance' | 'virtual_card') {
		const paymentMethodSelect = await LocatorFactory.find(
			this.page.getByTestId('payment-method'),
			this.page.getByLabel('Payment Method'),
			this.page.locator('#payment_method'),
		);
		await paymentMethodSelect.selectOption(method);
		if (method === 'virtual_card') {
			await expect(this.page.locator('#cardSelection')).toBeVisible();
		}
	}

	async selectCard(labelPattern: RegExp) {
		const select = await LocatorFactory.find(
			this.page.getByTestId('card-id'),
			this.page.getByLabel('Select Card'),
			this.page.locator('select[name="card_id"]'),
		);
		const option = select.locator('option').filter({ hasText: labelPattern }).first();
		const value = await option.getAttribute('value');
		if (!value) throw new Error(`No card option matched ${labelPattern}`);
		await select.selectOption(value);
	}

	async fillDescription(description: string) {
		const descriptionInput = await LocatorFactory.find(
			this.page.getByTestId('bill-description'),
			this.page.locator('#payBillModal').getByLabel(/description/i),
			this.page.locator('#bill_description'),
		);
		await descriptionInput.fill(description);
	}

	async submit() {
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('bill-submit'),
			this.page.getByRole('button', { name: 'Pay Now' }),
			this.page.locator('#payBillForm button[type="submit"]'),
		);
		await submitButton.click();
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
