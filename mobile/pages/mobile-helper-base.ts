import { browser } from '@wdio/globals';

/**
 * Analogous to pages/helper-base.page.ts in the Playwright suite: page
 * objects hold only locators/actions/verifications, no business assertions.
 * WebdriverIO exposes the session through the `browser` global, so unlike
 * Playwright's HelperBase there's no `page` instance to store.
 */
export class MobileHelperBase {
	async waitForNumberOfSeconds(timeInSeconds: number) {
		await browser.pause(timeInSeconds * 1000);
	}
}
