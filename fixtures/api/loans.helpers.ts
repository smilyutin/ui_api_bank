import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Loan Helpers
 *
 * Supports API tests for the loan surfaces:
 * - `POST /request_loan`               (any authenticated user)
 * - `POST /admin/approve_loan/<id>`    (admin only)
 *
 * There is no dedicated "list my loans" JSON endpoint — loan applications are
 * rendered server-side into the `#loans` section of `/dashboard`. These
 * helpers fetch that HTML (via the same token-authenticated route the UI
 * uses) and parse the loan rows out of it, so API tests can verify
 * persistence without a browser.
 */

export async function requestLoan(api: APIRequestContext, token: string, amount: number | string): Promise<APIResponse> {
	return api.post('/request_loan', {
		headers: { Authorization: `Bearer ${token}` },
		data: { amount }
	});
}

export async function approveLoan(api: APIRequestContext, token: string, loanId: number): Promise<APIResponse> {
	return api.post(`/admin/approve_loan/${loanId}`, {
		headers: { Authorization: `Bearer ${token}` }
	});
}

export async function fetchDashboardHtml(api: APIRequestContext, token: string): Promise<string> {
	const res = await api.get('/dashboard', {
		headers: { Authorization: `Bearer ${token}` }
	});
	return res.text();
}

export type DashboardLoanRow = { amount: number; status: string };

/**
 * Parse the "Your Loan Applications" table rows out of the dashboard HTML.
 * Mirrors the `<td>${{ loan[2] }}</td><td>...{{ loan[3] }}...</td>` markup in
 * templates/dashboard.html.
 */
export function extractLoanRowsFromDashboardHtml(html: string): DashboardLoanRow[] {
	const loansSectionMatch = html.match(/class="loans-section"[\s\S]*?<\/table>/i);
	if (!loansSectionMatch) return [];

	const rowPattern = /<tr>\s*<td>\$(?<amount>[\d.]+)<\/td>\s*<td>\s*<span[^>]*>(?<status>[^<]+)<\/span>\s*<\/td>\s*<\/tr>/gi;
	const rows: DashboardLoanRow[] = [];
	let match: RegExpExecArray | null;
	while ((match = rowPattern.exec(loansSectionMatch[0])) !== null) {
		if (match.groups) {
			rows.push({ amount: parseFloat(match.groups.amount), status: match.groups.status.trim() });
		}
	}
	return rows;
}

export async function fetchAdminPanelHtml(api: APIRequestContext, token: string): Promise<APIResponse> {
	return api.get('/sup3r_s3cr3t_admin', {
		headers: { Authorization: `Bearer ${token}` }
	});
}

export type PendingLoanRow = { loanId: number; userId: number; amount: number; status: string };

/**
 * Parse the "Pending Loan Applications" table out of the admin panel HTML
 * (templates/admin.html), which — unlike the user-facing dashboard — exposes
 * the raw loan id and owning user id for every pending loan.
 */
export function extractPendingLoansFromAdminHtml(html: string): PendingLoanRow[] {
	const sectionMatch = html.match(/Pending Loan Applications[\s\S]*?<\/table>/i);
	if (!sectionMatch) return [];

	const rowPattern =
		/<tr>\s*<td>(?<loanId>\d+)<\/td>\s*<td>(?<userId>\d+)<\/td>\s*<td>\$(?<amount>[\d.]+)<\/td>\s*<td>(?<status>[^<]+)<\/td>/gi;
	const rows: PendingLoanRow[] = [];
	let match: RegExpExecArray | null;
	while ((match = rowPattern.exec(sectionMatch[0])) !== null) {
		if (match.groups) {
			rows.push({
				loanId: parseInt(match.groups.loanId, 10),
				userId: parseInt(match.groups.userId, 10),
				amount: parseFloat(match.groups.amount),
				status: match.groups.status.trim()
			});
		}
	}
	return rows;
}

/**
 * Find the most recently created pending loan for a given user and amount,
 * used to recover a loan id that `/request_loan` never returns.
 */
export function findPendingLoanId(rows: PendingLoanRow[], userId: number, amount: number): number | null {
	const match = [...rows].reverse().find((row) => row.userId === userId && row.amount === amount);
	return match ? match.loanId : null;
}

export type AdminSession = { token: string; userId: number; username: string };

const DEFAULT_ADMIN_USERNAME = 'admin';
const DEFAULT_ADMIN_PASSWORD = 'admin123';

/**
 * Log in as the application's seeded admin account (database.py creates
 * username "admin" / password "admin123" on first init if it doesn't already
 * exist). This is the legitimate way for tests to reach admin-only
 * functionality — override via ADMIN_USERNAME/ADMIN_PASSWORD if the target
 * environment uses different admin credentials.
 */
export async function loginAsSeededAdmin(api: APIRequestContext): Promise<AdminSession | null> {
	const username = process.env.ADMIN_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME;
	const password = process.env.ADMIN_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;

	const res = await api.post('/login', {
		data: { username, password },
		headers: { 'Content-Type': 'application/json' }
	});
	if (res.status() !== 200) return null;

	const body = await res.json().catch(() => null);
	const token = body?.token;
	const userId = body?.debug_info?.user_id;
	if (!token || userId === undefined || body?.isAdmin !== true) return null;

	return { token, userId, username };
}
