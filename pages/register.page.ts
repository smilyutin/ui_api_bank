import { HelperBase } from './helper-base.page';

export class RegisterPage extends HelperBase {
	async goto(baseURL: string) {
		await this.page.goto(new URL('/register', baseURL).toString());
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
		await this.page.locator('#registerForm button[type="submit"]').click();
		return true;
	}
}
