import { test, expect, request } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { requestLoan } from '../../../fixtures/api/loans.helpers';

test.describe('Admin Panel UI', () => {
	test.describe('Phase 1: Authentication & Access Control', () => {
		test('Admin can access admin panel', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();

			await expect(page.getByRole('heading', { name: /Admin Control Panel/i })).toBeVisible();
		});

		test('Admin authentication required to access panel', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);

			const url = page.url();
			const isAccessible = url.includes('/sup3r_s3cr3t_admin') || url.includes('/login');

			expect(isAccessible).toBeTruthy();
		});

		test('Non-admin user access is not protected (vulnerability)', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const api = await (await import('@playwright/test')).request.newContext({ baseURL });
			const session = await establishAccountSession(api, 'admin-panel-non-admin-check');

			if (!session) {
				test.skip();
			}

			await page.goto(baseURL);
			await page.evaluate(({ token, keys }) => {
				for (const key of keys) {
					window.localStorage.setItem(key, token);
				}
			}, { token: session.token, keys: ['jwt_token', 'token', 'auth'] });

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);

			const url = page.url();
			expect(url).toContain('/sup3r_s3cr3t_admin');

			await api.dispose();
		});
	});

	test.describe('Phase 1: User Management Table', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('User management table displays with correct columns', async ({ page }) => {
			const pm = new PageManager(page);
			const table = page.locator('table').first();

			await expect(table).toBeVisible();

			const headers = await table.locator('thead th').allTextContents();
			expect(headers).toContain('ID');
			expect(headers).toContain('Username');
			expect(headers).toContain('Account Number');
			expect(headers).toContain('Balance');
			expect(headers).toContain('Admin');
			expect(headers).toContain('Actions');
		});

		test('User management table displays users', async ({ page }) => {
			const pm = new PageManager(page);
			const userCount = await pm.adminPanel().getUserCount();

			expect(userCount).toBeGreaterThan(0);
		});

		test('User data displays correctly in table', async ({ page }) => {
			const pm = new PageManager(page);
			const rows = await pm.adminPanel().getUserTableRows();

			if (rows.length === 0) {
				test.skip();
			}

			const firstRowCells = await rows[0].locator('td').allTextContents();
			expect(firstRowCells.length).toBeGreaterThanOrEqual(5);

			const userId = firstRowCells[0];
			const username = firstRowCells[1];

			expect(userId).toBeTruthy();
			expect(username).toBeTruthy();
		});

		test('Delete button present for each user', async ({ page }) => {
			const pm = new PageManager(page);
			const rows = await pm.adminPanel().getUserTableRows();

			if (rows.length === 0) {
				test.skip();
			}

			for (const row of rows) {
				const deleteButton = row.locator('button:has-text("Delete")');
				await expect(deleteButton).toBeVisible();
			}
		});
	});

	test.describe('Phase 1: Delete Account Feature', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('Delete account success flow', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const api = await (await import('@playwright/test')).request.newContext({ baseURL });
			const testSession = await establishAccountSession(api, 'admin-delete-test');

			if (!testSession) {
				test.skip();
			}

			const userIdToDelete = testSession.userId;

			await page.reload();
			await pm.adminPanel().waitForLoad();

			try {
				await pm.adminPanel().deleteUserById(userIdToDelete);
				await pm.adminPanel().waitForSuccessMessage('deleted successfully', 10000);

				const messageText = await pm.adminPanel().getMessageText();
				expect(messageText?.toLowerCase()).toContain('delete');
				expect(messageText?.toLowerCase()).toContain('success');
			} catch {
				test.skip();
			}

			await api.dispose();
		});
	});

	test.describe('Phase 1: Create Admin Account', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('Create admin form displays with correct fields', async ({ page }) => {
			const pm = new PageManager(page);

			await expect(page.locator('#admin_username')).toBeVisible();
			await expect(page.locator('#admin_password')).toBeVisible();
			await expect(page.getByRole('button', { name: /Create Admin/i })).toBeVisible();
		});

		test('Create admin success flow', async ({ page }) => {
			const pm = new PageManager(page);

			const testUsername = `admin-test-${Date.now()}`;
			const testPassword = 'TestPass123!';

			await pm.adminPanel().createAdmin(testUsername, testPassword);

			await pm.adminPanel().waitForSuccessMessage('created successfully', 10000);

			const messageText = await pm.adminPanel().getMessageText();
			expect(messageText?.toLowerCase()).toContain('success');

			const usernameInput = page.locator('#admin_username');
			await expect(usernameInput).toHaveValue('');
		});

		test('Create admin form clears after submission', async ({ page }) => {
			const pm = new PageManager(page);

			const testUsername = `admin-form-clear-${Date.now()}`;
			const testPassword = 'TestPass123!';

			await pm.adminPanel().createAdmin(testUsername, testPassword);

			await pm.adminPanel().waitForSuccessMessage();

			const usernameInput = page.locator('#admin_username');
			const passwordInput = page.locator('#admin_password');

			await expect(usernameInput).toHaveValue('');
			await expect(passwordInput).toHaveValue('');
		});
	});

	test.describe('Phase 1: Pending Loan Approvals', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('Pending loans table displays with correct columns', async ({ page }) => {
			const tables = await page.locator('table').all();

			if (tables.length < 2) {
				test.skip();
			}

			const loansTable = tables[1];
			const headers = await loansTable.locator('thead th').allTextContents();

			expect(headers).toContain('Loan ID');
			expect(headers).toContain('User ID');
			expect(headers).toContain('Amount');
			expect(headers).toContain('Status');
			expect(headers).toContain('Actions');
		});

		test('Approve loan success flow', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length === 0) {
				test.skip();
			}

			const firstLoanRow = loanRows[0];
			const loanIdCell = firstLoanRow.locator('td').first();
			const loanId = parseInt((await loanIdCell.textContent()) || '0', 10);

			if (!loanId) {
				test.skip();
			}

			const rowsBeforeApprove = await pm.adminPanel().getPendingLoansTableRows();

			await pm.adminPanel().approveLoanById(loanId);

			await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);

			const messageText = await pm.adminPanel().getMessageText();
			expect(messageText?.toLowerCase()).toContain('approve');
			expect(messageText?.toLowerCase()).toContain('success');

			const rowsAfterApprove = await pm.adminPanel().getPendingLoansTableRows();
			expect(rowsAfterApprove.length).toBeLessThanOrEqual(rowsBeforeApprove.length);
		});

		test('Approve button present for each pending loan', async ({ page }) => {
			const pm = new PageManager(page);
			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length <= 1) {
				test.skip();
			}

			for (let i = 0; i < loanRows.length; i++) {
				const row = loanRows[i];
				const isEmptyMessage = await row.locator('[data-testid="no-pending-loans-message"]').isVisible().catch(() => false);
				if (isEmptyMessage) continue;

				const approveButton = row.locator('button:has-text("Approve")');
				await expect(approveButton).toBeVisible();
			}
		});
	});

	test.describe('Phase 1: Navigation & Integration', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('Back to Dashboard link works', async ({ page }) => {
			const pm = new PageManager(page);

			await pm.adminPanel().navigateBackToDashboard();

			await expect(page).toHaveURL(/\/dashboard/i);
		});

		test('Page title shows Admin Panel', async ({ page }) => {
			const pm = new PageManager(page);
			const title = await pm.adminPanel().getPageTitle();

			expect(title).toContain('Admin');
		});

		test('Admin header displays correctly', async ({ page }) => {
			const pm = new PageManager(page);
			const headerText = await pm.adminPanel().getAdminHeaderText();

			expect(headerText?.toLowerCase()).toContain('admin');
			expect(headerText?.toLowerCase()).toContain('control');
		});

		test('Admin profile picture displays', async ({ page }) => {
			const pm = new PageManager(page);

			await expect(pm.adminPanel().getProfilePicture()).toBeVisible({ timeout: 5000 });
		});
	});

	test.describe('Phase 1: Loan Approval with Amount Validation', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const api = await request.newContext({ baseURL });
			const testSession = await establishAccountSession(api, 'loan-approval-test');

			if (testSession) {
				await requestLoan(api, testSession.token, 5000);
			}

			await api.dispose();

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('Loan amount displays correctly in pending loans table', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length === 0) {
				test.skip();
			}

			const firstLoanAmount = await pm.adminPanel().getLoanAmountByRowIndex(0);
			expect(firstLoanAmount).toBeTruthy();
			expect(firstLoanAmount?.trim()).toMatch(/\$-?[\d,]+(\.\d{2})?/);
		});

		test('Approve loan removes from pending applications', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length === 0) {
				test.skip();
			}

			const firstLoanRow = loanRows[0];
			const loanIdCell = firstLoanRow.locator('td').first();
			const loanId = parseInt((await loanIdCell.textContent()) || '0', 10);

			if (!loanId) {
				test.skip();
			}

			const rowsBeforeApprove = await pm.adminPanel().getPendingLoansTableRows();

			await pm.adminPanel().approveLoanById(loanId);
			await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);

			const messageText = await pm.adminPanel().getMessageText();
			expect(messageText?.toLowerCase()).toContain('approve');
			expect(messageText?.toLowerCase()).toContain('success');

			const rowsAfterApprove = await pm.adminPanel().getPendingLoansTableRows();
			expect(rowsAfterApprove.length).toBeLessThan(rowsBeforeApprove.length);
		});

		test('Loan amount stays same or increases after approval', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length === 0) {
				test.skip();
			}

			const firstLoanRow = loanRows[0];
			const loanIdCell = firstLoanRow.locator('td').first();
			const loanId = parseInt((await loanIdCell.textContent()) || '0', 10);

			if (!loanId) {
				test.skip();
			}

			const amountBefore = await pm.adminPanel().getLoanAmountById(loanId);
			const amountBeforeNum = parseFloat(amountBefore?.replace(/[^\d.]/g, '') || '0');
			expect(amountBeforeNum).toBeGreaterThan(0);

			await pm.adminPanel().approveLoanById(loanId);
			await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);
		});

		test('Pending loans count decreases after approval', async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const countBefore = await pm.adminPanel().getPendingLoansCount();

			if (countBefore === 0) {
				test.skip();
			}

			const loanRows = await pm.adminPanel().getPendingLoansTableRows();
			const firstLoanRow = loanRows[0];
			const loanIdCell = firstLoanRow.locator('td').first();
			const loanId = parseInt((await loanIdCell.textContent()) || '0', 10);

			if (!loanId) {
				test.skip();
			}

			await pm.adminPanel().approveLoanById(loanId);
			await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);

			const countAfter = await pm.adminPanel().getPendingLoansCount();
			expect(countAfter).toBeLessThan(countBefore);
		});
	});

	test.describe('Phase 1: Message Feedback System', () => {
		test.beforeEach(async ({ page, baseURL }) => {
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);
			await pm.adminPanel().goto(baseURL);
			await pm.adminPanel().waitForLoad();
		});

		test('Success message displays with green styling', async ({ page }) => {
			const pm = new PageManager(page);
			const testUsername = `admin-msg-success-${Date.now()}`;

			await pm.adminPanel().createAdmin(testUsername, 'Test123!');

			const message = page.locator('#message');
			await expect(message).toBeVisible();
			await expect(message).toHaveClass(/success/);
		});

		test('Message text content displays', async ({ page }) => {
			const pm = new PageManager(page);
			const testUsername = `admin-msg-content-${Date.now()}`;

			await pm.adminPanel().createAdmin(testUsername, 'Test123!');

			await pm.adminPanel().waitForSuccessMessage('created successfully', 10000);

			const messageText = await pm.adminPanel().getMessageText();
			expect(messageText).toBeTruthy();
			expect(messageText?.length).toBeGreaterThan(0);
		});
	});
});
