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
};
