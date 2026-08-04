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
		const heading = $('h1');
		await heading.waitForDisplayed({ timeout: 7000 });
		const text = await heading.getText();
		if (!text.toLowerCase().includes('welcome')) {
			throw new Error('Expected h1 to contain "welcome"');
		}
		const balance = $('#balance');
		await balance.waitForDisplayed({ timeout: 7000 });

		// Verify data is actually loaded (not just DOM elements visible)
		// Wait for balance text to contain numeric value
		await browser.waitUntil(
			async () => {
				const text = await balance.getText();
				return /\d+/.test(text);
			},
			{ timeout: 7000, timeoutMsg: 'Balance data not loaded' }
		);
	}

	async getAccountBalance(): Promise<number | null> {
		const el = $('#balance');
		if (!(await el.isExisting())) return null;
		const text = await el.getText();
		const match = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
		return match ? parseFloat(match[1]) : null;
	}

	// static/dashboard.css's @media (max-width: 768px) rule slides .side-panel
	// (which wraps <nav>) off-screen via transform: translateX(-100%) and only
	// reveals .menu-toggle ("Menu", display: none by default) at that width -
	// toggleSidePanel() in dashboard.js adds the .active class that undoes the
	// transform. At phone width (this suite's whole point) the nav links are
	// off-canvas until that button is tapped, so getText() on them reads as
	// empty. .menu-toggle is a no-op (not displayed) above 768px.
	async openMenu() {
		const toggle = $('.menu-toggle');
		if (await toggle.isDisplayed()) {
			await toggle.click();
		}
	}

	async getNavigationTexts(): Promise<string[]> {
		const nav = $('nav');
		if (!(await nav.isExisting())) return [];
		await this.openMenu();
		const links = nav.$$('a, button, [role="link"]');
		const texts: string[] = [];
		for (const link of links) {
			if (!(await link.isDisplayed())) continue;
			const text = (await link.getText()).trim();
			if (text) texts.push(text);
		}
		return texts;
	}

	// templates/dashboard.html's side-panel Logout link is a static,
	// always-present `<a href="#" onclick="logout()">Logout</a>`.
	// Find nav link matching logout pattern (handles "Logout", "Log out", etc).
	async logout() {
		const navLinks = $$('nav a');
		for (const link of navLinks) {
			const text = (await link.getText()).toLowerCase();
			if (text.match(/log\s*out/)) {
				await link.click();
				return true;
			}
		}
		return false;
	}
}
