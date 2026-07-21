import { browser, expect } from '@wdio/globals';
import { MobilePageManager } from '../pages/mobile-page-manager';
import { ensureDashboardAuthenticated } from '../fixtures/mobile-auth';

describe('Mobile money transfer', () => {
	const baseURL = () => browser.options.baseUrl!;

	beforeEach(async () => {
		await ensureDashboardAuthenticated({ baseURL: baseURL() });
	});

	it('completes a transfer end-to-end on a mobile browser engine', async () => {
		const pm = new MobilePageManager();
		await pm.dashboard().waitForLoad();

		await browser.url(new URL('/transfer', baseURL()).toString());
		await pm.moneyTransfer().fillRecipient('1000000001');
		await pm.moneyTransfer().fillAmount('1');
		await pm.moneyTransfer().fillDescription('Appium mobile smoke test');
		await pm.moneyTransfer().submit();

		const succeeded = await pm.moneyTransfer().waitForSuccess();
		expect(succeeded).toBe(true);
	});
});
