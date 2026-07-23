import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

export class MoneyTransferPage extends HelperBase {
	// #amount/#description labels are duplicated by the always-in-DOM (just
	// hidden) bill-payment modal, so label-based lookups here are scoped to
	// #transferForm to avoid a strict-mode match against both forms.
	async fillRecipient(account: string) {
		const recipientInput = await LocatorFactory.find(
			this.page.getByTestId('to-account'),
			this.page.locator('#transferForm').getByLabel('Recipient Account Number'),
			this.page.locator('#to_account'),
		);
		await recipientInput.fill(account);
	}

	async fillAmount(amount: string) {
		const amountInput = await LocatorFactory.find(
			this.page.getByTestId('transfer-amount'),
			this.page.locator('#transferForm').getByLabel('Amount', { exact: true }),
			this.page.locator('#amount'),
		);
		await amountInput.fill(amount);
	}

	async fillDescription(text: string) {
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

	// static/dashboard.js's handleTransfer() writes app.py's fixed
	// 'Transfer Completed' success message into #message on a successful POST
	// /transfer, so waiting for that exact text is a real success signal
	// rather than a loose page-wide text match.
	async waitForSuccess(timeout = 5000): Promise<boolean> {
		try {
			await this.page.locator('#message', { hasText: 'Transfer Completed' }).waitFor({ state: 'visible', timeout });
			return true;
		} catch {
			return false;
		}
	}
}
