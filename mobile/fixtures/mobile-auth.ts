import { browser } from '@wdio/globals';
import { createRandomUser, type User } from '../../helpers/credentials';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

// Mobile suite authentication via WebdriverIO/Appium (real Chrome/Safari engines).
// Token-first bootstrap with credential fallback, analogous to helpers/auth-bootstrap.ts
// but using WebdriverIO's browser.setCookies/executeScript instead of Playwright APIs.

const TOKEN_STORAGE_KEYS = ['token', 'jwt', 'jwt_token', 'auth', 'access_token', 'id_token'];
const TOKEN_COOKIE_NAMES = ['token', 'jwt', 'access_token', 'auth_token'];
const LOGIN_CANDIDATES = ['/api/auth/login', '/api/login', '/login', '/api/session'];
const LOGIN_SUCCESS_STATUSES = [200, 201, 302, 303];

export type MobileAuthResult = {
	mode: 'token' | 'credentials';
	identifier: string;
};

// Deliberately unpersisted (createRandomUser(..., false)): unlike the
// Playwright suite, this suite never reuses a shared account across runs.
// test-data/users.json persists on disk across local runs, and this app's
// JWT_SECRET/Postgres data can both be reset independently of that file
// (container rebuild, fresh volume) - a stale shared token/account then
// causes hard-to-diagnose failures (invalid token, or a real but
// long-since-drained balance from earlier money-transfer runs against the
// same account). Registering a fresh account every call sidesteps all of
// that at the cost of one extra POST /register per test.
export async function registerUser(baseURL: string, user: { username?: string; password: string }) {
	try {
		await fetch(new URL('/register', baseURL).toString(), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: user.username, password: user.password }),
		});
	} catch {
		// Best-effort: "username already exists" and transient errors are both
		// fine here - the login attempt that follows is the real signal.
	}
}

// Mint a fresh JWT by POSTing to login endpoints. Runs in Node (not the browser).
async function mintUserToken(
	baseURL: string,
	user: User,
	identifier: string
): Promise<string | null> {
	const variants: Record<string, string>[] = [
		{ username: identifier, password: user.password },
		{ email: identifier, password: user.password },
	];

	for (const path of LOGIN_CANDIDATES) {
		for (const payload of variants) {
			try {
				const res = await fetch(new URL(path, baseURL).toString(), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				if (LOGIN_SUCCESS_STATUSES.includes(res.status)) {
					const json = await res.json().catch(() => null);
					const token = json?.token || json?.jwt_token || json?.jwt || json?.access_token;
					if (token) return String(token);
				}
			} catch {
				// try the next candidate route
			}
		}
	}

	return null;
}

// Inject token into localStorage, sessionStorage, and cookies via browser APIs.
async function applyTokenBootstrap(baseURL: string, token: string) {
	// Navigate to /login to establish same-origin storage (not for the page itself).
	// /login is fast/reliable; the root has an external image that can hang the load.
	await browser.url(new URL('/login', baseURL).toString());
	await browser.execute(
		(injectedToken: string, keys: string[]) => {
			for (const key of keys) {
				window.localStorage.setItem(key, injectedToken);
				window.sessionStorage.setItem(key, injectedToken);
			}
		},
		token,
		TOKEN_STORAGE_KEYS
	);

	await browser.setCookies(
		TOKEN_COOKIE_NAMES.map((name) => ({ name, value: token }))
	);
}

/**
 * Mobile-browser equivalent of helpers/auth-bootstrap.ts's
 * ensureDashboardAuthenticated: mints a brand-new, never-persisted user for
 * every call, then tries token injection first, falling back to driving the
 * real login form with that same account if the token doesn't stick.
 */
export async function ensureDashboardAuthenticated(options: {
	baseURL: string;
	fallbackUserPrefix?: string;
}): Promise<MobileAuthResult> {
	const baseURL = options.baseURL;
	const fallbackUserPrefix = options.fallbackUserPrefix ?? 'mobile';
	const dash = new DashboardPage();

	// registerUser/mintUserToken run in the WebdriverIO/Node process (the CI
	// runner or your machine), not inside the browser under test. On Android
	// that process can't reach 10.0.2.2 - that alias only resolves from
	// inside the emulator's own network namespace - so swap it back to
	// localhost for these Node-side calls. Browser navigation keeps using
	// baseURL as-is.
	const nodeReachableURL = baseURL.replace('10.0.2.2', 'localhost');

	const user = createRandomUser(fallbackUserPrefix, false);
	const identifier = user.username || user.email;
	if (!identifier) {
		throw new Error('No username or email found in generated user');
	}
	await registerUser(nodeReachableURL, user);

	const token = process.env.API_AUTH_TOKEN?.trim() || (await mintUserToken(nodeReachableURL, user, identifier));

	if (token) {
		await applyTokenBootstrap(baseURL, token);
		await dash.goto(baseURL);
		try {
			await dash.waitForLoad();
			return { mode: 'token', identifier };
		} catch {
			// Token bootstrap didn't stick (e.g. Safari's storage partitioning) - fall through to credentials.
		}
	}

	const login = new LoginPage();
	await login.goto(baseURL);
	await login.fillEmail(identifier);
	await login.fillPassword(user.password);
	await login.submit();
	await dash.waitForLoad();

	return { mode: 'credentials', identifier };
}
