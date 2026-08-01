import { expect } from '@playwright/test';
import { HelperBase } from './helper-base.page';
import { LocatorFactory } from './locator-factory';

export type UploadFile = { name: string; mimeType: string; buffer: Buffer };

// User profile: upload/import profile pictures and verify upload success.
export class ProfilePage extends HelperBase {
	async getProfilePictureSrc() {
		return this.page.locator('#profile-picture').getAttribute('src');
	}

	async uploadPicture(file: string | UploadFile) {
		// Upload picture file. The dashboard auto-submits the form on file input change.
		const fileInput = await LocatorFactory.find(
			this.page.getByTestId('profile-picture-upload'),
			this.page.locator('#profile_picture'),
		);
		await fileInput.setInputFiles(file);
	}

	async importFromUrl(imageUrl: string) {
		// Import picture from URL. Handles the URL prompt dialog.
		this.page.once('dialog', (dialog) => dialog.accept(imageUrl));
		const importButton = await LocatorFactory.find(
			this.page.getByTestId('import-picture-url'),
			this.page.getByRole('button', { name: /import from url/i }),
		);
		await importButton.click();
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
