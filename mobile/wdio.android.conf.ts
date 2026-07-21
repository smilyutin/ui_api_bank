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
				args: {
					address: '127.0.0.1',
					port: 4723,
					// chromedriver_autodownload is an Appium 2.x "insecure feature":
					// setting the appium:chromedriverAutodownload capability alone
					// is not enough, the server must also allow it or session
					// creation fails with "No Chromedriver found".
					allowInsecure: 'chromedriver_autodownload',
				},
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
			// The emulator image ships an old system Chrome (e.g. 109.x) with no
			// matching Chromedriver bundled in Appium; let Appium fetch one that
			// matches instead of failing session creation.
			'appium:chromedriverAutodownload': true,
		},
	],
};
