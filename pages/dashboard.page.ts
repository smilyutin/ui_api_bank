import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

// User dashboard: account balance, transactions, navigation, and logout.
// Provides both UI assertions and API cross-checks for data accuracy.
export class DashboardPage extends HelperBase {
	async goto(baseURL: string) {
		await this.page.goto(new URL('/dashboard', baseURL).toString());
	}

	async isLoggedIn() {
		// Check both URL and presence of dashboard-like elements to verify logged-in state.
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
		// Wait for dashboard readiness. The app performs multiple async fetches on load,
		// so networkidle is unreliable. Poll the actual UI elements instead (heading + balance).
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

	// Collect visible navigation item texts (links, buttons) in document order.
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

	// Collect visible navigation links with text labels and href attributes.
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

	async clickNavigationLink(selector: string) {
		const menuToggle = this.page.locator('.menu-toggle');
		if (await menuToggle.isVisible()) {
			await menuToggle.click();
			await this.page.waitForTimeout(100);
		}
		const link = this.page.locator(selector);
		await link.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
		await this.page.waitForTimeout(300);
		await link.click();
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
		// Extract numeric balance from #balance element, removing currency symbols.
		const el = this.page.locator('#balance');
		if (!(await el.count())) return null;
		const text = await el.innerText();
		const match = text.match(/[$€£]?\s*(\d+(\.\d{2})?)/);
		return match ? parseFloat(match[1]) : null;
	}

	// Fetch transaction items rendered by static/dashboard.js into #transaction-list.
	async getRecentTransactions() {
		return this.page.locator('#transaction-list .transaction-item').all();
	}

	async getTransactionData() {
		// Parse transaction elements: extract amount and date using regex patterns.
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
		// Cross-check UI balance against /check_balance API to detect render bugs.
		// /check_balance returns the canonical balance independent of UI rendering.
		const displayedBalance = await this.getAccountBalance();
		const accountNumber = await this.getAccountNumber();

		if (!accountNumber) {
			return { displayed: displayedBalance, api: null, matches: null };
		}

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

	// Click logout link using flexible locators.
	// The side-panel logout is a static <a> tag triggered via onclick="logout()".
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
		// On mobile, the side panel is off-screen by default.
		// Ensure it's open by clicking the menu toggle if visible.
		const menuToggle = this.page.locator('.menu-toggle');
		if (await menuToggle.isVisible()) {
			await menuToggle.click();
			await this.page.waitForTimeout(100);
		}
		// Scroll the logout link into view within the side panel (in case it's below the fold).
		await logoutLink.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
		await this.page.waitForTimeout(300);
		await logoutLink.click();
		return true;
	}
}
