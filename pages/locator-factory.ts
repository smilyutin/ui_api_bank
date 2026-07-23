import { Locator } from '@playwright/test';

export class LocatorFactory {
	static async find(...candidates: Locator[]): Promise<Locator> {
		for (const candidate of candidates) {
			if (await candidate.count()) {
				return candidate;
			}
		}
		throw new Error('LocatorFactory: no candidate locator matched an element');
	}
}
