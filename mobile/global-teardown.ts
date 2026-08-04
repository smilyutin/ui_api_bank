import { request as apiRequest } from '@playwright/test';

// Global teardown (after all mobile tests): Delete all test users, ensuring a clean slate.
// This mirrors the Playwright suite's global-teardown.ts, cleaning up database state
// after Appium tests complete. Runs via: npx wdio run ... --mochaOpts.grep=""

const baseURL = process.env.BASE_URL ?? 'http://localhost:5001';

export default async () => {
	console.log('Starting mobile global teardown...');

	try {
		const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
		const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123';

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
				if (adminToken) {
					console.log('✓ Admin authenticated for mobile test cleanup');
				} else {
					console.warn('No token in login response');
				}
			} else {
				const text = await authRes.text();
				console.warn(`Login failed with status ${authRes.status()}: ${text.substring(0, 200)}`);
			}
			await api.dispose();
		} catch (e) {
			console.warn('Failed to login for mobile cleanup:', e);
		}

		if (!adminToken) {
			console.warn('Could not obtain admin token for cleanup, skipping test user deletion');
			return;
		}

		try {
			const api = await apiRequest.newContext({ baseURL });
			const usersRes = await api.get('/debug/users');

			if (usersRes.ok()) {
				const data = await usersRes.json();
				const users = data.users || [];
				const testUserPrefixes = [
					'mobile',
					'e2e-',
					'global-setup-',
					'loan-approval-',
					'admin-panel-',
				];

				let deletedCount = 0;
				for (const user of users) {
					const username = user.username || '';

					if (username === 'admin' || username === adminUsername) {
						continue;
					}

					const isTestUser = testUserPrefixes.some((prefix) => username.includes(prefix));
					if (isTestUser) {
						try {
							const deleteRes = await api.post(`/admin/delete_account/${user.id}`, {
								headers: { Authorization: `Bearer ${adminToken}` },
							});

							if (deleteRes.ok()) {
								console.log(`✓ Deleted mobile test user: ${username}`);
								deletedCount++;
							}
						} catch (e) {
							console.warn(`Failed to delete user ${username}:`, e);
						}
					}
				}

				if (deletedCount > 0) {
					console.log(`✓ Mobile cleanup complete: Deleted ${deletedCount} test users`);
				} else {
					console.log('✓ No mobile test users to delete');
				}
			}
			await api.dispose();
		} catch (e) {
			console.warn('Failed to cleanup mobile test data:', e);
		}
	} catch (e) {
		console.error('Mobile global teardown error:', e);
	}

	console.log('✓ Mobile global teardown finished');
};
