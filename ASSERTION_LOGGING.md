# Enhanced Assertion Logging Guide

This guide explains how to use the enhanced assertion logging system in the Playwright test suite. The system provides detailed context for every assertion, showing exact values, expected vs. actual, user information, and UI state.

## Features

- **Exact Values**: Displays actual and expected values for every assertion
- **User Context**: Shows who is logged in, what password was used (masked)
- **UI State**: Displays the current UI state and important actions
- **Detailed Errors**: Shows specific error messages with full context
- **Visual Reports**: Color-coded output with clear formatting

## Basic Usage

### 1. Setup and Teardown with Context

Every test should start with `setupAssertionLogging()` and end with `endAssertionLogging()`:

```typescript
test('should login successfully', async ({ baseURL }) => {
  setupAssertionLogging('should login successfully');
  
  // Your test code here
  
  endAssertionLogging('passed'); // or 'failed', 'skipped'
});
```

### 2. Setting Test Context

Use `setTestContext()` to track user information, URLs, passwords, and UI state:

```typescript
import { setTestContext } from '../../../helpers/expect-logger';

const user = findOrCreateUser('test-user');

setTestContext({
  user: { 
    username: user.username, 
    email: user.email, 
    role: 'user' 
  },
  url: baseURL,
  password: '***' + user.password.slice(-4), // Last 4 chars only
  action: 'login_with_valid_credentials',
});
```

### 3. Using Enhanced Assertions

Replace `expect()` with `loggedExpect()` for detailed logging:

```typescript
import { loggedExpect } from '../../../helpers/expect-logger';

// Old way
await expect(page).toHaveURL(/\/dashboard/);

// New way - shows actual vs expected
await loggedExpect(page, 'page URL').toHaveURL(/\/dashboard/);
```

The second parameter is a description that will be logged.

### 4. Context Information to Track

Common context values to include:

```typescript
setTestContext({
  // User identification
  user: {
    username: 'john.doe',
    email: 'john@example.com',
    role: 'admin' // or 'user', 'guest', etc.
  },
  
  // URL and navigation
  url: 'http://localhost:5001',
  
  // Credentials (last 4 chars only for security)
  password: '***1234',
  apiToken: 'token_***abc',
  
  // Current UI/app state
  uiState: 'dashboard_loaded',
  
  // Action being performed
  action: 'transfer_money',
  
  // Expected behavior
  expectedBehavior: 'success_and_redirect',
  
  // Validation errors
  validationError: 'amount_exceeds_balance',
  
  // Business rules
  businessRule: 'daily_limit_exceeded',
  
  // Security-related
  securityCheck: 'csrf_token_validated',
});
```

## Example: Complete Login Test

```typescript
import { test } from '@playwright/test';
import { PageManager } from '../../../pages/page-manager';
import { findOrCreateUser } from '../../../helpers/credentials';
import { loginViaAvailableFlow } from '../../../fixtures/api/login.helpers';
import { 
  loggedExpect, 
  setupAssertionLogging, 
  endAssertionLogging, 
  setTestContext 
} from '../../../helpers/expect-logger';

test('should login successfully with valid credentials', async ({ baseURL }) => {
  setupAssertionLogging('should login successfully with valid credentials');
  
  if (!baseURL) throw new Error('baseURL is not defined');

  const user = findOrCreateUser('login-ui');
  
  // Set context before login attempt
  setTestContext({
    user: { username: user.username, email: user.email, role: 'user' },
    url: baseURL,
    password: '***' + user.password.slice(-4),
    action: 'login_with_valid_credentials',
  });

  // API setup
  const api = await request.newContext({ baseURL: baseURL.toString() });
  await loginViaAvailableFlow(api, user);
  await api.dispose();

  // UI login
  const pm = new PageManager(page);
  const login = pm.login();
  const identifier = user.username || user.email;

  await login.goto(baseURL);
  await login.fillEmail(identifier);
  await login.fillPassword(user.password);
  await login.submit();

  // Update context after login
  setTestContext({ uiState: 'dashboard_loaded', authenticated: true });

  // Assertions with detailed logging
  await pm.dashboard().waitForLoad();
  await loggedExpect(pm.dashboard().page, 'dashboard URL')
    .toHaveURL(/\/dashboard/i);

  endAssertionLogging('passed');
});
```

## Assertion Methods Supported

All standard Playwright assertions are supported with detailed logging:

- `toBe(value)` - Exact equality
- `toEqual(value)` - Deep equality
- `toContain(value)` - Array/string contains
- `toMatch(regex)` - String regex match
- `toHaveProperty(prop, value)` - Object property check
- `toHaveLength(length)` - Array/string length
- `toBeTruthy()` - Truthy check
- `toBeFalsy()` - Falsy check
- `toBeDefined()` - Defined check
- `toBeNull()` - Null check
- `toBeGreaterThan(num)` - Numeric comparison
- `toBeGreaterThanOrEqual(num)` - Numeric comparison
- `toBeLessThan(num)` - Numeric comparison
- `toBeLessThanOrEqual(num)` - Numeric comparison
- `toStrictEqual(value)` - Strict equality

## Output Format

### Test Header
```
╔════════════════════════════════════════════════════════════════╗
║ TEST: should login successfully with valid credentials       ║
╚════════════════════════════════════════════════════════════════╝
```

### Assertion Output
```
  [1] expect(dashboard URL).toHaveURL(/\/dashboard/i)
      Actual: "http://localhost:5001/dashboard" | Expected: /\/dashboard/i
  User: john.doe (user)
  URL: http://localhost:5001
  UI State: dashboard_loaded
```

### Failed Assertion Output
```
  ✗ [2] expect(balance text).toContain("$5,000")
      Actual: "$4,500" | Expected: "$5,000"
      Context: user=john.doe, action=check_balance, expectedBehavior=show_correct_balance
      Error: expect(string).toContain(expected)
```

### Summary Report
```
✓ PASSED

┌─ Assertion Summary (5 total) ─┐
  ✓ [1] dashboard URL: toHaveURL
  ✓ [2] balance text: toContain
  ✓ [3] transfer button: toBeTruthy
  ✓ [4] confirmation text: toMatch
  ✓ [5] transaction ID: toBeDefined
└────────────────────────────────┘
```

## Best Practices

1. **Be Specific with Descriptions**
   ```typescript
   // Good
   loggedExpect(balanceText, 'current_account_balance').toContain('$5,000');
   
   // Avoid
   loggedExpect(balanceText).toContain('$5,000');
   ```

2. **Update Context Throughout Test**
   ```typescript
   setTestContext({ action: 'fill_transfer_form' });
   // ... fill form ...
   
   setTestContext({ action: 'submit_transfer', uiState: 'processing' });
   // ... submit ...
   
   setTestContext({ uiState: 'success', transactionId: '12345' });
   // ... assertions ...
   ```

3. **Mask Sensitive Information**
   ```typescript
   // Correct - only show last 4 chars
   password: '***' + user.password.slice(-4);
   
   // Incorrect - exposes full password
   password: user.password;
   ```

4. **Group Related Assertions**
   ```typescript
   // Test one business function
   test('should transfer money between accounts', async () => {
     setupAssertionLogging('should transfer money between accounts');
     
     setTestContext({ action: 'transfer_setup' });
     // ... setup ...
     
     setTestContext({ action: 'enter_transfer_details' });
     // ... enter amount, recipient ...
     // ... assertions on form validation ...
     
     setTestContext({ action: 'submit_transfer' });
     // ... submit ...
     // ... assertions on success ...
     
     endAssertionLogging('passed');
   });
   ```

5. **Use Consistent Context Keys**
   ```typescript
   // Standard keys to use across all tests
   user.username, user.email, user.role
   url, password, apiToken
   action, uiState, expectedBehavior
   validationError, businessRule, securityCheck
   ```

## Reporter Configuration

The reporter is configured in `playwright.config.ts`:

```typescript
reporter: [
  ['html'],
  ['./reporters/assertion-logger-reporter.ts'],
],
```

Run tests and view the detailed report:

```bash
npm test
npx playwright show-report
```

## Troubleshooting

### Assertions Not Showing Values

If you see assertions without actual/expected values, check that:
1. You're using `loggedExpect()` not plain `expect()`
2. The second parameter (description) is provided
3. The assertion error is being captured correctly

### Context Not Appearing

If context isn't showing up:
1. Make sure `setTestContext()` is called before the assertion
2. Verify the context object keys are spelled correctly
3. Check that sensitive data is properly masked

### Missing Test Output

If you don't see detailed logging:
1. Verify `setupAssertionLogging()` is called at test start
2. Ensure `endAssertionLogging()` is called at test end
3. Run tests with `-v` flag: `npx playwright test -v`
4. Check test output in terminal or HTML report

## Integration with CI/CD

The enhanced assertion logging integrates with Playwright's HTML report. Failed tests show detailed context in the "Steps" section, making it easier to debug issues in CI/CD pipelines.

See `.github/workflows/playwright.yml` for how tests are run in CI.
