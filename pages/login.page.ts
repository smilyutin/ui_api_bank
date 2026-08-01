import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

// Login form interactions using flexible locator strategies.
// Uses LocatorFactory to handle multiple selector fallbacks for robustness.
export class LoginPage extends HelperBase {
	async goto(baseURL: string) {
		await this.page.goto(new URL('/login', baseURL).toString());
	}

	async fillEmail(email: string) {
		// Fill username/email field using fallback locators.
		// Tries test-id first, then placeholder, then name attribute.
		const usernameInput = await LocatorFactory.find(
			this.page.getByTestId('username'),
			this.page.getByPlaceholder(/username/i),
			this.page.locator('input[name="username"]'),
		);
		await usernameInput.fill(email);
		return true;
	}

	async fillPassword(password: string) {
		// Fill password field using fallback locators.
		const passwordInput = await LocatorFactory.find(
			this.page.getByTestId('password'),
			this.page.getByPlaceholder(/password/i),
			this.page.locator('input[name="password"]'),
		);
		await passwordInput.fill(password);
		return true;
	}

	async submit() {
		// Click login button using fallback locators.
		const submitButton = await LocatorFactory.find(
			this.page.getByTestId('login-submit'),
			this.page.getByRole('button', { name: 'Login' }),
			this.page.locator('#loginForm button[type="submit"]'),
		);
		await submitButton.click();
		return true;
	}
}
