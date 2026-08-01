import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

export type LoanRow = { amount: string; status: string };

// Loan request form: submit requests and verify pending loans.
export class LoansPage extends HelperBase {
	async fillAmount(amount: string) {
		const amountInput = await LocatorFactory.find(
			this.page.getByTestId('loan-amount'),
			this.page.getByLabel('Loan Amount'),
			this.page.locator('#loan_amount'),
		);
		await amountInput.fill(amount);
	}

	async submit() {
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('loan-submit'),
			this.page.getByRole('button', { name: 'Submit Loan Request' }),
			this.page.locator('#loanForm button[type="submit"]'),
		);
		await submitButton.click();
	}

	async getMessage() {
		return this.page.locator('#message').innerText();
	}

	async waitForMessage(pattern: RegExp, timeout = 7000) {
		await expect(this.page.locator('#message')).toHaveText(pattern, { timeout });
	}

	async getLoanRows(): Promise<LoanRow[]> {
		// Parse all loan rows in the pending loans table: amount and status columns.
		const rows = this.page.locator('.loans-section tbody tr');
		const count = await rows.count();
		const out: LoanRow[] = [];
		for (let i = 0; i < count; i++) {
			const cells = rows.nth(i).locator('td');
			const amount = (await cells.nth(0).innerText()).trim();
			const status = (await cells.nth(1).innerText()).trim();
			out.push({ amount, status });
		}
		return out;
	}

	async waitForLoanRow(amount: string, statusPattern: RegExp, timeout = 7000) {
		// Wait for a loan to appear in the table with matching amount and status.
		const row = this.page
			.locator('.loans-section tbody tr')
			.filter({ hasText: amount })
			.filter({ hasText: statusPattern });
		await expect(row.first()).toBeVisible({ timeout });
	}
}
