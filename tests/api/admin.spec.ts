import { test, expect, request } from '@playwright/test';
import { SecurityReporter } from '../../fixtures/helper/security-reporter';
import { validateSchema } from '../../helpers/schema-validator';
import { establishAccountSession } from '../../fixtures/api/transactions.helpers';
import { forgeToken } from '../../fixtures/api/jwt-forge.helpers';
import { loginAsSeededAdmin, fetchAdminPanelHtml, extractPendingLoansFromAdminHtml } from '../../fixtures/api/loans.helpers';
import { createAdmin, deleteAccount } from '../../fixtures/api/admin.helpers';

/**
 * API Admin Tests
 *
 * These tests exercise the admin surfaces:
 *   - GET /sup3r_s3cr3t_admin          (security through obscurity, admin only)
 *   - POST /admin/create_admin         (admin only, SQL-injectable f-string)
 *   - POST /admin/delete_account/<id>  (admin only, hard delete, no audit)
 *
 * Test Strategy:
 * 1. Access Control — verify non-admin / unauthenticated users are rejected from
 *    each endpoint (API5_BFLA).
 * 2. Privilege Escalation — probe whether a forged admin claim via the hardcoded
 *    JWT secret allows unauthorized admin actions (API5_BFLA).
 * 3. Input Validation — verify duplicate username, SQL injection, and missing
 *    confirmation checks (API8_SECURITY_MISCONFIGURATION).
 * 4. Data Exposure — confirm admin panel doesn't leak sensitive fields like
 *    plaintext passwords or reset PINs (API3_DATA_EXPOSURE).
 * 5. Authorization — verify arbitrary user_id in delete doesn't bypass ownership
 *    checks (API5_BFLA).
 *
 * Each test establishes its own account session (rather than sharing one from
 * beforeAll) because these tests have side effects (user creation/deletion) and
 * Playwright runs this suite with fullyParallel enabled.
 */

const AUTH_DENIED_STATUSES = [401, 403];

test.describe('API - Admin panel access control', () => {
	test('GET /sup3r_s3cr3t_admin should require authentication', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const anon = await request.newContext({ baseURL: baseURL.toString() });
		const res = await fetchAdminPanelHtml(anon, '');
		const status = res.status();
		await anon.dispose();

		expect(AUTH_DENIED_STATUSES).toContain(status);
		reporter.reportPass(
			'Admin panel endpoint rejected an unauthenticated request.',
			'API5:2023 - Broken Function Level Authorization'
		);
	});

	test('GET /sup3r_s3cr3t_admin should reject a non-admin authenticated user', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const session = await establishAccountSession(api, 'admin-panel-non-admin-check');
		if (!session) {
			reporter.reportSkip('Could not establish an account session (register/login) on this target.');
			await api.dispose();
			test.skip(true, 'No account session available');
			return;
		}

		const res = await fetchAdminPanelHtml(api, session.token);
		const status = res.status();
		await api.dispose();

		expect(AUTH_DENIED_STATUSES).toContain(status);
		reporter.reportPass(
			'Admin panel endpoint rejected a genuine non-admin token.',
			'API5:2023 - Broken Function Level Authorization'
		);
	});

	test('GET /sup3r_s3cr3t_admin should not expose sensitive user fields', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const admin = await loginAsSeededAdmin(api);
		if (!admin) {
			reporter.reportSkip('Could not log in as the seeded admin account to inspect data exposure.');
			await api.dispose();
			test.skip(true, 'No admin session available');
			return;
		}

		const res = await fetchAdminPanelHtml(api, admin.token);
		const html = await res.text();
		await api.dispose();

		testInfo.attach('admin-panel-html', { body: html, contentType: 'text/html' });

		const exposesPlaintextPassword =
			html.toLowerCase().includes('password') && html.includes('admin123') && !html.includes('hashed');
		const exposesResetPin = html.includes('reset_pin') && html.match(/\d{4,6}/);

		if (exposesPlaintextPassword || exposesResetPin) {
			reporter.reportVulnerability(
				'API3_DATA_EXPOSURE',
				{
					endpoint: '/sup3r_s3cr3t_admin',
					exposedFields: [exposesPlaintextPassword && 'plaintext_password', exposesResetPin && 'reset_pin'].filter(Boolean)
				},
				[
					'Hash all passwords before storage and never expose them in responses.',
					'Redact sensitive fields like reset PINs from admin views unless explicitly required.',
					'Audit the admin panel template to ensure no unencrypted sensitive data appears.'
				]
			);
		} else {
			reporter.reportPass(
				'Admin panel does not expose plaintext passwords or reset PINs in the rendered HTML.',
				'API3:2023 - Broken Object Property Level Authorization'
			);
		}
	});
});

test.describe('API - Admin create_admin authorization', () => {
	test('POST /admin/create_admin should reject a non-admin authenticated user', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const session = await establishAccountSession(api, 'admin-create-non-admin-check');
		if (!session) {
			reporter.reportSkip('Could not establish an account session (register/login) on this target.');
			await api.dispose();
			test.skip(true, 'No account session available');
			return;
		}

		const res = await createAdmin(api, session.token, {
			username: 'attacker-admin',
			password: 'attacker123',
			account_number: 'ATTACKER001'
		});
		const status = res.status();
		await api.dispose();

		expect(AUTH_DENIED_STATUSES).toContain(status);
		reporter.reportPass(
			'Create admin endpoint rejected a genuine non-admin token.',
			'API5:2023 - Broken Function Level Authorization'
		);
	});

	test('POST /admin/create_admin should not be reachable via a forged admin claim (weak JWT secret)', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const session = await establishAccountSession(api, 'admin-create-escalate');
		if (!session) {
			reporter.reportSkip('Could not establish an account session (register/login) on this target.');
			await api.dispose();
			test.skip(true, 'No account session available');
			return;
		}

		const newAdminUsername = `forged-admin-${Date.now()}`;
		const forgedAdminToken = forgeToken({ userId: session.userId, username: session.user.username || '', isAdmin: true });

		const createRes = await createAdmin(api, forgedAdminToken, {
			username: newAdminUsername,
			password: 'forged123',
			account_number: `FORGED${Date.now()}`
		});
		const createBody = await createRes.json().catch(() => null);

		let escalationConfirmed = false;

		if (createRes.status() === 200 && createBody?.status === 'success') {
			const verifyLogin = await api.post('/login', {
				data: { username: newAdminUsername, password: 'forged123' }
			});
			const verifyBody = await verifyLogin.json().catch(() => null);
			escalationConfirmed = verifyLogin.status() === 200 && verifyBody?.isAdmin === true;
		}

		await api.dispose();

		testInfo.attach('admin-creation-probe', {
			body: JSON.stringify({ createStatus: createRes.status(), createBody, escalationConfirmed }, null, 2),
			contentType: 'application/json'
		});

		if (escalationConfirmed) {
			reporter.reportVulnerability(
				'API5_BFLA',
				{
					endpoint: '/admin/create_admin',
					technique: 'Forged JWT with is_admin=true, signed using the hardcoded weak secret from auth.py',
					newAdminUsername,
					newAdminCreated: true
				},
				[
					'Replace the hardcoded JWT secret with a strong, environment-provided secret that is never committed to source control.',
					'Do not trust an `is_admin` claim from the token payload alone — verify the user\'s role against the database on every privileged request.',
					'Reject tokens signed with unexpected algorithms and enforce a single expected algorithm (no "none", no algorithm confusion).'
				]
			);
		} else {
			reporter.reportPass(
				'Forging an admin claim with the application\'s JWT secret did not result in a new admin account creation.',
				'API5:2023 - Broken Function Level Authorization'
			);
		}
	});

	test('POST /admin/create_admin should reject duplicate usernames', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const admin = await loginAsSeededAdmin(api);
		if (!admin) {
			reporter.reportSkip('Could not log in as the seeded admin account to run duplicate-username check.');
			await api.dispose();
			test.skip(true, 'No admin session available');
			return;
		}

		const testUsername = `duplicate-test-${Date.now()}`;
		const testPayload = {
			username: testUsername,
			password: 'test123',
			account_number: `TEST${Date.now()}`
		};

		const firstCreate = await createAdmin(api, admin.token, testPayload);
		const firstBody = await firstCreate.json().catch(() => null);

		const secondCreate = await createAdmin(api, admin.token, testPayload);
		const secondBody = await secondCreate.json().catch(() => null);

		await api.dispose();

		testInfo.attach('duplicate-username-probe', {
			body: JSON.stringify(
				{ firstCreateStatus: firstCreate.status(), firstBody, secondCreateStatus: secondCreate.status(), secondBody },
				null,
				2
			),
			contentType: 'application/json'
		});

		const duplicateAccepted = secondCreate.status() === 200 && secondBody?.status === 'success';

		if (duplicateAccepted) {
			reporter.reportVulnerability(
				'API8_SECURITY_MISCONFIGURATION',
				{
					endpoint: '/admin/create_admin',
					issue: 'Duplicate username accepted without uniqueness constraint',
					testUsername
				},
				[
					'Add a UNIQUE constraint on the `username` column in the users table.',
					'Validate input on the application side and return a clear error message if a username already exists.',
					'Test uniqueness constraints as part of the CI/CD pipeline.'
				]
			);
		} else {
			reporter.reportPass(
				'Duplicate username was rejected by the create_admin endpoint.',
				'API8:2023 - Software and Data Integrity Failures'
			);
		}
	});

	test('POST /admin/create_admin should handle SQL injection attempts safely', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const admin = await loginAsSeededAdmin(api);
		if (!admin) {
			reporter.reportSkip('Could not log in as the seeded admin account to run SQL injection check.');
			await api.dispose();
			test.skip(true, 'No admin session available');
			return;
		}

		const sqlInjectionPayload = `', true); DROP TABLE users; --`;
		const res = await createAdmin(api, admin.token, {
			username: sqlInjectionPayload,
			password: 'sqli-test',
			account_number: 'SQLI001'
		});
		const body = await res.json().catch(() => null);
		const statusCode = res.status();
		const statusText = res.statusText();

		await api.dispose();

		testInfo.attach('sqli-probe', {
			body: JSON.stringify({ statusCode, statusText, body }, null, 2),
			contentType: 'application/json'
		});

		const indicatesInjection =
			statusCode === 500 || (body && (body.error?.includes('Syntax') || body.error?.includes('SQL') || body.error?.includes('query')));

		if (indicatesInjection) {
			reporter.reportVulnerability(
				'API8_SECURITY_MISCONFIGURATION',
				{
					endpoint: '/admin/create_admin',
					issue: 'SQL injection via f-string interpolation in INSERT statement',
					payload: sqlInjectionPayload,
					statusCode
				},
				[
					'Use parameterized queries (prepared statements) instead of string interpolation for all database operations.',
					'Validate and sanitize all user inputs before using them in any SQL query.',
					'Implement input length limits and character whitelisting for usernames.'
				]
			);
		} else {
			reporter.reportPass(
				'SQL injection attempt did not result in a 500 error or SQL-specific error message.',
				'API8:2023 - Software and Data Integrity Failures'
			);
		}
	});
});

test.describe('API - Admin delete_account authorization', () => {
	test('POST /admin/delete_account/<id> should reject a non-admin authenticated user', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const session = await establishAccountSession(api, 'admin-delete-non-admin-check');
		if (!session) {
			reporter.reportSkip('Could not establish an account session (register/login) on this target.');
			await api.dispose();
			test.skip(true, 'No account session available');
			return;
		}

		const res = await deleteAccount(api, session.token, 999999999);
		const status = res.status();
		await api.dispose();

		expect(AUTH_DENIED_STATUSES).toContain(status);
		reporter.reportPass(
			'Delete account endpoint rejected a genuine non-admin token.',
			'API5:2023 - Broken Function Level Authorization'
		);
	});

	test('POST /admin/delete_account/<id> should not be reachable via a forged admin claim (weak JWT secret)', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const victimSession = await establishAccountSession(api, 'admin-delete-escalate');
		if (!victimSession) {
			reporter.reportSkip('Could not establish a victim account session (register/login) on this target.');
			await api.dispose();
			test.skip(true, 'No victim account session available');
			return;
		}

		const forgedAdminToken = forgeToken({
			userId: victimSession.userId,
			username: victimSession.user.username || '',
			isAdmin: true
		});

		const deleteRes = await deleteAccount(api, forgedAdminToken, victimSession.userId);

		let deletionConfirmed = false;

		if (deleteRes.status() === 200) {
			const verifyLogin = await api.post('/login', {
				data: {
					username: victimSession.user.username,
					password: victimSession.user.password
				}
			});
			deletionConfirmed = verifyLogin.status() !== 200;
		}

		await api.dispose();

		testInfo.attach('account-deletion-probe', {
			body: JSON.stringify({ deleteStatus: deleteRes.status(), deletionConfirmed }, null, 2),
			contentType: 'application/json'
		});

		if (deletionConfirmed) {
			reporter.reportVulnerability(
				'API5_BFLA',
				{
					endpoint: '/admin/delete_account/<id>',
					technique: 'Forged JWT with is_admin=true, signed using the hardcoded weak secret from auth.py',
					victimUserId: victimSession.userId,
					victimDeleted: true
				},
				[
					'Replace the hardcoded JWT secret with a strong, environment-provided secret that is never committed to source control.',
					'Do not trust an `is_admin` claim from the token payload alone — verify the user\'s role against the database on every privileged request.',
					'Require additional confirmation (e.g., one-time code) for destructive operations like account deletion.'
				]
			);
		} else {
			reporter.reportPass(
				'Forging an admin claim with the application\'s JWT secret did not result in account deletion.',
				'API5:2023 - Broken Function Level Authorization'
			);
		}
	});

	test('POST /admin/delete_account/<id> should allow seeded admin to delete an account', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const victim = await establishAccountSession(api, 'admin-delete-functional');
		if (!victim) {
			reporter.reportSkip('Could not create a test user to delete.');
			await api.dispose();
			test.skip(true, 'No test user available');
			return;
		}

		const admin = await loginAsSeededAdmin(api);
		if (!admin) {
			reporter.reportSkip('Could not log in as the seeded admin account to run deletion.');
			await api.dispose();
			test.skip(true, 'No admin session available');
			return;
		}

		const deleteRes = await deleteAccount(api, admin.token, victim.userId);
		const deleteBody = await deleteRes.json().catch(() => null);

		const verifyLogin = await api.post('/login', {
			data: { username: victim.user.username || victim.user.email, password: victim.user.password }
		});

		await api.dispose();

		testInfo.attach('deletion-result', {
			body: JSON.stringify({ deleteStatus: deleteRes.status(), deleteBody, verifyLoginStatus: verifyLogin.status() }, null, 2),
			contentType: 'application/json'
		});

		expect(deleteRes.status()).toBe(200);
		expect(verifyLogin.status()).not.toBe(200);
		reporter.reportPass(
			'Seeded admin successfully deleted a user account and subsequent login attempt failed.',
			'API5:2023 - Broken Function Level Authorization'
		);
	});

	test('POST /admin/delete_account/<id> should handle idempotent deletes gracefully', async ({ baseURL }, testInfo) => {
		if (!baseURL) throw new Error('baseURL is not defined');
		const reporter = new SecurityReporter(testInfo);

		const api = await request.newContext({ baseURL: baseURL.toString() });
		const victim = await establishAccountSession(api, 'admin-delete-idempotent');
		if (!victim) {
			reporter.reportSkip('Could not create a test user for idempotent delete check.');
			await api.dispose();
			test.skip(true, 'No test user available');
			return;
		}

		const admin = await loginAsSeededAdmin(api);
		if (!admin) {
			reporter.reportSkip('Could not log in as the seeded admin account to run idempotent delete check.');
			await api.dispose();
			test.skip(true, 'No admin session available');
			return;
		}

		const firstDelete = await deleteAccount(api, admin.token, victim.userId);
		const firstStatus = firstDelete.status();

		const secondDelete = await deleteAccount(api, admin.token, victim.userId);
		const secondStatus = secondDelete.status();

		await api.dispose();

		testInfo.attach('idempotent-delete-probe', {
			body: JSON.stringify({ firstStatus, secondStatus }, null, 2),
			contentType: 'application/json'
		});

		const secondDeleteErrored = secondStatus === 500 || secondStatus === 400;

		if (secondDeleteErrored) {
			reporter.reportVulnerability(
				'API8_SECURITY_MISCONFIGURATION',
				{
					endpoint: '/admin/delete_account/<id>',
					issue: 'Attempting to delete an already-deleted account results in an error instead of a graceful no-op',
					firstStatus,
					secondStatus
				},
				[
					'Implement idempotent delete operations that return 200/204 even if the resource no longer exists.',
					'Return a 404 status if appropriate, but never expose internal SQL errors (500).',
					'Test edge cases like double-delete, concurrent delete, and delete of non-existent resources.'
				]
			);
		} else {
			reporter.reportPass(
				'Deleting an already-deleted account did not cause an error (idempotent behavior).',
				'API8:2023 - Software and Data Integrity Failures'
			);
		}
	});
});
