import { browser, expect } from '@wdio/globals';
import { MobilePageManager } from '../pages/mobile-page-manager';
import { findOrCreateUser } from '../../helpers/credentials';

describe('Mobile login', () => {
	it('logs in via the real login form on a mobile browser engine', async () => {
		const baseURL = browser.options.baseUrl!;
		const pm = new MobilePageManager();
		const user = findOrCreateUser('mobile');
		const identifier = user.username || user.email!;

		await pm.login().goto(baseURL);
		await pm.login().fillEmail(identifier);
		await pm.login().fillPassword(user.password);
		await pm.login().submit();

		await pm.dashboard().waitForLoad();
		await expect(browser).toHaveUrl('/dashboard', { containing: true });
	});
});
