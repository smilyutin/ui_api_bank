import { request as apiRequest } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadAdminCredentials } from './helpers/credentials';
import { loginViaCredentials } from './helpers/auth';

// Global teardown (after all tests):
// Deletes test users created during the test run.
// Preserves the admin master account.

const baseURL = process.env.BASE_URL ?? 'http://localhost:5001';

export default async () => {
	try {
		// Authenticate as admin to call cleanup API
		const adminCreds = loadAdminCredentials();
		const adminToken = await loginViaCredentials(baseURL, adminCreds.identifier, adminCreds.password);
		console.log('✓ Admin authenticated for cleanup');

		// Get all users and delete test users
		const api = await apiRequest.newContext({ baseURL });
		const usersRes = await api.get('/debug/users');

		if (usersRes.ok()) {
			const data = (await usersRes.json()) as { users?: Array<{ id: string; username?: string }> };
			const users = data.users || [];
			const testUserPrefixes = ['e2e', 'UI', 'global-setup-', 'loan-approval-', 'admin-panel-', 'admin-delete-', 'admin-test-', 'admin-form-clear-', 'admin-msg-'];

			let deletedCount = 0;
			for (const user of users) {
				const username = user.username || '';

				// Skip admin account
				if (username === 'admin' || username === adminCreds.identifier) {
					continue;
				}

				// Delete if matches test user prefix
				const isTestUser = testUserPrefixes.some((prefix) => username.startsWith(prefix));
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

			console.log(`✓ Cleanup: deleted ${deletedCount} test user(s)`);
		}
		await api.dispose();
	} catch (e) {
		console.warn('Cleanup failed (continuing anyway):', e);
	}

	// Clean up temporary storageState files (user sessions)
	try {
		const tmpDir = '/tmp';
		const files = await fs.readdir(tmpDir);
		const authFiles = files.filter((f) => f.startsWith('auth-') && f.endsWith('.json'));
		for (const file of authFiles) {
			await fs.rm(path.join(tmpDir, file), { force: true });
		}
		if (authFiles.length > 0) {
			console.log(`✓ Cleaned up ${authFiles.length} temporary auth file(s)`);
		}
	} catch (e) {
		// Ignore if temp directory cleanup fails
	}
};
