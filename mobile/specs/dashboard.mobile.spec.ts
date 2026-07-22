import { browser, expect } from '@wdio/globals';
import { MobilePageManager } from '../pages/mobile-page-manager';
import { ensureDashboardAuthenticated } from '../fixtures/mobile-auth';

describe('Mobile dashboard', () => {
	const baseURL = () => browser.options.baseUrl!;

	beforeEach(async () => {
		await ensureDashboardAuthenticated({ baseURL: baseURL() });
	});

	it('loads the balance and navigation on a mobile browser engine', async () => {
		const pm = new MobilePageManager();
		await pm.dashboard().waitForLoad();

		const balance = await pm.dashboard().getAccountBalance();
		expect(balance).not.toBeNull();

		const navTexts = await pm.dashboard().getNavigationTexts();
		expect(navTexts.length).toBeGreaterThan(0);
	});
});
