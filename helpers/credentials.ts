/**
 * Test User and Credentials Management
 *
 * Simplified to handle only:
 * - Test user creation (dynamic, not persisted)
 * - Admin credential loading (from env)
 *
 * (Removed token storage - now ephemeral in storageState files)
 */

export type User = { username?: string; email?: string; password: string };

/**
 * Create a fresh test user with random username and email.
 * Not persisted to disk; exists only for this test run.
 *
 * Usage:
 *   const user = createRandomUser('e2e'); // e2e<random>@example.com
 */
export function createRandomUser(pref = 'e2e'): User {
	const random = Math.random().toString(36).substring(2, 10);
	return {
		username: `${pref}${random}`,
		email: `${pref}+${random}@example.com`,
		password: 'Password123!',
	};
}

/**
 * Load admin credentials from environment variables.
 *
 * Precedence:
 * 1. ADMIN_USERNAME / ADMIN_EMAIL + ADMIN_PASSWORD env vars
 * 2. ADMIN_IDENTIFIER + ADMIN_PASSWORD env vars
 * 3. Defaults: admin / admin123
 *
 * Usage:
 *   const creds = loadAdminCredentials();
 *   // creds.identifier is username or email
 *   // creds.password is the password
 */
export function loadAdminCredentials(): { identifier: string; password: string } {
	const identifier =
		process.env.ADMIN_USERNAME?.trim() ||
		process.env.ADMIN_EMAIL?.trim() ||
		process.env.ADMIN_IDENTIFIER?.trim() ||
		'admin';

	const password = process.env.ADMIN_PASSWORD?.trim() || 'admin123';

	return { identifier, password };
}

/**
 * @deprecated Use createRandomUser() instead
 * Kept for backward compatibility with existing tests
 */
export function findOrCreateUser(pref = 'e2e'): User {
	return createRandomUser(pref);
}
