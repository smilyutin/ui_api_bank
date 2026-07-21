import { DashboardPage } from './dashboard.page';
import { LoginPage } from './login.page';
import { MoneyTransferPage } from './money-transfer.page';

/**
 * Analogous to pages/page-manager.ts: owns one instance of every mobile page
 * object and hands them out through accessor methods. WebdriverIO sessions
 * are process-global, so unlike the Playwright PageManager there's no `Page`
 * to hold or pass into constructors.
 */
export class MobilePageManager {
	private readonly loginPage = new LoginPage();
	private readonly dashboardPage = new DashboardPage();
	private readonly moneyTransferPage = new MoneyTransferPage();

	login() {
		return this.loginPage;
	}

	dashboard() {
		return this.dashboardPage;
	}

	moneyTransfer() {
		return this.moneyTransferPage;
	}
}
