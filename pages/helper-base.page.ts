import { Page } from '@playwright/test';

// Base class for all page objects. Provides shared page instance and utility methods.
export class HelperBase {
	readonly page: Page;

	constructor(page: Page) {
		this.page = page;
	}

	// Wait for a specific duration in seconds. Use sparingly—prefer waitFor() conditions.
	async waitForNumberOfSeconds(timeInSeconds: number) {
		await this.page.waitForTimeout(timeInSeconds * 1000);
	}
}
