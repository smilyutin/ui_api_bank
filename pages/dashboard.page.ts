import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

export class DashboardPage extends HelperBase {
	async goto(baseURL: string) {
		await this.page.goto(new URL('/dashboard', baseURL).toString());
	}

	async isLoggedIn() {
			// Check URL is dashboard and elements exist
			const url = this.page.url();
			const onDashboard = url.toLowerCase().includes('/dashboard');
			if (!onDashboard) return false;

			// Look for typical dashboard elements
			const hasElements = await this.page.getByRole('heading', { name: /dashboard|welcome/i }).count() > 0 ||
				await this.page.getByRole('navigation').count() > 0 ||
				await this.page.getByRole('main').count() > 0;

			return hasElements;
	}

	async getWelcomeMessage() {
		const heading = this.page.getByRole('heading', { name: /dashboard|welcome/i });
		if (await heading.count()) return heading.innerText();
		return null;
	}

	async waitForLoad() {
		// The dashboard performs several fetches on load, so `networkidle` is
		// not a reliable readiness signal here. Wait for the actual UI instead.
		await expect(this.page).toHaveURL(/\/dashboard(?:[?#].*)?$/i, { timeout: 7000 });
		await expect(this.page.getByRole('heading', { name: /welcome back/i })).toBeVisible({ timeout: 7000 });
		await expect(this.page.locator('#balance')).toBeVisible({ timeout: 7000 });
	}

	async getNavigationItems() {
		const nav = this.page.getByRole('navigation');
		if (await nav.count()) {
			return nav.getByRole('link').all();
		}
		return [];
	}

	// Return visible navigation item texts in order
	async getNavigationTexts(): Promise<string[]> {
		const nav = this.page.getByRole('navigation');
		if (!(await nav.count())) return [];
		const links = nav.locator('a, button, [role="link"]');
		const count = await links.count();
		const out: string[] = [];
		for (let i = 0; i < count; i++) {
			const el = links.nth(i);
			const text = (await el.innerText()).trim();
			if (text) out.push(text);
		}
		return out;
	}

	// Return visible navigation items with hrefs (text, href) in order
	async getNavigationLinks(): Promise<Array<{ text: string; href: string }>> {
		const nav = this.page.getByRole('navigation');
		if (!(await nav.count())) return [];
		const anchors = nav.locator('a');
		const out: Array<{ text: string; href: string }> = [];
		const count = await anchors.count();
		for (let i = 0; i < count; i++) {
			const a = anchors.nth(i);
			const text = (await a.innerText()).trim();
			const href = (await a.getAttribute('href')) || '';
			out.push({ text, href });
		}
		return out;
	}

	async getAccountNumber(): Promise<string | null> {
		const el = this.page.locator('#account-number');
		if (await el.count()) return (await el.innerText()).trim();
		return null;
	}

	async hasEmptyTransactionsMessage(): Promise<boolean> {
		return (await this.page.getByText('No transactions found', { exact: true }).count()) > 0;
	}

	async getAccountBalance(): Promise<number | null> {
		const el = this.page.locator('#balance');
		if (!(await el.count())) return null;
		const text = await el.innerText();
		const match = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
		return match ? parseFloat(match[1]) : null;
	}

	// static/dashboard.js renders each transaction as a .transaction-item
	// inside #transaction-list (see fetchTransactions()).
	async getRecentTransactions() {
		return this.page.locator('#transaction-list .transaction-item').all();
	}

	async getTransactionData() {
		const transactions = await this.getRecentTransactions();
		const txnData = [];

		for (const txn of transactions) {
			const text = await txn.innerText();
			// Extract transaction details
			const amountMatch = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
			const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}/);

			txnData.push({
				text,
				amount: amountMatch ? parseFloat(amountMatch[1]) : null,
				date: dateMatch ? dateMatch[0] : null,
				element: txn
			});
		}

		return txnData;
	}

	async verifyBalanceAccuracy() {
		const displayedBalance = await this.getAccountBalance();
		const accountNumber = await this.getAccountNumber();

		if (!accountNumber) {
			return { displayed: displayedBalance, api: null, matches: null };
		}

		// /check_balance/<account_number> is a real, unauthenticated app route
		// (see app.py) that returns the account's balance independent of the
		// dashboard's own rendering, so it's a valid cross-check.
		const apiResponse = await this.page.request.get(`/check_balance/${accountNumber}`);
		if (!apiResponse.ok()) {
			return { displayed: displayedBalance, api: null, matches: null };
		}

		const apiData = await apiResponse.json();
		const apiBalance = typeof apiData.balance === 'number' ? apiData.balance : null;

		return {
			displayed: displayedBalance,
			api: apiBalance,
			matches: apiBalance !== null ? Math.abs((displayedBalance || 0) - apiBalance) < 0.01 : null
		};
	}

	// templates/dashboard.html's side-panel Logout link is a static,
	// always-present `<a href="#" onclick="logout()">Logout</a>`.
	async logout() {
		let logoutLink;
		try {
			logoutLink = await LocatorFactory.find(
				this.page.getByTestId('logout'),
				this.page.getByRole('link', { name: /log ?out/i }),
			);
		} catch {
			return false;
		}
		await logoutLink.click();
		return true;
	}
}
