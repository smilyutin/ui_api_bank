import fs from 'fs';
import path from 'path';

// Persistent test user and token storage in test-data/users.json.
// Single-user mode: only one primary user stored; additional users can be created in-memory.
// Used to maintain state across test runs and by auth-bootstrap for token minting.

const filePath = path.join(__dirname, '..', 'test-data', 'users.json');

export type User = { username?: string; email?: string; password: string };

type UsersFixture = {
	user?: User;
	token?: string;
	adminToken?: string;
	// Backward-compatible field used by legacy readers
	users?: User[];
};

// Load the stored fixture from disk.
function readFixture(): UsersFixture {
	try {
		const raw = fs.readFileSync(filePath, 'utf-8');
		const json = JSON.parse(raw) as UsersFixture;
		return json || {};
	} catch {
		return {};
	}
}

// Extract the primary (or only) user from the fixture.
function getPrimaryUser(fixture: UsersFixture): User | null {
	if (fixture.user) return fixture.user;
	if (fixture.users && fixture.users.length > 0) return fixture.users[0];
	return null;
}

// Normalize and write the fixture to disk (single-user mode).
function writeFixture(fixture: UsersFixture) {
	const primaryUser = getPrimaryUser(fixture);
	const normalized: UsersFixture = {
		...fixture,
		user: primaryUser || undefined,
		users: primaryUser ? [primaryUser] : [],
	};

	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
}

// Load the stored primary user. Returns empty array if none found.
export function loadUsers(): User[] {
	const fixture = readFixture();
	const primaryUser = getPrimaryUser(fixture);
	return primaryUser ? [primaryUser] : [];
}

// Save a user to the fixture (skips if user exists, unless replace=true).
export function saveUser(user: User, options?: { replace?: boolean }) {
	const fixture = readFixture();
	const existing = getPrimaryUser(fixture);
	const replace = options?.replace === true;

	// Single-user mode: preserve existing primary user unless explicit replace is requested.
	if (existing && !replace) return;

	writeFixture({
		...fixture,
		user,
	});
}

// Load or create a persisted test user.
export function findOrCreateUser(pref = 'e2e'): User {
	const users = loadUsers();
	if (users.length > 0) return users[0];
	const random = Math.random().toString(36).substring(2, 8);
	const username = `${pref}${random}`;
	const email = `${pref}+${random}@example.com`;
	const user: User = { username, email, password: 'Password123!' };
	saveUser(user, { replace: true });
	return user;
}

// Create a fresh random user. Always returns a new user; optionally persist.
export function createRandomUser(pref = 'UI', persist = true): User {
	const random = Math.random().toString(36).substring(2, 10);
	const username = `${pref}${random}`;
	const email = `${pref}+${random}@example.com`;
	const user: User = { username, email, password: 'Password123!' };
	if (persist) saveUser(user);
	return user;
}

// Load a stored JWT token by role. Returns null if not found.
export function loadStoredToken(role: 'user' | 'admin' = 'user'): string | null {
	const fixture = readFixture();
	if (role === 'admin') {
		return fixture.adminToken || null;
	}
	return fixture.token || null;
}

// Save a JWT token to the fixture by role.
export function saveStoredToken(token: string, role: 'user' | 'admin' = 'user') {
	const fixture = readFixture();
	if (role === 'admin') {
		writeFixture({
			...fixture,
			adminToken: token,
		});
		return;
	}

	writeFixture({
		...fixture,
		token,
	});
}
