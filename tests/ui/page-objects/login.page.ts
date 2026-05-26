import { Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(baseURL: string) {
    await this.page.goto(new URL('/login', baseURL).toString());
  }

  async fillEmail(email: string) {
    // Try label
    const byLabel = this.page.getByLabel(/email|username/i);
    if (await byLabel.count() > 0) { await byLabel.fill(email); return true; }

    // role/name
    const byRole = this.page.getByRole('textbox', { name: /email|username/i });
    if (await byRole.count() > 0) { await byRole.fill(email); return true; }

    // placeholder
    const byPlaceholder = this.page.getByPlaceholder(/email|username/i);
    if (await byPlaceholder.count() > 0) { await byPlaceholder.fill(email); return true; }

    // input attributes
    const input = this.page.locator('input[type="email"], input[name*=email], input[id*=email], input[name*=user], input[id*=user]');
    if (await input.count() > 0) { await input.first().fill(email); return true; }

    return false;
  }

  async fillPassword(password: string) {
    const byLabel = this.page.getByLabel(/password/i);
    if (await byLabel.count() > 0) { await byLabel.fill(password); return true; }

    const byPlaceholder = this.page.getByPlaceholder(/password/i);
    if (await byPlaceholder.count() > 0) { await byPlaceholder.fill(password); return true; }

    const input = this.page.locator('input[type="password"], input[name*=password], input[id*=password]');
    if (await input.count() > 0) { await input.first().fill(password); return true; }

    return false;
  }

  async submit() {
    // Try common button names
    const btn = this.page.getByRole('button', { name: /log ?in|sign ?in|submit|enter/i });
    if (await btn.count() > 0) { await btn.first().click(); return true; }

    const submit = this.page.locator('button[type="submit"]');
    if (await submit.count() > 0) { await submit.first().click(); return true; }

    // fallback: any button
    const anyBtn = this.page.locator('button');
    if (await anyBtn.count() > 0) { await anyBtn.first().click(); return true; }

    return false;
  }
}
