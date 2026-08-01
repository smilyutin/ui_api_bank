import { Locator } from '@playwright/test';

// Flexible locator selection: try multiple strategies in order, return the first match.
// Used when selectors may vary (test-id, label, name attribute, etc.) or when locating
// page elements that use different selector strategies across test environments.
export class LocatorFactory {
	// Find the first locator that matches an element on the page.
	// Throws if none of the candidates match.
	static async find(...candidates: Locator[]): Promise<Locator> {
		for (const candidate of candidates) {
			if (await candidate.count()) {
				return candidate;
			}
		}
		throw new Error('LocatorFactory: no candidate locator matched an element');
	}
}
