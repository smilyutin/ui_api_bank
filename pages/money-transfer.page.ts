import { HelperBase } from './helper-base.page';

export class MoneyTransferPage extends HelperBase {
	async fillRecipient(account: string) {
		await this.page.locator('#to_account').fill(account);
	}

	async fillAmount(amount: string) {
		await this.page.locator('#amount').fill(amount);
	}

	async fillDescription(text: string) {
		await this.page.locator('#description').fill(text);
	}

	async submit() {
		await this.page.locator('#transferForm button[type="submit"]').click();
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
