import { browser, $ } from '@wdio/globals';
import { MobileHelperBase } from './mobile-helper-base';

// Locators mirror pages/login.page.ts in the Playwright suite (same DOM).
export class LoginPage extends MobileHelperBase {
	async goto(baseURL: string) {
		await browser.url(new URL('/login', baseURL).toString());
	}

	async fillEmail(email: string) {
		const input = $('input[name="username"]');
		await input.waitForDisplayed({ timeout: 5000 });
		await input.setValue(email);
	}

	async fillPassword(password: string) {
		const input = $('input[name="password"]');
		await input.waitForDisplayed({ timeout: 5000 });
		await input.setValue(password);
	}

	async submit() {
		const form = $('#loginForm');
		const button = form.$('button[type="submit"]');
		await button.waitForDisplayed({ timeout: 5000 });
		await button.click();
	}
}
