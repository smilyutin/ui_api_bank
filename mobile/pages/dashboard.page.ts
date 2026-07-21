import { browser, $ } from '@wdio/globals';
import { MobileHelperBase } from './mobile-helper-base';

// Subset of pages/dashboard.page.ts's coverage, ported to WebdriverIO.
// The dashboard performs several fetches on load, so poll for the actual
// UI (heading + balance) rather than any network-idle-style signal.
export class DashboardPage extends MobileHelperBase {
	async goto(baseURL: string) {
		await browser.url(new URL('/dashboard', baseURL).toString());
	}

	async waitForLoad() {
		await browser.waitUntil(
			async () => (await browser.getUrl()).toLowerCase().includes('/dashboard'),
			{ timeout: 7000, timeoutMsg: 'Expected to land on /dashboard' }
		);
		await $('h1*=Welcome back').waitForDisplayed({ timeout: 7000 });
		await $('#balance').waitForDisplayed({ timeout: 7000 });
	}

	async getAccountBalance(): Promise<number | null> {
		const el = $('#balance');
		if (!(await el.isExisting())) return null;
		const text = await el.getText();
		const match = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
		return match ? parseFloat(match[1]) : null;
	}

	async getNavigationTexts(): Promise<string[]> {
		const nav = $('nav');
		if (!(await nav.isExisting())) return [];
		const links = await nav.$$('a, button, [role="link"]');
		const texts: string[] = [];
		for (const link of links) {
			const text = (await link.getText()).trim();
			if (text) texts.push(text);
		}
		return texts;
	}

	// templates/dashboard.html's side-panel Logout link is a static,
	// always-present `<a href="#" onclick="logout()">Logout</a>`.
	async logout() {
		const logoutLink = $('a*=Logout');
		if (!(await logoutLink.isExisting())) return false;
		await logoutLink.click();
		return true;
	}
}
