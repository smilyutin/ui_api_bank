import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

export class LoginPage extends HelperBase {
	async goto(baseURL: string) {
		await this.page.goto(new URL('/login', baseURL).toString());
	}

	async fillEmail(email: string) {
		const usernameInput = await LocatorFactory.find(
			this.page.getByTestId('username'),
			this.page.getByPlaceholder(/username/i),
			this.page.locator('input[name="username"]'),
		);
		await usernameInput.fill(email);
		return true;
	}

	async fillPassword(password: string) {
		const passwordInput = await LocatorFactory.find(
			this.page.getByTestId('password'),
			this.page.getByPlaceholder(/password/i),
			this.page.locator('input[name="password"]'),
		);
		await passwordInput.fill(password);
		return true;
	}

	async submit() {
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('login-submit'),
			this.page.getByRole('button', { name: 'Login' }),
			this.page.locator('#loginForm button[type="submit"]'),
		);
		await submitButton.click();
		return true;
	}
}
