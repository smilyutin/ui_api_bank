import type { APIRequestContext } from '@playwright/test';

export type LegacyLoginProbeResult = {
	status: number;
	isWerkzeugDebugger: boolean;
	leaksFilePaths: boolean;
	bodySnippet: string;
};

/**
 * Probes the legacy `/api/login` route registered by `init_auth_routes(app)`
 * (auth.py) — a separate, SQLite-backed login path from the main /login.
 * `bank.db` has no `users` table in this deployment, so any call raises an
 * unhandled `sqlite3.OperationalError`. Whether that surfaces as Flask's
 * interactive Werkzeug debugger (DEBUG=True) is itself the finding this
 * checks for — it doesn't attempt to unlock or use the debugger console.
 */
export async function probeLegacyApiLogin(
	api: APIRequestContext,
	credentials: { username: string; password: string }
): Promise<LegacyLoginProbeResult> {
	const res = await api.post('/api/login', {
		data: credentials,
		headers: { 'Content-Type': 'application/json' }
	});
	const status = res.status();
	const body = await res.text().catch(() => '');

	const isWerkzeugDebugger = /Werkzeug Debugger/i.test(body) || /class="debugger"/i.test(body);
	const leaksFilePaths = /site-packages|\/app\/|\.py["<]/i.test(body);

	return {
		status,
		isWerkzeugDebugger,
		leaksFilePaths,
		bodySnippet: body.slice(0, 500)
	};
}
