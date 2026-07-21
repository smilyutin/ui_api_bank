import { config as baseConfig } from './wdio.conf';

/**
 * Android Chrome via Appium's UiAutomator2 driver, against a booted emulator
 * or connected device (ANDROID_HOME + a running AVD, e.g. `emulator -avd Pixel_6_API_33`).
 */
export const config: WebdriverIO.Config = {
	...baseConfig,
	port: 4723,
	services: [
		[
			'appium',
			// Bind explicitly to the IPv4 loopback: 'localhost' can resolve to
			// ::1 first (this machine does), which binds the Appium server to
			// IPv6 only while WebdriverIO's client connects on 127.0.0.1,
			// producing an immediate ECONNREFUSED.
			{
				args: { address: '127.0.0.1', port: 4723 },
			},
		],
	],
	capabilities: [
		{
			platformName: 'Android',
			'appium:automationName': 'UiAutomator2',
			'appium:deviceName': 'Android Emulator',
			browserName: 'Chrome',
			'appium:newCommandTimeout': 240,
		},
	],
};
