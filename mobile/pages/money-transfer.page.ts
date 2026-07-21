import { $, browser } from '@wdio/globals';
import { MobileHelperBase } from './mobile-helper-base';

// Ported from pages/money-transfer.page.ts (same DOM/locators).
export class MoneyTransferPage extends MobileHelperBase {
	async fillRecipient(account: string) {
		await $('#to_account').setValue(account);
	}

	async fillAmount(amount: string) {
		await $('#amount').setValue(amount);
	}

	async fillDescription(text: string) {
		await $('#description').setValue(text);
	}

	async submit() {
		await $('#transferForm button[type="submit"]').click();
	}

	// static/dashboard.js's handleTransfer() writes app.py's fixed
	// 'Transfer Completed' success message into #message on a successful POST
	// /transfer, so waiting for that exact text is a real success signal.
	async waitForSuccess(timeout = 5000): Promise<boolean> {
		try {
			await browser.waitUntil(
				async () => (await $('#message').getText()).includes('Transfer Completed'),
				{ timeout, timeoutMsg: 'Expected #message to show "Transfer Completed"' }
			);
			return true;
		} catch {
			return false;
		}
	}
}
