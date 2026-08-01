import { Page, expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';

// Admin panel control interface for managing users and loans.
// Provides table navigation, form interactions, and message verification
// for the /sup3r_s3cr3t_admin endpoint.
export class AdminPanelPage extends HelperBase {
	constructor(page: Page) {
		super(page);
	}

	async goto(baseURL: string) {
		await this.page.goto(`${baseURL}/sup3r_s3cr3t_admin`);
	}

	async waitForLoad() {
		// Wait for the admin panel heading and first table (user management) to render.
		// Network requests may be in flight; we poll the actual DOM elements, not networkidle.
		await expect(this.page.getByRole('heading', { name: /Admin Control Panel/i })).toBeVisible({
			timeout: 10000,
		});
		await expect(this.page.locator('table').first()).toBeVisible({ timeout: 10000 });
	}

	// User management table: navigate rows, fetch user data, delete accounts
	async getUserTableRows() {
		return await this.page.locator('table').first().locator('tbody tr').all();
	}

	async getUserCount() {
		return (await this.getUserTableRows()).length;
	}

	async deleteUserByRowIndex(rowIndex: number) {
		const rows = await this.getUserTableRows();
		if (rowIndex >= rows.length) throw new Error(`Row index ${rowIndex} out of bounds`);

		const row = rows[rowIndex];
		const deleteForm = row.locator('form.delete-account-form');
		const deleteButton = deleteForm.getByRole('button', { name: /Delete/i });
		await deleteButton.click();
	}

	async deleteUserById(userId: number) {
		const deleteForm = this.page.locator(`form[data-user-id="${userId}"]`);
		const deleteButton = deleteForm.getByRole('button', { name: /Delete/i });
		try {
			await deleteButton.click({ timeout: 5000 });
		} catch {
			throw new Error(`Could not find delete button for user ${userId}`);
		}
	}

	// Admin account creation via form submission
	async fillCreateAdminForm(username: string, password: string) {
		await this.page.locator('#admin_username').fill(username);
		await this.page.locator('#admin_password').fill(password);
	}

	async submitCreateAdminForm() {
		await this.page.getByRole('button', { name: /Create Admin/i }).click();
	}

	async createAdmin(username: string, password: string) {
		await this.fillCreateAdminForm(username, password);
		await this.submitCreateAdminForm();
	}

	async isCreateAdminFormVisible() {
		return await this.page.locator('#createAdminForm').isVisible();
	}

	// Pending loans table: navigate rows, approve loans, extract loan amounts and status
	async getPendingLoansTableRows() {
		return await this.page.locator('[data-testid="pending-loans-table"]').locator('tbody tr').all();
	}

	async getPendingLoansCount() {
		return (await this.getPendingLoansTableRows()).length;
	}

	async approveLoanByRowIndex(rowIndex: number) {
		const rows = await this.getPendingLoansTableRows();
		if (rowIndex >= rows.length) throw new Error(`Loan row index ${rowIndex} out of bounds`);

		const row = rows[rowIndex];
		const approveForm = row.locator('form.approve-loan-form');
		const approveButton = approveForm.getByRole('button', { name: /Approve/i });
		await approveButton.click();
	}

	async approveLoanById(loanId: number) {
		const approveForm = this.page.locator(`form[data-loan-id="${loanId}"]`);
		const approveButton = approveForm.getByRole('button', { name: /Approve/i });
		await approveButton.click();
	}

	async getLoanAmountByRowIndex(rowIndex: number): Promise<string | null> {
		// Extract amount from third column (index 2) of pending loans table row.
		const rows = await this.getPendingLoansTableRows();
		if (rowIndex >= rows.length) return null;

		const row = rows[rowIndex];
		const cells = await row.locator('td').all();
		if (cells.length < 3) return null;
		return await cells[2].textContent();
	}

	async getLoanAmountById(loanId: number): Promise<string | null> {
		const loanRow = this.page.locator(`[data-loan-id="${loanId}"]`).locator('xpath=ancestor::tr');
		const cells = await loanRow.locator('td').all();
		if (cells.length < 3) return null;
		return await cells[2].textContent();
	}

	async getLoanStatusByRowIndex(rowIndex: number): Promise<string | null> {
		const rows = await this.getPendingLoansTableRows();
		if (rowIndex >= rows.length) return null;

		const row = rows[rowIndex];
		const cells = await row.locator('td').all();
		if (cells.length < 4) return null;
		return await cells[3].textContent();
	}

	// Message Feedback Actions
	async getMessageText() {
		const message = this.page.locator('#message');
		return await message.textContent();
	}

	async isMessageVisible() {
		const message = this.page.locator('#message');
		return await message.isVisible();
	}

	async waitForSuccessMessage(expectedText?: string, timeout = 5000) {
		// Verify success feedback message and optionally check for specific text.
		const message = this.page.locator('#message');
		await expect(message).toBeVisible({ timeout });
		if (expectedText) {
			await expect(message).toContainText(expectedText);
		}
		await expect(message).toHaveClass(/success/);
	}

	async waitForErrorMessage(expectedText?: string, timeout = 5000) {
		// Verify error feedback message and optionally check for specific text.
		const message = this.page.locator('#message');
		await expect(message).toBeVisible({ timeout });
		if (expectedText) {
			await expect(message).toContainText(expectedText);
		}
		await expect(message).toHaveClass(/error/);
	}

	// Page navigation: back to dashboard, logout
	async navigateBackToDashboard() {
		await this.page.getByRole('link', { name: /Back to Dashboard/i }).click();
	}

	async logout() {
		await this.page.getByRole('link', { name: /Logout/i }).click();
	}

	// Visibility and state checks: tables, messages, page elements
	async isUserManagementTableVisible() {
		return await this.page.locator('table').first().isVisible();
	}

	async isPendingLoansTableVisible() {
		const tables = await this.page.locator('table').all();
		return tables.length >= 2 && (await tables[1].isVisible());
	}

	async getUsernameInTable(rowIndex: number): Promise<string | null> {
		const rows = await this.getUserTableRows();
		if (rowIndex >= rows.length) return null;
		const row = rows[rowIndex];
		const cells = await row.locator('td').all();
		if (cells.length < 2) return null;
		return await cells[1].textContent();
	}

	async getUserIdInTable(rowIndex: number): Promise<string | null> {
		const rows = await this.getUserTableRows();
		if (rowIndex >= rows.length) return null;
		const row = rows[rowIndex];
		const cells = await row.locator('td').all();
		if (cells.length < 1) return null;
		return await cells[0].textContent();
	}

	getProfilePicture() {
		return this.page.locator('img.profile-picture');
	}

	async isProfilePictureVisible() {
		return await this.getProfilePicture().isVisible();
	}

	async getPageTitle() {
		return await this.page.title();
	}

	async getAdminHeaderText() {
		return await this.page.getByRole('heading', { name: /Admin Control Panel/i }).textContent();
	}
}
