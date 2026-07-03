---
name: playwright-vulnerable-bank
description: Create or update Playwright TypeScript automation tests for the Vulnerable Bank application, including UI, API, page object, fixture, and test-data workflows for one feature at a time.
---

# Playwright Automation Tests for Vulnerable Bank

Create maintainable Playwright automation tests in TypeScript for the Vulnerable Bank application, one feature at a time.

## Project Conventions

- Keep reusable page interactions in `pages/`.
- Keep API helpers, schemas, and request fixtures in `fixtures/api/`.
- Keep shared test helpers in `helpers/`.
- Keep persisted fixture data in `test-data/`.
- Keep UI specs in `tests/ui/specs/`.
- Keep API specs in `tests/api/`.
- Keep security-oriented reporting in `fixtures/helper/`.

## Test Design

- Make each test cover one business function.
- Keep tests independent and runnable alone or in parallel.
- Use Arrange, Act, Assert structure.
- Prepare data through helpers or APIs when possible.
- Verify the user-visible result and any relevant API or data-state result.
- Avoid test dependencies on execution order.

## Playwright Practices

Use:

- Playwright Test Runner.
- TypeScript.
- Page Object Model where it reduces duplication.
- Fixtures for shared setup.
- Stable locators and test ids when available.
- Auto-waiting and web-first assertions.
- `async` / `await`.
- Descriptive test names and variable names.

Avoid:

- Hard-coded waits.
- XPath unless no stable alternative exists.
- CSS selectors when test ids exist.
- Duplicate setup code.
- Monolithic end-to-end tests that validate multiple business operations.
- `networkidle` readiness checks for dashboard flows.

## Page Object Rules

Page objects should contain only:

- Locators.
- Page actions.
- Page verifications.

Do not put test flow or business assertions that belong to a spec inside a page object.

Use `HelperBase` as the parent class for page objects when creating or updating page object files. `HelperBase` owns the shared `Page` instance and common page-level helper methods.

Example:

```ts
import { Page } from '@playwright/test';

export class HelperBase {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async waitForNumberOfSeconds(timeInSeconds: number) {
    await this.page.waitForTimeout(timeInSeconds * 500);
  }
}
```

Keep locators inside the functional methods that use them instead of defining locator fields in the constructor. This keeps the page object easier to debug, fix, and maintain because each method shows the elements it interacts with directly.

Example:

```ts
export class LoginPage extends HelperBase {
  constructor(page: Page) {
    super(page);
  }

  async login(username: string, password: string) {
    await this.page.getByTestId('username').fill(username);
    await this.page.getByTestId('password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
  }

  async verifyLoginSuccessful() {
    await expect(this.page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  }
}
```

Use `waitForNumberOfSeconds` only when a test explicitly needs a fixed wait for demonstration, debugging, or an application behavior that cannot be asserted directly. Prefer Playwright auto-waiting and web-first assertions for normal test readiness.

## Page Manager

Use a page manager to remove repeated page object construction inside tests.

- Create one page manager class that receives `Page` in its constructor.
- Initialize all page object instances in that constructor.
- Store those instances in private readonly fields.
- Expose individual methods that return each page instance.
- In specs, create one page manager and interact with page objects through it.

Example:

```ts
class PageManager {
  private readonly loginPage: LoginPage;
  private readonly dashboardPage: DashboardPage;

  constructor(page: Page) {
    this.loginPage = new LoginPage(page);
    this.dashboardPage = new DashboardPage(page);
  }

  login() {
    return this.loginPage;
  }

  dashboard() {
    return this.dashboardPage;
  }
}

test('User can log in', async ({ page }) => {
  const pages = new PageManager(page);

  await pages.login().login(username, password);
  await pages.dashboard().verifyLoaded();
});
```

## Assertions

Prefer Playwright assertions:

```ts
await expect(locator).toBeVisible();
```

Avoid manually checking locator state:

```ts
expect(await locator.isVisible()).toBe(true);
```

## Test Data

- Do not hardcode business data when uniqueness matters.
- Generate unique usernames, emails, account names, and dynamic dates through helpers.
- Reuse authentication with Playwright `storageState` when a workflow does not specifically test login.
- Create or clean up data through API helpers when that makes the UI test smaller and more reliable.
