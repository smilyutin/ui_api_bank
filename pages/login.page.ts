import { HelperBase } from './helper-base.page';

export class LoginPage extends HelperBase {
	async goto(baseURL: string) {
		await this.page.goto(new URL('/login', baseURL).toString());
	}

	async fillEmail(email: string) {
		await this.page.locator('input[name="username"]').fill(email);
		return true;
	}

	async fillPassword(password: string) {
		await this.page.locator('input[name="password"]').fill(password);
		return true;
	}

	async submit() {
		await this.page.locator('#loginForm button[type="submit"]').click();
		return true;
	}
}
