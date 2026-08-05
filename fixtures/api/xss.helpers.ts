import type { APIRequestContext } from '@playwright/test';
import { createRandomUser } from '../../helpers/credentials';

/**
 * XSS probe payloads and the account-session helper needed to exercise them.
 *
 * The username payload targets templates/dashboard.html's
 * `{{ username | safe }}` (Jinja auto-escaping disabled) — provable via raw
 * HTTP response text, checked in tests/api/xss.spec.ts.
 *
 * `TRANSFER_DESCRIPTION_XSS_PAYLOAD` targets the transaction list's
 * `transaction-list.innerHTML = transactionHtml` in static/dashboard.js (no
 * client-side escaping) — an API-only check can't prove DOM execution, so
 * this one is checked with a real browser in tests/ui/specs/xss.spec.ts.
 */

export const XSS_MARKER = '__xssProbeFired';
export const TRANSFER_DESCRIPTION_XSS_PAYLOAD = `<img src=x onerror="window.${XSS_MARKER}=true">`;

export type XssUsernameSession = {
	token: string;
	/** The exact payload registered as the username — unique per call (see below). */
	username: string;
};

/**
 * Registers and logs in a user whose *username* is a `<script>` XSS
 * payload, then returns the token and the exact payload used — same
 * `/register` -> `/login` contract as `establishAccountSession`
 * (transactions.helpers.ts), but with an injected payload instead of a
 * random benign username.
 *
 * The payload embeds a random nonce so each call registers a distinct
 * username; `/register` has no duplicate-username tolerance (app.py returns
 * 400 for an existing username), so a fixed payload would only succeed on
 * the first run and silently skip on every run after that.
 */
export async function establishXssUsernameSession(
	api: APIRequestContext
): Promise<XssUsernameSession | null> {
	const { password } = createRandomUser('xss');
	const nonce = Math.random().toString(36).slice(2, 8);
	const usernamePayload = `<script>window.${XSS_MARKER}=true;/*${nonce}*/</script>`;
	const credentials = { username: usernamePayload, password };

	const register = await api.post('/register', {
		data: credentials,
		headers: { 'Content-Type': 'application/json' }
	});
	if (![200, 201].includes(register.status())) return null;

	const login = await api.post('/login', {
		data: credentials,
		headers: { 'Content-Type': 'application/json' }
	});
	if (![200, 201].includes(login.status())) return null;

	const body = (await login.json().catch(() => null)) as { token?: string } | null;
	if (!body?.token) return null;

	return { token: body.token, username: usernamePayload };
}
