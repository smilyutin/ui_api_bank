import { chromium } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:5001';

export default async () => {
	const browser = await chromium.launch();

	// Setup admin session - reused across all admin tests
	try {
		const page = await browser.newPage();
		await page.goto(`${baseURL}/login`);

		const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
		const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

		await page.getByRole('textbox', { name: 'Username' }).fill(adminUsername);
		await page.getByRole('textbox', { name: 'Password' }).fill(adminPassword);
		await page.getByRole('button', { name: 'Login' }).click();

		await page.waitForURL(/\/dashboard/i, { timeout: 15000 }).catch(() => {
			console.warn('Admin login navigation timeout, saving state anyway');
		});
		await page.context().storageState({ path: 'storage/admin-auth.json' });
		await page.close();
	} catch (e) {
		console.error('Failed to setup admin session:', e);
		throw e;
	}

	await browser.close();
};
