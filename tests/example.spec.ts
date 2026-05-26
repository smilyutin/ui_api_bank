import { test, expect } from '@playwright/test';

test.describe('Vulnerable Bank smoke checks', () => {
  test('home page renders and primary links work', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('.bank-logo')).toBeVisible();
    await expect(page).toHaveTitle(/Vulnerable Bank/i);
    await expect(page.getByRole('banner').getByText('Vulnerable Bank')).toBeVisible();

    await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /register/i })).toBeVisible();

    const apiDocs = page.getByRole('link', { name: /api docs/i });
    await expect(apiDocs).toBeVisible();
    await Promise.all([
      page.waitForURL('**/api/docs**'),
      apiDocs.click(),
    ]);
    await expect(page.locator('#swagger-ui')).toBeVisible();
  });
});
