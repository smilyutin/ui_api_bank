import { Page } from '@playwright/test';
import { AdminPanelPage } from './admin-panel.page';
import { DashboardPage } from './dashboard.page';
import { LoansPage } from './loans.page';
import { LoginPage } from './login.page';
import { MoneyTransferPage } from './money-transfer.page';
import { ProfilePage } from './profile.page';
import { RegisterPage } from './register.page';
import { VirtualCardsPage } from './virtual-cards.page';
import { BillPaymentsPage } from './bill-payments.page';

// Central registry for all page objects: instantiates once, provides accessors.
// Specs use PageManager to avoid constructing multiple page object instances.
// See .claude/skills/playwright-vulnerable-bank/SKILL.md for details.
export class PageManager {
	private readonly page: Page;
	private readonly adminPanelPage: AdminPanelPage;
	private readonly dashboardPage: DashboardPage;
	private readonly loansPage: LoansPage;
	private readonly loginPage: LoginPage;
	private readonly moneyTransferPage: MoneyTransferPage;
	private readonly profilePage: ProfilePage;
	private readonly registerPage: RegisterPage;
	private readonly virtualCardsPage: VirtualCardsPage;
	private readonly billPaymentsPage: BillPaymentsPage;

	constructor(page: Page) {
		this.page = page;
		this.adminPanelPage = new AdminPanelPage(page);
		this.dashboardPage = new DashboardPage(page);
		this.loansPage = new LoansPage(page);
		this.loginPage = new LoginPage(page);
		this.moneyTransferPage = new MoneyTransferPage(page);
		this.profilePage = new ProfilePage(page);
		this.registerPage = new RegisterPage(page);
		this.virtualCardsPage = new VirtualCardsPage(page);
		this.billPaymentsPage = new BillPaymentsPage(page);
	}

	public getPage(): Page {
		return this.page;
	}

	// Admin control panel: user management, create admin, pending loans.
	adminPanel() {
		return this.adminPanelPage;
	}

	// Dashboard shell: balance, navigation, transaction list.
	dashboard() {
		return this.dashboardPage;
	}

	// Loan request form and "Your Loan Applications" table.
	loans() {
		return this.loansPage;
	}

	// Login form.
	login() {
		return this.loginPage;
	}

	// Money transfer form.
	moneyTransfer() {
		return this.moneyTransferPage;
	}

	// Profile picture upload/import.
	profile() {
		return this.profilePage;
	}

	// Registration form.
	register() {
		return this.registerPage;
	}

	// Virtual card creation, freeze/unfreeze, limit updates.
	virtualCards() {
		return this.virtualCardsPage;
	}

	// Pay Bill form and bill payment history.
	billPayments() {
		return this.billPaymentsPage;
	}
}
