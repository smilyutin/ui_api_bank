import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

// Money transfer form: fill recipient, amount, description, and submit.
// Uses form-scoped locators to avoid clashes with the bill-payment modal.
export class MoneyTransferPage extends HelperBase {
	// #amount/#description labels are duplicated by the always-in-DOM (just
	// hidden) bill-payment modal, so label-based lookups here are scoped to
	// #transferForm to avoid a strict-mode match against both forms.
	async fillRecipient(account: string) {
		// Fill recipient account number. Form-scoped locators prevent
		// matching the hidden bill-payment modal form.
		const recipientInput = await LocatorFactory.find(
			this.page.getByTestId('to-account'),
			this.page.locator('#transferForm').getByLabel('Recipient Account Number'),
			this.page.locator('#to_account'),
		);
		await recipientInput.fill(account);
	}

	async fillAmount(amount: string) {
		// Fill transfer amount.
		const amountInput = await LocatorFactory.find(
			this.page.getByTestId('transfer-amount'),
			this.page.locator('#transferForm').getByLabel('Amount', { exact: true }),
			this.page.locator('#amount'),
		);
		await amountInput.fill(amount);
	}

	async fillDescription(text: string) {
		// Fill optional transfer description.
		const descriptionInput = await LocatorFactory.find(
			this.page.getByTestId('transfer-description'),
			this.page.locator('#transferForm').getByLabel(/description/i),
			this.page.locator('#description'),
		);
		await descriptionInput.fill(text);
	}

	async submit() {
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('transfer-submit'),
			this.page.getByRole('button', { name: 'Send Money' }),
			this.page.locator('#transferForm button[type="submit"]'),
		);
		await submitButton.click();
	}

	async waitForSuccess(timeout = 5000): Promise<boolean> {
		// Wait for exact 'Transfer Completed' message in #message (app.py's fixed success text).
		// This is a reliable success signal since the text only appears on successful POST /transfer.
		try {
			await this.page.locator('#message', { hasText: 'Transfer Completed' }).waitFor({ state: 'visible', timeout });
			return true;
		} catch {
			return false;
		}
	}
}
