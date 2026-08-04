# Test Tags Guide

All tests in this suite are tagged with Playwright `@tag` labels for easy filtering and selective test execution.

## Running Tests by Tag

### Primary Tags (by test type)

Run only smoke tests (core happy-path functionality):
```bash
npx playwright test --grep @smoke
```

Run only API tests:
```bash
npx playwright test --grep @api
```

Run only UI feature tests:
```bash
npx playwright test --grep @ui
```

Run only security tests:
```bash
npx playwright test --grep @security
```

Run integration/advanced tests:
```bash
npx playwright test --grep @integration
```

### Secondary Tags (by category)

Run authentication-related tests:
```bash
npx playwright test --grep @auth
```

Run admin panel tests:
```bash
npx playwright test --grep @admin
```

Run cross-browser tests:
```bash
npx playwright test --grep @cross-browser
```

### Feature Tags

Run tests for a specific feature:
```bash
npx playwright test --grep @feature:money-transfer
npx playwright test --grep @feature:virtual-cards
npx playwright test --grep @feature:loans
npx playwright test --grep @feature:bill-payments
npx playwright test --grep @feature:profile
npx playwright test --grep @feature:transactions
npx playwright test --grep @feature:create-user
npx playwright test --grep @feature:ai-chat
```

### Special Tags

Run observability tests:
```bash
npx playwright test --grep @observability
```

Run reliability/flakiness tests:
```bash
npx playwright test --grep @reliability
```

## Combining Tags

Use regex to combine multiple tags:

Run smoke and auth tests:
```bash
npx playwright test --grep "@smoke.*@auth|@auth.*@smoke"
```

Run all tests except security:
```bash
npx playwright test --grep -v "@security"
```

Run only UI feature tests (excluding security):
```bash
npx playwright test --grep "@ui" --grep -v "@security"
```

## Tag Coverage

- **@smoke** (5 files): Core login, dashboard, home page, navigation
- **@api** (12 files): API endpoint tests
- **@ui** (10 files): UI feature tests
- **@security** (27 files): All security-focused tests
- **@integration** (2 files): Advanced integration scenarios
- **@observability** (1 file): Observability/logging demo
- **@reliability** (1 file): Reliability improvements demo
- **@auth** (subset): Authentication-related tests
- **@admin** (subset): Admin panel tests
- **@cross-browser** (subset): Cross-browser compatibility tests
- **@feature:*** (subset): Feature-specific tests

## CI/CD Integration

In CI pipelines, run smoke tests for quick feedback:
```bash
npx playwright test --grep @smoke
```

Run full suite on main branch:
```bash
npm test  # all browsers, all tests
```

Run security tests only:
```bash
npx playwright test --grep @security
```

## Notes

- Tags are added to `test.describe()` blocks and inherited by all tests within
- Some tests have multiple tags (e.g., `@api @auth @feature:profile`)
- Use `--grep` for inclusive matching (regex-based)
- Tags are case-sensitive: `@smoke` ≠ `@Smoke`
- Complex filtering works: `--grep "@ui.*@feature:money-transfer"`
