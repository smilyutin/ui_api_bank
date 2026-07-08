import type { APIRequestContext } from '@playwright/test';
import { createRandomUser, type User } from '../../helpers/credentials';

/**
 * Transaction & Balance Access Helpers
 *
 * Supports API tests for the account balance and transaction-history surfaces:
 * - `/check_balance/<account_number>`
 * - `/transactions/<account_number>`
 * - `/api/transactions?account_number=<account_number>`
 *
 * These helpers establish a real account session (register + login) so a test
 * has a valid account number to exercise, then classify how the balance and
 * history endpoints enforce (or fail to enforce) object-level authorization.
 */

export type AccountSession = {
	user: User;
	token: string;
	accountNumber: string;
	userId: number;
};

type LoginBody = {
	token?: string;
	accountNumber?: string;
	debug_info?: { account_number?: string; user_id?: number };
};

const SUCCESS_STATUSES = [200, 201];

/**
 * Register a fresh user and log in, returning the token and account number the
 * server assigns. Uses the JSON register/login contract that the application
 * exposes. Returns null when the flow cannot be completed against the target.
 */
export async function establishAccountSession(
	api: APIRequestContext,
	prefix = 'bola'
): Promise<AccountSession | null> {
	const user = createRandomUser(prefix, false);
	const identifier = user.username || user.email;
	if (!identifier) return null;

	const credentials = { username: identifier, password: user.password };

	const register = await api.post('/register', {
		data: credentials,
		headers: { 'Content-Type': 'application/json' }
	});
	if (!SUCCESS_STATUSES.includes(register.status())) return null;

	const login = await api.post('/login', {
		data: credentials,
		headers: { 'Content-Type': 'application/json' }
	});
	if (!SUCCESS_STATUSES.includes(login.status())) return null;

	const body = (await login.json().catch(() => null)) as LoginBody | null;
	const token = body?.token;
	const accountNumber = body?.accountNumber || body?.debug_info?.account_number;
	const userId = body?.debug_info?.user_id;
	if (!token || !accountNumber || userId === undefined) return null;

	return { user: { ...user, username: identifier }, token, accountNumber, userId };
}

export type AccessObservation = {
	authenticated: boolean;
	status: number;
	reachable: boolean;
};

/**
 * Determine whether an unauthenticated caller was able to read data that should
 * require authorization. A 2xx from an anonymous request signals broken object
 * level authorization on that endpoint.
 */
export function isBrokenObjectAuthorization(observations: AccessObservation[]): boolean {
	return observations.some((o) => !o.authenticated && o.reachable);
}
