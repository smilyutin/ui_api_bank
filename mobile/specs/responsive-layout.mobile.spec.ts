import { browser, expect, $ } from '@wdio/globals';
import { ensureDashboardAuthenticated } from '../fixtures/mobile-auth';

// Exercises the real @media breakpoints shipped in static/dashboard.css
// (768px) on an actual mobile browser engine rather than Playwright's
// Chromium-only viewport emulation.
describe('Mobile responsive layout', () => {
	const baseURL = () => browser.options.baseUrl!;

	beforeEach(async () => {
		await ensureDashboardAuthenticated({ baseURL: baseURL() });
	});

	it('renders the dashboard without horizontal overflow at phone width', async () => {
		const { width: viewportWidth } = await browser.getWindowSize();

		const scrollWidth = await browser.execute(() => document.documentElement.scrollWidth);
		expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);

		await expect($('#balance')).toBeDisplayed();
	});
});
