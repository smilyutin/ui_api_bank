import { Page, expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';

export class AdminPanelPage extends HelperBase {
	constructor(page: Page) {
		super(page);
	}

	async goto(baseURL: string) {
		await this.page.goto(`${baseURL}/sup3r_s3cr3t_admin`);
	}

	async waitForLoad() {
		await expect(this.page.getByRole('heading', { name: /Admin Control Panel/i })).toBeVisible({
			timeout: 10000,
		});
		await expect(this.page.locator('table').first()).toBeVisible({ timeout: 10000 });
	}

	// User Management Table Actions
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
		await deleteButton.click();
	}

	// Create Admin Form Actions
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

	// Pending Loans Table Actions
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
		const message = this.page.locator('#message');
		await expect(message).toBeVisible({ timeout });
		if (expectedText) {
			await expect(message).toContainText(expectedText);
		}
		await expect(message).toHaveClass(/success/);
	}

	async waitForErrorMessage(expectedText?: string, timeout = 5000) {
		const message = this.page.locator('#message');
		await expect(message).toBeVisible({ timeout });
		if (expectedText) {
			await expect(message).toContainText(expectedText);
		}
		await expect(message).toHaveClass(/error/);
	}

	// Navigation Actions
	async navigateBackToDashboard() {
		await this.page.getByRole('link', { name: /Back to Dashboard/i }).click();
	}

	async logout() {
		await this.page.getByRole('link', { name: /Logout/i }).click();
	}

	// Verification Methods
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
