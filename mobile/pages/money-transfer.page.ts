import { $, browser } from '@wdio/globals';
import { MobileHelperBase } from './mobile-helper-base';

// Ported from pages/money-transfer.page.ts (same DOM/locators).
export class MoneyTransferPage extends MobileHelperBase {
	async fillRecipient(account: string) {
		const input = $('#to_account');
		await input.waitForDisplayed({ timeout: 5000 });
		await input.setValue(account);
	}

	async fillAmount(amount: string) {
		const input = $('#amount');
		await input.waitForDisplayed({ timeout: 5000 });
		await input.setValue(amount);
	}

	async fillDescription(text: string) {
		const input = $('#description');
		await input.waitForDisplayed({ timeout: 5000 });
		await input.setValue(text);
	}

	async submit() {
		const form = $('#transferForm');
		const button = form.$('button[type="submit"]');
		await button.waitForDisplayed({ timeout: 5000 });
		await button.click();
	}

	// static/dashboard.js's handleTransfer() writes app.py's fixed
	// 'Transfer Completed' success message into #message on a successful POST
	// /transfer, so waiting for that exact text is a real success signal.
	// Chained locator: #message element filtered by text content.
	async waitForSuccess(timeout = 5000): Promise<boolean> {
		try {
			const message = $('#message');
			await message.waitForDisplayed({ timeout });
			await browser.waitUntil(
				async () => (await message.getText()).toLowerCase().includes('transfer completed'),
				{ timeout, timeoutMsg: 'Expected #message to show "Transfer Completed"' }
			);
			return true;
		} catch {
			return false;
		}
	}
}
