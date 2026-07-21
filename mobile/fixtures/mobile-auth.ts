import { browser } from '@wdio/globals';
import { findOrCreateUser, loadStoredToken, saveStoredToken } from '../../helpers/credentials';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';

// Same storage keys/cookie names/candidate routes as helpers/auth-bootstrap.ts,
// ported to WebdriverIO's fetch + browser.setCookies/executeScript APIs.
const TOKEN_STORAGE_KEYS = ['token', 'jwt', 'jwt_token', 'auth', 'access_token', 'id_token'];
const TOKEN_COOKIE_NAMES = ['token', 'jwt', 'access_token', 'auth_token'];
const LOGIN_CANDIDATES = ['/api/auth/login', '/api/login', '/login', '/api/session'];
const LOGIN_SUCCESS_STATUSES = [200, 201, 302, 303];

export type MobileAuthResult = {
	mode: 'token' | 'credentials';
	identifier: string;
};

async function mintFreshUserToken(
	baseURL: string,
	fallbackUserPrefix: string
): Promise<{ token: string; identifier: string } | null> {
	const user = findOrCreateUser(fallbackUserPrefix);
	const identifier = user.username || user.email;
	if (!identifier) return null;

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
					if (token) return { token: String(token), identifier };
				}
			} catch {
				// try the next candidate route
			}
		}
	}

	return null;
}

async function applyTokenBootstrap(baseURL: string, token: string) {
	await browser.url(baseURL);
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
 * ensureDashboardAuthenticated: try token injection first, fall back to
 * driving the real login form. Reuses the same test-data/users.json store.
 */
export async function ensureDashboardAuthenticated(options: {
	baseURL: string;
	fallbackUserPrefix?: string;
}): Promise<MobileAuthResult> {
	const baseURL = options.baseURL;
	const fallbackUserPrefix = options.fallbackUserPrefix ?? 'mobile';
	const dash = new DashboardPage();

	let token = loadStoredToken('user') || process.env.API_AUTH_TOKEN?.trim() || null;
	let identifier: string | null = null;

	if (!token) {
		const minted = await mintFreshUserToken(baseURL, fallbackUserPrefix);
		if (minted) {
			token = minted.token;
			identifier = minted.identifier;
			saveStoredToken(minted.token, 'user');
		}
	}

	if (token) {
		await applyTokenBootstrap(baseURL, token);
		await dash.goto(baseURL);
		try {
			await dash.waitForLoad();
			return { mode: 'token', identifier: identifier ?? 'token-user' };
		} catch {
			// Token bootstrap didn't stick (e.g. Safari's storage partitioning) - fall through to credentials.
		}
	}

	const user = findOrCreateUser(fallbackUserPrefix);
	const foundIdentifier = user.username || user.email;
	if (!foundIdentifier) {
		throw new Error('No username or email found in user credentials');
	}

	const login = new LoginPage();
	await login.goto(baseURL);
	await login.fillEmail(foundIdentifier);
	await login.fillPassword(user.password);
	await login.submit();
	await dash.waitForLoad();

	return { mode: 'credentials', identifier: foundIdentifier };
}
