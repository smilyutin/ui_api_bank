import { Page, request as apiRequest } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createRandomUser, loadAdminCredentials, type User } from './credentials';

/**
 * Unified Authentication
 *
 * Single pattern for both admin and user authentication using Playwright's storageState.
 *
 * Admin: Persistent session reused across test runs
 *   await ensureAdminSession(baseURL) → storage/admin-auth.json
 *
 * User: Temporary session per-test, cleaned up after
 *   await loginAsUser(page, baseURL, tempStoragePath) → return credentials + path
 */

const LOGIN_ENDPOINT = '/login';

/**
 * Low-level: POST credentials to login endpoint, extract and return token
 */
export async function loginViaCredentials(
	baseURL: string,
	identifier: string,
	password: string
): Promise<string> {
	const api = await apiRequest.newContext({ baseURL });
	try {
		const payload: Record<string, string> = { password };

		// Send as both username and email to handle different API expectations
		payload.username = identifier;
		if (identifier.includes('@')) {
			payload.email = identifier;
		}

		const res = await api.post(LOGIN_ENDPOINT, {
			data: payload,
			headers: { 'Content-Type': 'application/json' },
		});

		if (!res.ok()) {
			const text = await res.text().catch(() => '(no response body)');
			throw new Error(`Login failed with ${res.status()}: ${text.substring(0, 150)}`);
		}

		const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		const token = json.token || json.access_token || json.jwt || json.jwt_token;

		if (!token || typeof token !== 'string') {
			throw new Error(`No valid token in login response. Received: ${JSON.stringify(json).substring(0, 100)}`);
		}

		return token;
	} finally {
		await api.dispose();
	}
}

/**
 * Create and save storageState from authenticated page
 */
async function saveStorageState(page: Page, filePath: string): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await page.context().storageState({ path: filePath });
}

/**
 * Create a test user, log in, and save storageState for that session
 *
 * Returns the user credentials and path to the storageState file.
 * The caller is responsible for cleanup: fs.rm(path, { force: true }) after the test.
 *
 * Usage:
 *   const { credentials, path: storagePath } = await loginAsUser(
 *     page,
 *     baseURL,
 *     `/tmp/auth-${test.info().testId}.json`,
 *     { userPrefix: 'e2e' }
 *   );
 *   // Now page is authenticated; use storageState in next tests
 *   // Cleanup: await fs.rm(storagePath, { force: true });
 */
export async function loginAsUser(
	page: Page,
	baseURL: string,
	storageStatePath: string,
	options?: { userPrefix?: string }
): Promise<{ credentials: User; path: string; token: string }> {
	// Create a fresh test user for this session
	const credentials = createRandomUser(options?.userPrefix || 'e2e');
	const identifier = credentials.username || credentials.email;

	if (!identifier) {
		throw new Error('Test user must have username or email');
	}

	// Register the user first
	const api = await apiRequest.newContext({ baseURL });
	try {
		const regRes = await api.post('/register', {
			data: JSON.stringify({
				username: identifier,
				password: credentials.password,
			}),
			headers: { 'Content-Type': 'application/json' },
		});

		if (!regRes.ok()) {
			const text = await regRes.text().catch(() => '(no response body)');
			throw new Error(`User registration failed with ${regRes.status()}: ${text.substring(0, 150)}`);
		}
	} finally {
		await api.dispose();
	}

	// Get the auth token via API (needed for API calls from tests)
	const token = await loginViaCredentials(baseURL, identifier, credentials.password);

	// Set the token in environment for tests that need API access
	process.env.API_AUTH_TOKEN = token;

	// Perform login through the UI (form submission) to establish proper session
	// Navigate to login page
	await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });

	// Fill in the login form
	const usernameInput = page.locator('input[name="username"], input[type="email"], input[type="text"]').first();
	const passwordInput = page.locator('input[name="password"], input[type="password"]');
	const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")').first();

	await usernameInput.fill(identifier);
	await passwordInput.fill(credentials.password);
	await submitButton.click();

	// Wait for dashboard to load after login
	await page.waitForURL(/\/dashboard(?:[?#].*)?$/i, { timeout: 10000 }).catch(() => {
		// Ignore timeout; we'll check storageState anyway
	});

	// Save the authenticated page state to a file
	await saveStorageState(page, storageStatePath);

	return { credentials, path: storageStatePath, token };
}

/**
 * Ensure admin session exists, either by reusing cached or creating fresh
 *
 * Returns path to storageState file (storage/admin-auth.json).
 * Use in playwright.config.ts: storageState: await ensureAdminSession(baseURL)
 *
 * Admin credentials come from:
 * 1. Environment variables: ADMIN_USERNAME, ADMIN_PASSWORD
 * 2. Defaults: admin / admin123
 *
 * Caching strategy:
 * - If storage/admin-auth.json exists and is recent, reuse it
 * - If forceRefresh=true, always create fresh session
 * - If login fails, throw error (no fallback)
 */
export async function ensureAdminSession(
	baseURL: string,
	options?: { forceRefresh?: boolean }
): Promise<string> {
	const sessionPath = 'storage/admin-auth.json';
	const forceRefresh = options?.forceRefresh === true;

	// Try to reuse cached session
	if (!forceRefresh) {
		try {
			const stats = await fs.stat(sessionPath);
			const ageMs = Date.now() - stats.mtimeMs;
			const maxAgeMs = 24 * 60 * 60 * 1000; // 24 hours

			if (ageMs < maxAgeMs) {
				console.log(`✓ Reusing cached admin session (${Math.round(ageMs / 60000)} minutes old)`);
				return sessionPath;
			}
		} catch {
			// File doesn't exist or can't be read; continue to create fresh session
		}
	}

	// Create fresh admin session
	console.log('Creating fresh admin session...');
	const adminCreds = loadAdminCredentials();
	const token = await loginViaCredentials(baseURL, adminCreds.identifier, adminCreds.password);

	// Build a minimal storageState file matching Playwright's format
	const storageState = {
		cookies: [
			{
				name: 'token',
				value: token,
				domain: new URL(baseURL).hostname,
				path: '/',
				expires: Math.round(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
				httpOnly: false,
				secure: baseURL.startsWith('https://'),
				sameSite: 'Lax' as const,
			},
		],
		origins: [
			{
				origin: baseURL,
				localStorage: [
					{ name: 'token', value: token },
					{ name: 'access_token', value: token },
				],
				sessionStorage: [],
			},
		],
	};

	// Write to disk
	await fs.mkdir(path.dirname(sessionPath), { recursive: true });
	await fs.writeFile(sessionPath, JSON.stringify(storageState, null, 2), 'utf-8');

	console.log(`✓ Created admin session: ${sessionPath}`);
	return sessionPath;
}
