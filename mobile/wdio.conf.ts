/**
 * Shared base config for the Appium mobile-web suite. Platform-specific
 * configs (wdio.android.conf.ts, wdio.ios.conf.ts) import and extend this
 * with their own `capabilities`/`services` rather than duplicating it.
 */
export const config: Partial<WebdriverIO.Config> = {
	runner: 'local',
	specs: ['./specs/**/*.mobile.spec.ts'],
	maxInstances: 1,
	logLevel: 'info',
	baseUrl: process.env.BASE_URL ?? 'http://localhost:5001',
	waitforTimeout: 10000,
	connectionRetryTimeout: 120000,
	connectionRetryCount: 3,
	framework: 'mocha',
	mochaOpts: {
		ui: 'bdd',
		timeout: 60000,
	},
	reporters: [
		'spec',
		[
			'allure',
			{
				outputDir: 'allure-results',
				disableWebdriverCallStack: false,
			},
		],
	],
	beforeTest: async function() {
		try {
			await browser.clearLocalStorage();
		} catch (e) {
			console.debug('Failed to clear localStorage at test start:', e);
		}

		try {
			await browser.clearSessionStorage();
		} catch (e) {
			console.debug('Failed to clear sessionStorage at test start:', e);
		}

		try {
			await browser.deleteAllCookies();
		} catch (e) {
			console.debug('Failed to delete cookies at test start:', e);
		}
	},
	afterTest: async function() {
		try {
			await browser.clearLocalStorage();
		} catch (e) {
			console.warn('Failed to clear localStorage:', e);
		}

		try {
			await browser.clearSessionStorage();
		} catch (e) {
			console.warn('Failed to clear sessionStorage:', e);
		}

		try {
			await browser.deleteAllCookies();
		} catch (e) {
			console.warn('Failed to delete cookies:', e);
		}
	},
	onComplete: async () => {
		console.log('Running mobile global teardown...');
		try {
			const { default: mobileGlobalTeardown } = await import('./global-teardown');
			await mobileGlobalTeardown();
		} catch (e) {
			console.error('Failed to run mobile global teardown:', e);
		}
	},
};
