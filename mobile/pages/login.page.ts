import { browser, $ } from '@wdio/globals';
import { MobileHelperBase } from './mobile-helper-base';

// Locators mirror pages/login.page.ts in the Playwright suite (same DOM).
export class LoginPage extends MobileHelperBase {
	async goto(baseURL: string) {
		await browser.url(new URL('/login', baseURL).toString());
	}

	async fillEmail(email: string) {
		await $('input[name="username"]').setValue(email);
	}

	async fillPassword(password: string) {
		await $('input[name="password"]').setValue(password);
	}

	async submit() {
		await $('#loginForm button[type="submit"]').click();
	}
}
