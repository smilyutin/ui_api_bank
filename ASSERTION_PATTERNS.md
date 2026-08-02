# Common Assertion Patterns with Enhanced Logging

This guide shows common assertion patterns used throughout the test suite with the enhanced logging system.

## 1. URL Navigation Assertions

### Pattern: Verify page navigation
```typescript
test('should redirect to dashboard after login', async ({ baseURL }) => {
  setupAssertionLogging('should redirect to dashboard after login');
  
  setTestContext({
    user: { username: 'john.doe', email: 'john@example.com' },
    action: 'login_and_verify_redirect'
  });
  
  // ... perform login ...
  
  setTestContext({ uiState: 'expecting_dashboard' });
  await loggedExpect(page, 'dashboard URL after login')
    .toHaveURL(/\/dashboard(?:[?#].*)?$/i);
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(dashboard URL after login).toHaveURL(/\/dashboard(?:[?#].*)?$/i)
      Actual: "http://localhost:5001/dashboard" | Expected: /\/dashboard(?:[?#].*)?$/i
      Context: user=john.doe, action=login_and_verify_redirect, uiState=expecting_dashboard
```

## 2. Text Content Assertions

### Pattern: Verify element contains expected text
```typescript
test('should display welcome message', async ({ page, baseURL }) => {
  setupAssertionLogging('should display welcome message');
  
  const user = findOrCreateUser('test-user');
  setTestContext({
    user: { username: user.username },
    action: 'check_welcome_message'
  });
  
  // ... navigate and login ...
  
  const welcomeText = await page.locator('.welcome-message').textContent();
  await loggedExpect(welcomeText, 'welcome message text')
    .toContain(`Welcome, ${user.username}`);
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(welcome message text).toContain("Welcome, john.doe")
      Actual: "Welcome, john.doe! You have 3 messages." | Expected: "Welcome, john.doe"
      Context: user=john.doe, action=check_welcome_message
```

## 3. Numeric Comparisons

### Pattern: Verify account balance
```typescript
test('should show correct account balance', async ({ baseURL }) => {
  setupAssertionLogging('should show correct account balance');
  
  const expectedBalance = 5000;
  setTestContext({
    user: { username: 'john.doe', role: 'user' },
    action: 'verify_account_balance',
    expectedBalance
  });
  
  // ... navigate to account page ...
  
  const balanceText = await page.locator('[data-testid="balance"]').textContent();
  const balance = parseFloat(balanceText?.replace('$', '') || '0');
  
  setTestContext({ actualBalance: balance, uiState: 'balance_displayed' });
  
  await loggedExpect(balance, 'account balance').toBe(expectedBalance);
  await loggedExpect(balance, 'balance not negative').toBeGreaterThanOrEqual(0);
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(account balance).toBe(5000)
      Actual: 5000 | Expected: 5000
      Context: user=john.doe, expectedBalance=5000, actualBalance=5000
      
  [2] expect(balance not negative).toBeGreaterThanOrEqual(0)
      Actual: 5000 | Expected: 0
      Context: user=john.doe, actualBalance=5000
```

## 4. Array/List Assertions

### Pattern: Verify list of transactions
```typescript
test('should list all recent transactions', async ({ page }) => {
  setupAssertionLogging('should list all recent transactions');
  
  const expectedTransactionCount = 5;
  setTestContext({
    user: { username: 'john.doe' },
    action: 'view_transaction_history',
    expectedCount: expectedTransactionCount
  });
  
  // ... navigate to transactions ...
  
  const transactions = await page.locator('[data-testid="transaction-row"]').all();
  
  setTestContext({ actualCount: transactions.length, uiState: 'transactions_loaded' });
  
  await loggedExpect(transactions.length, 'transaction count')
    .toBe(expectedTransactionCount);
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(transaction count).toBe(5)
      Actual: 5 | Expected: 5
      Context: user=john.doe, expectedCount=5, actualCount=5
```

## 5. Element Visibility Assertions

### Pattern: Verify element is visible
```typescript
test('should show submit button when form is ready', async ({ page }) => {
  setupAssertionLogging('should show submit button when form is ready');
  
  setTestContext({
    action: 'fill_form_and_verify_submit',
    uiState: 'form_being_filled'
  });
  
  // ... fill form ...
  
  const submitButton = page.locator('button[type="submit"]');
  setTestContext({ uiState: 'form_complete' });
  
  await loggedExpect(submitButton, 'submit button visibility')
    .toBeVisible();
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(submit button visibility).toBeVisible()
      Context: action=fill_form_and_verify_submit, uiState=form_complete
```

## 6. Boolean/State Assertions

### Pattern: Verify authentication state
```typescript
test('should mark user as authenticated after login', async ({ page }) => {
  setupAssertionLogging('should mark user as authenticated after login');
  
  const user = findOrCreateUser('test-user');
  setTestContext({
    user: { username: user.username },
    action: 'verify_auth_state'
  });
  
  // ... perform login ...
  
  setTestContext({ uiState: 'post_login' });
  
  // Check auth token exists
  const authToken = await page.evaluate(() => 
    localStorage.getItem('auth_token')
  );
  
  setTestContext({ hasAuthToken: !!authToken });
  
  await loggedExpect(!!authToken, 'auth token exists')
    .toBeTruthy();
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(auth token exists).toBeTruthy()
      Actual: true | Expected: truthy
      Context: user=john.doe, hasAuthToken=true
```

## 7. Regex Pattern Matching

### Pattern: Verify email format
```typescript
test('should display valid email format', async ({ page }) => {
  setupAssertionLogging('should display valid email format');
  
  setTestContext({
    action: 'verify_email_display',
    uiState: 'viewing_profile'
  });
  
  const emailText = await page.locator('[data-testid="user-email"]').textContent();
  const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  setTestContext({ displayedEmail: emailText });
  
  await loggedExpect(emailText || '', 'email format')
    .toMatch(emailPattern);
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(email format).toMatch(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      Actual: "john.doe@example.com" | Expected: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      Context: action=verify_email_display, displayedEmail=john.doe@example.com
```

## 8. Null/Undefined Assertions

### Pattern: Verify error state
```typescript
test('should show error when data fails to load', async ({ page }) => {
  setupAssertionLogging('should show error when data fails to load');
  
  setTestContext({
    action: 'trigger_data_load_failure',
    expectedBehavior: 'show_error_message'
  });
  
  // ... trigger error scenario ...
  
  setTestContext({ uiState: 'error_state' });
  
  const errorMessage = await page.locator('[data-testid="error-message"]')
    .textContent()
    .catch(() => null);
  
  await loggedExpect(errorMessage, 'error message is not null')
    .not.toBeNull();
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(error message is not null).not.toBeNull()
      Actual: "Failed to load data" | Expected: not.null
      Context: action=trigger_data_load_failure, uiState=error_state
```

## 9. Object Property Assertions

### Pattern: Verify user object properties
```typescript
test('should return user object with required fields', async ({ request, baseURL }) => {
  setupAssertionLogging('should return user object with required fields');
  
  setTestContext({
    action: 'fetch_user_profile',
    url: baseURL
  });
  
  const response = await request.get(`${baseURL}/api/user/profile`);
  const userData = await response.json();
  
  setTestContext({ userId: userData.id, userEmail: userData.email });
  
  await loggedExpect(userData, 'user object')
    .toHaveProperty('id');
  
  await loggedExpect(userData, 'user object')
    .toHaveProperty('email', userData.email);
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(user object).toHaveProperty('id')
      Context: action=fetch_user_profile, userId=123, userEmail=john@example.com
      
  [2] expect(user object).toHaveProperty('email', 'john@example.com')
      Context: action=fetch_user_profile, userId=123, userEmail=john@example.com
```

## 10. Security Assertion Pattern

### Pattern: Verify CSRF token validation
```typescript
test('should validate CSRF token on form submission', async ({ page }) => {
  setupAssertionLogging('should validate CSRF token on form submission');
  
  setTestContext({
    user: { username: 'test-user' },
    action: 'submit_form_with_csrf',
    securityCheck: 'csrf_protection'
  });
  
  // ... get CSRF token and submit form ...
  
  const csrfToken = await page.evaluate(() => 
    document.querySelector('[name="csrf_token"]')?.getAttribute('value')
  );
  
  setTestContext({ csrfTokenPresent: !!csrfToken, securityCheck: 'csrf_token_validated' });
  
  await loggedExpect(!!csrfToken, 'CSRF token present in form')
    .toBeTruthy();
  
  endAssertionLogging('passed');
});
```

**Output:**
```
  [1] expect(CSRF token present in form).toBeTruthy()
      Actual: true | Expected: truthy
      Context: user=test-user, csrfTokenPresent=true, securityCheck=csrf_token_validated
```

## Best Practice Checklist

- [ ] Call `setupAssertionLogging()` at test start
- [ ] Call `endAssertionLogging()` at test end
- [ ] Use `setTestContext()` before key operations
- [ ] Mask passwords: `'***' + password.slice(-4)`
- [ ] Use descriptive assertion descriptions
- [ ] Update context when UI state changes
- [ ] Include user, action, and expected behavior in context
- [ ] Use `loggedExpect()` for critical assertions
- [ ] Show actual vs expected in descriptions

## Running Tests with Enhanced Assertions

```bash
# Run all tests
npm test

# Run specific test file
npm test tests/ui/specs/login.spec.ts

# Run with verbose output
npx playwright test -v

# View HTML report
npm run show-report
```

## Viewing Detailed Reports

Look for enhanced assertion output in:
1. Terminal output during test runs
2. HTML report (click on test to see steps)
3. GitHub Actions logs (in CI/CD)
4. Test artifacts
