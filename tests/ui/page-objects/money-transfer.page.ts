import { Page } from '@playwright/test';

export class MoneyTransferPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // Fill recipient account number
  async fillRecipient(account: string) {
    // scope to Money Transfer section if present
    const section = this.page.getByRole('heading', { name: /money transfer/i }).first();
    if (await section.count()) {
      const container = section.locator('..');
      const byLabel = container.getByLabel(/recipient account number|recipient/i);
      if (await byLabel.count()) { await byLabel.fill(account); return true; }
      const byPlaceholder = container.getByPlaceholder(/recipient/i);
      if (await byPlaceholder.count()) { await byPlaceholder.fill(account); return true; }
      const input = container.locator('input[name*=recipient], input[name*=account], input[id*=recipient], input[id*=account]');
      if (await input.count()) { await input.first().fill(account); return true; }
    }

    const byLabel = this.page.getByLabel(/recipient account number|recipient/i);
    if (await byLabel.count()) { await byLabel.fill(account); return true; }

    const byPlaceholder = this.page.getByPlaceholder(/recipient/i);
    if (await byPlaceholder.count()) { await byPlaceholder.fill(account); return true; }

    const input = this.page.locator('input[name*=recipient], input[name*=account], input[id*=recipient], input[id*=account]');
    if (await input.count()) { await input.first().fill(account); return true; }

    return false;
  }

  async fillAmount(amount: string) {
    // scope amount to Money Transfer section first
    const section = this.page.getByRole('heading', { name: /money transfer/i }).first();
    if (await section.count()) {
      const container = section.locator('..');
      const byLabel = container.getByLabel(/amount/i);
      if (await byLabel.count()) { await byLabel.fill(amount); return true; }
      const spin = container.getByRole('spinbutton', { name: /amount/i });
      if (await spin.count()) { await spin.fill(amount); return true; }
      const input = container.locator('input[name*=amount], input[id*=amount]');
      if (await input.count()) { await input.first().fill(amount); return true; }
    }

    // fallback to non-ambiguous selectors
    const specific = this.page.locator('input#amount, input[id$="_amount"], input[placeholder*="amount"], input[name="amount"]');
    if (await specific.count()) { await specific.first().fill(amount); return true; }

    const spinGlobal = this.page.getByRole('spinbutton');
    if (await spinGlobal.count() === 1) { await spinGlobal.first().fill(amount); return true; }

    return false;
  }

  async fillDescription(text: string) {
    // scope to Money Transfer section if present
    const section = this.page.getByRole('heading', { name: /money transfer/i }).first();
    if (await section.count()) {
      const container = section.locator('..');
      const byLabel = container.getByLabel(/description/i);
      if (await byLabel.count()) { await byLabel.fill(text); return true; }
      const byPlaceholder = container.getByPlaceholder(/note|description/i);
      if (await byPlaceholder.count()) { await byPlaceholder.fill(text); return true; }
      const input = container.locator('textarea[name*=description], input[name*=description]');
      if (await input.count()) { await input.first().fill(text); return true; }
    }

    // fallback to safer selectors
    const specific = this.page.locator('textarea#description, input#description, textarea[placeholder*="note"], input[placeholder*="note"]');
    if (await specific.count()) { await specific.first().fill(text); return true; }

    return false;
  }

  async submit() {
    const btn = this.page.getByRole('button', { name: /send money|send|transfer/i });
    if (await btn.count()) { await btn.first().click(); return true; }

    const fallback = this.page.locator('button:has-text("Send Money")');
    if (await fallback.count()) { await fallback.first().click(); return true; }

    return false;
  }

  // Wait for success indicator: success toast or transaction appearing
  async waitForSuccess(amount: string, timeout = 5000) {
    // Try common success messages
    const successMsgs = [ /transfer successful/i, /transfer completed/i, /sent/i, /success/i ];
    for (const rx of successMsgs) {
      try {
        await this.page.waitForSelector(`text=${rx}`, { timeout, state: 'visible' });
        return true;
      } catch {}
    }

    // Fallback: wait for transaction history to contain the amount
    try {
      await this.page.waitForSelector(`text=${amount}`, { timeout });
      return true;
    } catch {}

    return false;
  }
}
