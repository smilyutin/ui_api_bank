import { ensureAdminSession } from './helpers/auth';

// Global setup runs once before all tests.
// Creates or reuses admin session for admin-panel tests.
// Admin session is persisted in storage/admin-auth.json and reused across runs.

const baseURL = process.env.BASE_URL ?? 'http://localhost:5001';

export default async () => {
	try {
		const sessionPath = await ensureAdminSession(baseURL);
		console.log(`✓ Admin session ready for tests: ${sessionPath}`);
	} catch (e) {
		console.error('Failed to setup admin session:', e);
		throw e;
	}
};
