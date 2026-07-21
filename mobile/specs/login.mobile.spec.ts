import { browser, expect } from '@wdio/globals';
import { MobilePageManager } from '../pages/mobile-page-manager';
import { findOrCreateUser } from '../../helpers/credentials';
import { registerUser } from '../fixtures/mobile-auth';

describe('Mobile login', () => {
	it('logs in via the real login form on a mobile browser engine', async () => {
		const baseURL = browser.options.baseUrl!;
		const pm = new MobilePageManager();
		const user = findOrCreateUser('mobile');
		const identifier = user.username || user.email!;

		// findOrCreateUser only fabricates credentials locally; register them
		// for real, since this suite doesn't run after a Playwright pass that
		// would otherwise have created the account (see mobile-auth.ts).
		await registerUser(baseURL.replace('10.0.2.2', 'localhost'), user);

		await pm.login().goto(baseURL);
		await pm.login().fillEmail(identifier);
		await pm.login().fillPassword(user.password);
		await pm.login().submit();

		await pm.dashboard().waitForLoad();
		await expect(browser).toHaveUrl('/dashboard', { containing: true });
	});
});
