import { config as baseConfig } from './wdio.conf';

/**
 * iOS Safari via Appium's XCUITest driver. macOS-only: requires Xcode + a
 * booted iOS Simulator (e.g. `xcrun simctl boot "iPhone 15"`).
 */
export const config: WebdriverIO.Config = {
	...baseConfig,
	port: 4723,
	services: [
		[
			'appium',
			// See wdio.android.conf.ts: bind explicitly to the IPv4 loopback
			// rather than 'localhost', which can resolve to ::1 first and
			// leave the WebdriverIO client's 127.0.0.1 connection refused.
			{
				args: { address: '127.0.0.1', port: 4723 },
			},
		],
	],
	capabilities: [
		{
			platformName: 'iOS',
			'appium:automationName': 'XCUITest',
			'appium:deviceName': 'iPhone 15',
			'appium:platformVersion': process.env.IOS_PLATFORM_VERSION ?? '17.5',
			browserName: 'Safari',
			'appium:newCommandTimeout': 240,
		},
	],
};
