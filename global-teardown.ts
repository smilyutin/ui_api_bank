import { chromium, request as apiRequest } from '@playwright/test';
import { rm } from 'fs/promises';
import { resolve } from 'path';

// Global teardown (after all tests): Delete all test users, clean storage/.
// Preserves the admin master account. Ensures a clean slate for the next run.
// See CLAUDE.md and ADMIN_PANEL_TESTS.md for details.

const baseURL = process.env.BASE_URL ?? 'http://localhost:5001';

export default async () => {
	const browser = await chromium.launch();

	// Authenticate as admin to call the cleanup API
	try {
		const page = await browser.newPage();
		const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
		const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

		// Authenticate to get admin token
		let adminToken: string | null = null;

		try {
			const api = await apiRequest.newContext({ baseURL });
			const authRes = await api.post('/login', {
				data: { username: adminUsername, password: adminPassword },
				headers: { 'Content-Type': 'application/json' },
			});

			if (authRes.ok()) {
				const authJson = await authRes.json();
				adminToken = authJson.token;
				if (!adminToken) {
					console.warn('No token in login response');
				} else {
					console.log('✓ Admin authenticated for cleanup');
				}
			} else {
				const text = await authRes.text();
				console.warn(`Login failed with status ${authRes.status()}: ${text.substring(0, 200)}`);
			}
			await api.dispose();
		} catch (e) {
			console.warn('Failed to login for cleanup:', e);
		}

		if (!adminToken) {
			console.warn('Could not obtain admin token for cleanup, skipping data deletion');
			await page.close();
			await browser.close();
			return;
		}

		// Get all users from debug endpoint and delete test users
		try {
			const api = await apiRequest.newContext({ baseURL });
			const usersRes = await api.get('/debug/users');

			if (usersRes.ok()) {
				const data = await usersRes.json();
				const users = data.users || [];
				const testUserPrefixes = [
					'e2e-',
					'global-setup-',
					'loan-approval-',
					'admin-panel-',
					'admin-delete-',
					'admin-test-',
					'admin-form-clear-',
					'admin-msg-',
				];

				let deletedCount = 0;
				for (const user of users) {
					const username = user.username || '';

					// Skip admin master account
					if (username === 'admin' || username === adminUsername) {
						continue;
					}

					// Delete test users only
					const isTestUser = testUserPrefixes.some((prefix) => username.includes(prefix));
					if (isTestUser) {
						try {
							const deleteRes = await api.post(`/admin/delete_account/${user.id}`, {
								headers: { Authorization: `Bearer ${adminToken}` },
							});

							if (deleteRes.ok()) {
								console.log(`✓ Deleted test user: ${username}`);
								deletedCount++;
							}
						} catch (e) {
							console.warn(`Failed to delete user ${username}:`, e);
						}
					}
				}

				if (deletedCount > 0) {
					console.log(`✓ Cleanup complete: Deleted ${deletedCount} test users`);
				} else {
					console.log('✓ No test users to delete');
				}
			}
			await api.dispose();
		} catch (e) {
			console.warn('Failed to cleanup test data:', e);
		}

		await page.close();
	} catch (e) {
		console.error('Global teardown error:', e);
	}

	try {
		const storageDir = resolve(process.cwd(), 'storage');
		await rm(storageDir, { recursive: true, force: true });
		console.log('✓ Cleaned up storage/ (regenerated fresh on next run)');
	} catch (e) {
		console.warn('Could not clean storage directory:', e);
	}

	await browser.close();
};
