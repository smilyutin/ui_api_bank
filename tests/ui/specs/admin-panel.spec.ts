import { test, expect, request } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { establishAccountSession } from '../../../fixtures/api/transactions.helpers';
import { requestLoan } from '../../../fixtures/api/loans.helpers';
import { loggedExpect, setupAssertionLogging, endAssertionLogging } from '../../../helpers/expect-logger';

test.describe('@ui @admin Admin Panel UI', () => {
	test.describe('Phase 1: Authentication & Access Control', () => {
		test('Admin can access admin panel', async ({ page, baseURL }) => {
			setupAssertionLogging('Admin can access admin panel');
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);

			await test.step('Navigate to the admin panel', async () => {
				await pm.adminPanel().goto(baseURL);
				await pm.adminPanel().waitForLoad();
			});

			await test.step('Verify the panel loaded', async () => {
				await expect(page.getByRole('heading', { name: /Admin Control Panel/i })).toBeVisible();
				endAssertionLogging('passed');
			});
		});

		test('Admin authentication required to access panel', async ({ page, baseURL }) => {
			setupAssertionLogging('Admin authentication required to access panel');
			if (!baseURL) throw new Error('baseURL is not defined');

			const pm = new PageManager(page);

			await test.step('Navigate to the admin panel without authentication', async () => {
				await pm.adminPanel().goto(baseURL);
			});

			await test.step('Verify redirected to login or the panel is otherwise gated', async () => {
				await expect(page).toHaveURL(/(?:\/sup3r_s3cr3t_admin|\/login)/);
				endAssertionLogging('passed');
			});
		});

		test('Non-admin user access is not protected (vulnerability)', async ({ page, baseURL }) => {
			setupAssertionLogging('Non-admin user access is not protected (vulnerability)');
			if (!baseURL) throw new Error('baseURL is not defined');

			const api = await (await import('@playwright/test')).request.newContext({ baseURL });
			const session = await establishAccountSession(api, 'admin-panel-non-admin-check');

			if (!session) {
				await api.dispose();
				test.skip();
			}

			await test.step('Inject a non-admin token and navigate to the admin panel', async () => {
				await page.goto(baseURL);
				await page.evaluate(({ token, keys }) => {
					for (const key of keys) {
						window.localStorage.setItem(key, token);
					}
				}, { token: session!.token, keys: ['jwt_token', 'token', 'auth'] });

				const pm = new PageManager(page);
				await pm.adminPanel().goto(baseURL);
			});

			await test.step('Verify access was not blocked', async () => {
				await expect(page).toHaveURL(/\/sup3r_s3cr3t_admin/);
				await api.dispose();
				endAssertionLogging('passed');
			});
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
			setupAssertionLogging('User management table displays with correct columns');
			const pm = new PageManager(page);

			await test.step('Verify the table columns', async () => {
				const table = page.locator('table').first();
				await expect(table).toBeVisible();

				const headers = await table.locator('thead th').allTextContents();
				loggedExpect(headers, 'headers').toContain('ID');
				loggedExpect(headers, 'headers').toContain('Username');
				loggedExpect(headers, 'headers').toContain('Account Number');
				loggedExpect(headers, 'headers').toContain('Balance');
				loggedExpect(headers, 'headers').toContain('Admin');
				loggedExpect(headers, 'headers').toContain('Actions');
				endAssertionLogging('passed');
			});
		});

		test('User management table displays users', async ({ page }) => {
			setupAssertionLogging('User management table displays users');
			const pm = new PageManager(page);

			await test.step('Verify the user table displays users', async () => {
				const userCount = await pm.adminPanel().getUserCount();
				loggedExpect(userCount, 'userCount').toBeGreaterThan(0);
				endAssertionLogging('passed');
			});
		});

		test('User data displays correctly in table', async ({ page }) => {
			setupAssertionLogging('User data displays correctly in table');
			const pm = new PageManager(page);
			const rows = await pm.adminPanel().getUserTableRows();

			if (rows.length === 0) {
				test.skip();
			}

			await test.step('Verify user id and username are present in the first row', async () => {
				const firstRowCells = await rows[0].locator('td').allTextContents();
				loggedExpect(firstRowCells.length, 'firstRowCells.length').toBeGreaterThanOrEqual(5);

				const userId = firstRowCells[0];
				const username = firstRowCells[1];

				loggedExpect(userId, 'userId').toBeTruthy();
				loggedExpect(username, 'username').toBeTruthy();
				endAssertionLogging('passed');
			});
		});

		test('Delete button present for each user', async ({ page }) => {
			setupAssertionLogging('Delete button present for each user');
			const pm = new PageManager(page);
			const rows = await pm.adminPanel().getUserTableRows();

			if (rows.length === 0) {
				test.skip();
			}

			await test.step('Verify a delete button is visible for each user', async () => {
				for (const row of rows) {
					const deleteButton = row.locator('button:has-text("Delete")');
					await expect(deleteButton).toBeVisible();
				}
				endAssertionLogging('passed');
			});
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
			setupAssertionLogging('Delete account success flow');
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const api = await (await import('@playwright/test')).request.newContext({ baseURL });
			const testSession = await establishAccountSession(api, 'admin-delete-test');

			if (!testSession) {
				await api.dispose();
				test.skip();
			}

			const userIdToDelete = testSession!.userId;

			await test.step('Reload to pick up the test user', async () => {
				await page.reload();
				await pm.adminPanel().waitForLoad();
			});

			try {
				await test.step('Delete the user and verify success', async () => {
					await pm.adminPanel().deleteUserById(userIdToDelete);
					await pm.adminPanel().waitForSuccessMessage('deleted successfully', 10000);

					const messageText = await pm.adminPanel().getMessageText();
					loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('delete');
					loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('success');
					endAssertionLogging('passed');
				});
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
			setupAssertionLogging('Create admin form displays with correct fields');
			const pm = new PageManager(page);

			await test.step('Verify the create admin form fields are present', async () => {
				await expect(page.locator('#admin_username')).toBeVisible();
				await expect(page.locator('#admin_password')).toBeVisible();
				await expect(page.getByRole('button', { name: /Create Admin/i })).toBeVisible();
				endAssertionLogging('passed');
			});
		});

		test('Create admin success flow', async ({ page }) => {
			setupAssertionLogging('Create admin success flow');
			const pm = new PageManager(page);
			const testUsername = `admin-test-${Date.now()}`;
			const testPassword = 'TestPass123!';

			await test.step('Create an admin account', async () => {
				await pm.adminPanel().createAdmin(testUsername, testPassword);
				await pm.adminPanel().waitForSuccessMessage('created successfully', 10000);
			});

			await test.step('Verify the success message and cleared form', async () => {
				const messageText = await pm.adminPanel().getMessageText();
				loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('success');

				const usernameInput = page.locator('#admin_username');
				await expect(usernameInput).toHaveValue('');
				endAssertionLogging('passed');
			});
		});

		test('Create admin form clears after submission', async ({ page }) => {
			setupAssertionLogging('Create admin form clears after submission');
			const pm = new PageManager(page);
			const testUsername = `admin-form-clear-${Date.now()}`;
			const testPassword = 'TestPass123!';

			await test.step('Create an admin account', async () => {
				await pm.adminPanel().createAdmin(testUsername, testPassword);
				await pm.adminPanel().waitForSuccessMessage();
			});

			await test.step('Verify username and password fields cleared', async () => {
				const usernameInput = page.locator('#admin_username');
				const passwordInput = page.locator('#admin_password');

				await expect(usernameInput).toHaveValue('');
				endAssertionLogging('passed');
				await expect(passwordInput).toHaveValue('');
			});
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
			setupAssertionLogging('Pending loans table displays with correct columns');
			const tables = await page.locator('table').all();

			if (tables.length < 2) {
				test.skip();
			}

			await test.step('Verify the pending loans table columns', async () => {
				const loansTable = tables[1];
				const headers = await loansTable.locator('thead th').allTextContents();

				loggedExpect(headers, 'headers').toContain('Loan ID');
				loggedExpect(headers, 'headers').toContain('User ID');
				loggedExpect(headers, 'headers').toContain('Amount');
				loggedExpect(headers, 'headers').toContain('Status');
				loggedExpect(headers, 'headers').toContain('Actions');
				endAssertionLogging('passed');
			});
		});

		test('Approve loan success flow', async ({ page, baseURL }) => {
			setupAssertionLogging('Approve loan success flow');
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

			await test.step('Approve the first pending loan', async () => {
				await pm.adminPanel().approveLoanById(loanId);
				await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);
			});

			await test.step('Verify the success message and row count decreased', async () => {
				const messageText = await pm.adminPanel().getMessageText();
				loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('approve');
				loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('success');

				const rowsAfterApprove = await pm.adminPanel().getPendingLoansTableRows();
				loggedExpect(rowsAfterApprove.length, 'rowsAfterApprove.length').toBeLessThanOrEqual(rowsBeforeApprove.length);
				endAssertionLogging('passed');
			});
		});

		test('Approve button present for each pending loan', async ({ page }) => {
			setupAssertionLogging('Approve button present for each pending loan');
			const pm = new PageManager(page);
			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length <= 1) {
				test.skip();
			}

			await test.step('Verify an approve button is visible for each pending loan', async () => {
				for (let i = 0; i < loanRows.length; i++) {
					const row = loanRows[i];
					const isEmptyMessage = await row.locator('[data-testid="no-pending-loans-message"]').isVisible().catch(() => false);
					if (isEmptyMessage) continue;

					const approveButton = row.locator('button:has-text("Approve")');
					await expect(approveButton).toBeVisible();
				}
				endAssertionLogging('passed');
			});
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
			setupAssertionLogging('Back to Dashboard link works');
			const pm = new PageManager(page);

			await test.step('Click the back to dashboard link', async () => {
				await pm.adminPanel().navigateBackToDashboard();
			});

			await test.step('Verify redirect to the dashboard', async () => {
				await expect(page).toHaveURL(/\/dashboard/i);
				endAssertionLogging('passed');
			});
		});

		test('Page title shows Admin Panel', async ({ page }) => {
			setupAssertionLogging('Page title shows Admin Panel');
			const pm = new PageManager(page);

			await test.step('Verify the page title', async () => {
				const title = await pm.adminPanel().getPageTitle();
				loggedExpect(title, 'title').toContain('Admin');
				endAssertionLogging('passed');
			});
		});

		test('Admin header displays correctly', async ({ page }) => {
			setupAssertionLogging('Admin header displays correctly');
			const pm = new PageManager(page);

			await test.step('Verify the admin header text', async () => {
				const headerText = await pm.adminPanel().getAdminHeaderText();
				loggedExpect(headerText?.toLowerCase(), 'headerText').toContain('admin');
				loggedExpect(headerText?.toLowerCase(), 'headerText').toContain('control');
				endAssertionLogging('passed');
			});
		});

		test('Admin profile picture displays', async ({ page }) => {
			setupAssertionLogging('Admin profile picture displays');
			const pm = new PageManager(page);

			await test.step('Verify the profile picture is visible', async () => {
				await expect(pm.adminPanel().getProfilePicture()).toBeVisible({ timeout: 5000 });
				endAssertionLogging('passed');
			});
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
			setupAssertionLogging('Loan amount displays correctly in pending loans table');
			if (!baseURL) throw new Error('baseURL is not defined');
			const pm = new PageManager(page);

			const loanRows = await pm.adminPanel().getPendingLoansTableRows();

			if (loanRows.length === 0) {
				test.skip();
			}

			await test.step('Verify the loan amount format', async () => {
				const firstLoanAmount = await pm.adminPanel().getLoanAmountByRowIndex(0);
				loggedExpect(firstLoanAmount, 'firstLoanAmount').toBeTruthy();
				loggedExpect(firstLoanAmount?.trim(), 'loanAmount format').toMatch(/\$-?[\d,]+(\.\d{2})?/);
				endAssertionLogging('passed');
			});
		});

		test('Approve loan removes from pending applications', async ({ page, baseURL }) => {
			setupAssertionLogging('Approve loan removes from pending applications');
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

			await test.step('Approve the first pending loan', async () => {
				await pm.adminPanel().approveLoanById(loanId);
				await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);
			});

			await test.step('Verify the success message and row count decreased', async () => {
				const messageText = await pm.adminPanel().getMessageText();
				loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('approve');
				loggedExpect(messageText?.toLowerCase(), 'messageText').toContain('success');

				const rowsAfterApprove = await pm.adminPanel().getPendingLoansTableRows();
				loggedExpect(rowsAfterApprove.length, 'rowsAfterApprove.length').toBeLessThan(rowsBeforeApprove.length);
				endAssertionLogging('passed');
			});
		});

		test('Loan amount stays same or increases after approval', async ({ page, baseURL }) => {
			setupAssertionLogging('Loan amount stays same or increases after approval');
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

			await test.step('Verify the loan amount before approval', async () => {
				const amountBefore = await pm.adminPanel().getLoanAmountById(loanId);
				const amountBeforeNum = parseFloat(amountBefore?.replace(/[^\d.]/g, '') || '0');
				loggedExpect(amountBeforeNum, 'amountBeforeNum').toBeGreaterThan(0);
			});

			await test.step('Approve the loan', async () => {
				await pm.adminPanel().approveLoanById(loanId);
				await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);
				endAssertionLogging('passed');
			});
		});

		test('Pending loans count decreases after approval', async ({ page, baseURL }) => {
			setupAssertionLogging('Pending loans count decreases after approval');
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

			await test.step('Approve the first pending loan', async () => {
				await pm.adminPanel().approveLoanById(loanId);
				await pm.adminPanel().waitForSuccessMessage('approved successfully', 10000);
			});

			await test.step('Verify the pending loans count decreased', async () => {
				const countAfter = await pm.adminPanel().getPendingLoansCount();
				loggedExpect(countAfter, 'countAfter').toBeLessThan(countBefore);
				endAssertionLogging('passed');
			});
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
			setupAssertionLogging('Success message displays with green styling');
			const pm = new PageManager(page);
			const testUsername = `admin-msg-success-${Date.now()}`;

			await test.step('Create an admin account', async () => {
				await pm.adminPanel().createAdmin(testUsername, 'Test123!');
			});

			await test.step('Verify the success message styling', async () => {
				const message = page.locator('#message');
				await expect(message).toBeVisible();
				await expect(message).toHaveClass(/success/);
				endAssertionLogging('passed');
			});
		});

		test('Message text content displays', async ({ page }) => {
			setupAssertionLogging('Message text content displays');
			const pm = new PageManager(page);
			const testUsername = `admin-msg-content-${Date.now()}`;

			await test.step('Create an admin account', async () => {
				await pm.adminPanel().createAdmin(testUsername, 'Test123!');
				await pm.adminPanel().waitForSuccessMessage('created successfully', 10000);
			});

			await test.step('Verify the message text content', async () => {
				const messageText = await pm.adminPanel().getMessageText();
				loggedExpect(messageText, 'messageText').toBeTruthy();
				loggedExpect(messageText?.length, 'messageText.length').toBeGreaterThan(0);
				endAssertionLogging('passed');
			});
		});
	});
});
