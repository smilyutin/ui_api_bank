import fs from 'fs';
import path from 'path';

const filePath = path.join(__dirname, '..', 'fixtures', 'users.json');

export type User = { username?: string; email?: string; password: string };

type UsersFixture = {
  user?: User;
  token?: string;
  adminToken?: string;
  // Backward-compatible field used by legacy readers
  users?: User[];
};

function readFixture(): UsersFixture {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(raw) as UsersFixture;
    return json || {};
  } catch {
    return {};
  }
}

function getPrimaryUser(fixture: UsersFixture): User | null {
  if (fixture.user) return fixture.user;
  if (fixture.users && fixture.users.length > 0) return fixture.users[0];
  return null;
}

function writeFixture(fixture: UsersFixture) {
  const primaryUser = getPrimaryUser(fixture);
  const normalized: UsersFixture = {
    ...fixture,
    user: primaryUser || undefined,
    users: primaryUser ? [primaryUser] : [],
  };

  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), 'utf-8');
}

export function loadUsers(): User[] {
  const fixture = readFixture();
  const primaryUser = getPrimaryUser(fixture);
  return primaryUser ? [primaryUser] : [];
}

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

// Create a new random user and optionally persist it. Always returns a new user.
export function createRandomUser(pref = 'UI', persist = true): User {
  const random = Math.random().toString(36).substring(2, 10);
  const username = `${pref}${random}`;
  const email = `${pref}+${random}@example.com`;
  const user: User = { username, email, password: 'Password123!' };
  if (persist) saveUser(user);
  return user;
}

export function loadStoredToken(role: 'user' | 'admin' = 'user'): string | null {
  const fixture = readFixture();
  if (role === 'admin') {
    return fixture.adminToken || null;
  }
  return fixture.token || null;
}

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
