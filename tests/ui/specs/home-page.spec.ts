import { test, expect } from '@playwright/test';

test.describe('@smoke Vulnerable Bank smoke checks', () => {
  test('home page renders and primary links work', async ({ page }) => {
    await test.step('Load the home page', async () => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveTitle(/Vulnerable Bank/i);
      await expect(page.getByRole('banner').getByText('Vulnerable Bank')).toBeVisible();
    });

    await test.step('Verify primary navigation links are present', async () => {
      await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /register/i })).toBeVisible();
    });

    await test.step('Navigate to API docs and verify it loads', async () => {
      const apiDocs = page.getByRole('link', { name: /api docs/i });
      await expect(apiDocs).toBeVisible();
      await Promise.all([
        page.waitForURL('**/api/docs**'),
        apiDocs.click(),
      ]);
      await expect(page.locator('#swagger-ui')).toBeVisible();
    });
  });
});
