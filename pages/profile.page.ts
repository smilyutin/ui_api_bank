import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';

export type UploadFile = { name: string; mimeType: string; buffer: Buffer };

export class ProfilePage extends HelperBase {
	async getProfilePictureSrc() {
		return this.page.locator('#profile-picture').getAttribute('src');
	}

	async uploadPicture(file: string | UploadFile) {
		// The dashboard auto-submits the upload form on file input change.
		await this.page.locator('#profile_picture').setInputFiles(file);
	}

	async importFromUrl(imageUrl: string) {
		this.page.once('dialog', (dialog) => dialog.accept(imageUrl));
		await this.page.getByRole('button', { name: /import from url/i }).click();
	}

	async getUploadMessage() {
		return this.page.locator('#upload-message').innerText();
	}

	async waitForUploadMessage(pattern: RegExp, timeout = 7000) {
		await expect(this.page.locator('#upload-message')).toHaveText(pattern, { timeout });
	}

	async waitForProfilePictureSrc(pattern: RegExp, timeout = 7000) {
		await expect(this.page.locator('#profile-picture')).toHaveAttribute('src', pattern, { timeout });
	}
}
