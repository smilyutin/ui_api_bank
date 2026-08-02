# Phase 4: Advanced Integration Guide

This guide covers advanced test patterns including state machine verification and concurrent scenario execution.

## Overview

Phase 4 provides sophisticated infrastructure for:

1. **State Machine Modeling** - Model complex application flows as state transitions
2. **State Verification** - Validate that the app follows expected state patterns
3. **Concurrent Scenarios** - Execute multiple test scenarios in parallel
4. **Workflow Testing** - Test complete user journeys with multiple steps

## Features

### 1. State Machine Framework (`helpers/state-machine.ts`)

Model application behavior as a state machine with transitions, guards, and actions.

**Key Components:**
- `StateMachine` - Core state machine implementation
- `StateMachineBuilder` - Fluent builder API for configuration
- `StateContext` - Shared data during state transitions
- `StateDefinition` - Define states with lifecycle hooks
- `Transition` - Define state transitions with guards and actions

**Example:**

```typescript
import { StateMachineBuilder } from '../helpers/state-machine';
import { createLogger } from '../helpers/logger';

const logger = createLogger(testInfo);

const sm = new StateMachineBuilder('idle')
  .withLogger(logger)
  .withState({
    name: 'idle',
    onEnter: async (ctx) => {
      console.log('Entered idle state');
    }
  })
  .withState({
    name: 'processing',
    onEnter: async (ctx) => {
      ctx.data.startTime = Date.now();
    }
  })
  .withTransition({
    from: 'idle',
    to: 'processing',
    event: 'start',
    guard: async (ctx) => {
      // Optional guard condition
      return true;
    },
    action: async (ctx) => {
      // Optional transition action
      ctx.data.transitionTime = Date.now();
    }
  })
  .build();

// Initialize the state machine
await sm.initialize();

// Handle events
await sm.handleEvent('start');

// Check current state
console.log(sm.getCurrentState()); // 'processing'

// Access context data
console.log(sm.getContextData('startTime'));

// Get statistics
const stats = sm.getStatistics();
console.log(stats.totalTransitions); // 1
```

### 2. State Verification (`helpers/state-verification.ts`)

Verify that state machines follow expected patterns and rules.

**Verification Methods:**

```typescript
import { createStateVerifier } from '../helpers/state-verification';

const verifier = createStateVerifier(sm, logger);

// Verify current state
const stateCheck = verifier.verifyState('processing');
expect(stateCheck.isValid).toBe(true);

// Verify allowed transitions
const transitionCheck = verifier.verifyTransitionAllowed(
  'idle',
  'processing',
  'start'
);
expect(transitionCheck.isValid).toBe(true);

// Add transition rules
verifier.addAllowedTransition({
  from: 'idle',
  to: 'processing',
  allowedEvents: ['start']
});

// Verify no invalid transitions occurred
const noInvalidCheck = verifier.verifyNoInvalidTransitions();
expect(noInvalidCheck.isValid).toBe(true);

// Verify context data
const dataCheck = verifier.verifyContextData('userId', 'user123');
expect(dataCheck.isValid).toBe(true);

// Verify transition count
const countCheck = verifier.verifyTransitionCount(5);
expect(countCheck.isValid).toBe(true);

// Verify specific sequence
const sequenceCheck = verifier.verifySequence([
  { from: 'idle', to: 'processing', event: 'start' },
  { from: 'processing', to: 'completed', event: 'finish' }
]);
expect(sequenceCheck.isValid).toBe(true);

// Generate verification report
const report = verifier.generateReport();
testInfo.attach('state-verification', {
  body: report,
  contentType: 'text/plain'
});
```

### 3. Scenario Execution (`helpers/scenario-runner.ts`)

Execute test scenarios with concurrent or sequential execution.

**Concurrent Execution:**

```typescript
import { ConcurrentScenarioRunner, ScenarioBuilder } from '../helpers/scenario-runner';

const runner = new ConcurrentScenarioRunner(3, logger); // Max 3 concurrent

// Add scenarios
runner.addScenario({
  name: 'User Login',
  steps: [
    {
      name: 'Navigate to login',
      action: async () => {
        await page.goto('/login');
      }
    },
    {
      name: 'Enter credentials',
      action: async () => {
        await page.fill('input[name="email"]', 'user@example.com');
        await page.fill('input[name="password"]', 'password');
      }
    },
    {
      name: 'Submit login',
      action: async () => {
        await page.click('button[type="submit"]');
      },
      timeout: 10000,
      retries: 2
    }
  ]
});

// Run all scenarios concurrently
const results = await runner.runAll();

results.forEach(result => {
  console.log(`${result.scenarioName}: ${result.status}`);
});

// Or run sequentially
const sequentialResults = await runner.runSequential();

// Print summary
runner.printSummary();

// Generate report
const report = runner.generateReport();
```

**Using ScenarioBuilder:**

```typescript
const scenario = new ScenarioBuilder('Complete Flow')
  .withDescription('Full user journey')
  .withTimeout(60000)
  .addStep('Login', async () => {
    // Login logic
  }, { timeout: 15000, retries: 2 })
  .addStep('Navigate to dashboard', async () => {
    // Navigation logic
  })
  .addStep('Verify content', async () => {
    // Verification logic
  })
  .build();
```

### 4. Common Scenarios (`helpers/common-scenarios.ts`)

Pre-built scenarios for typical user workflows.

**Available Scenarios:**

```typescript
import { CommonScenarios } from '../helpers/common-scenarios';

const pm = new PageManager(page);

// User login
const loginScenario = CommonScenarios.createLoginScenario(
  pm,
  'user@example.com',
  'password123'
);

// Money transfer
const transferScenario = CommonScenarios.createMoneyTransferScenario(
  pm,
  'recipient_id',
  '100.00',
  'Payment for services'
);

// Loan application
const loanScenario = CommonScenarios.createLoanApplicationScenario(
  pm,
  '10000',
  '12'
);

// Bill payment
const billScenario = CommonScenarios.createBillPaymentScenario(
  pm,
  'Electric Company',
  '150.00',
  '2024-02-15'
);

// Virtual card creation
const cardScenario = CommonScenarios.createVirtualCardScenario(
  pm,
  'Shopping Card',
  '500.00'
);

// Profile update
const profileScenario = CommonScenarios.createProfileUpdateScenario(
  pm,
  'John',
  'Doe'
);

// Complete journey (login + transfer)
const journeyScenario = CommonScenarios.createCompleteUserJourneyScenario(
  pm,
  'user@example.com',
  'password123',
  'recipient_id',
  '100.00'
);
```

## Examples

### Example 1: Authentication Flow State Machine

```typescript
test('authentication state machine', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);

  const sm = new StateMachineBuilder('unauthenticated')
    .withLogger(logger)
    .withState({
      name: 'unauthenticated',
      onEnter: async (ctx) => {
        logger.info('User not authenticated');
      }
    })
    .withState({
      name: 'authenticating',
      onEnter: async (ctx) => {
        ctx.data.authStartTime = Date.now();
      }
    })
    .withState({
      name: 'authenticated',
      onEnter: async (ctx) => {
        ctx.data.sessionId = 'session_' + Date.now();
        logger.info('User authenticated', { sessionId: ctx.data.sessionId });
      }
    })
    .withTransition({
      from: 'unauthenticated',
      to: 'authenticating',
      event: 'login'
    })
    .withTransition({
      from: 'authenticating',
      to: 'authenticated',
      event: 'credentials_verified'
    })
    .build();

  await sm.initialize();
  await sm.handleEvent('login');
  await sm.handleEvent('credentials_verified');

  expect(sm.getCurrentState()).toBe('authenticated');
  expect(sm.getContextData('sessionId')).toBeDefined();
});
```

### Example 2: Multi-Step Workflow Verification

```typescript
test('payment workflow with verification', async ({ page }, testInfo) => {
  const logger = createLogger(testInfo);

  const sm = new StateMachineBuilder('cart_empty')
    .withLogger(logger)
    .withState({ name: 'cart_empty' })
    .withState({ name: 'cart_filled' })
    .withState({ name: 'checkout_started' })
    .withState({ name: 'payment_processing' })
    .withState({ name: 'payment_complete' })
    .withTransition({
      from: 'cart_empty',
      to: 'cart_filled',
      event: 'add_item'
    })
    .withTransition({
      from: 'cart_filled',
      to: 'checkout_started',
      event: 'begin_checkout'
    })
    .withTransition({
      from: 'checkout_started',
      to: 'payment_processing',
      event: 'submit_payment'
    })
    .withTransition({
      from: 'payment_processing',
      to: 'payment_complete',
      event: 'payment_confirmed'
    })
    .build();

  const verifier = createStateVerifier(sm, logger);

  // Define allowed transitions
  verifier
    .addAllowedTransition({
      from: 'cart_empty',
      to: 'cart_filled',
      allowedEvents: ['add_item']
    })
    .addAllowedTransition({
      from: 'cart_filled',
      to: 'checkout_started',
      allowedEvents: ['begin_checkout']
    });

  // Execute workflow
  await sm.initialize();
  await sm.handleEvent('add_item');
  await sm.handleEvent('begin_checkout');
  await sm.handleEvent('submit_payment');
  await sm.handleEvent('payment_confirmed');

  // Verify
  expect(verifier.verifyState('payment_complete').isValid).toBe(true);
  expect(verifier.verifyNoInvalidTransitions().isValid).toBe(true);
  expect(verifier.verifyTransitionCount(4).isValid).toBe(true);
});
```

### Example 3: Concurrent User Scenarios

```typescript
test('concurrent user flows', async ({ browser }, testInfo) => {
  const logger = createLogger(testInfo);
  const runner = new ConcurrentScenarioRunner(2, logger);

  // Create multiple browser contexts for isolation
  const ctx1 = await browser.newContext();
  const ctx2 = await browser.newContext();
  const page1 = await ctx1.newPage();
  const page2 = await ctx2.newPage();

  // Scenario 1: User A's flow
  runner.addScenario({
    name: 'User A: Login and Transfer',
    steps: [
      {
        name: 'Navigate to login',
        action: async () => {
          await page1.goto('/login');
        }
      },
      {
        name: 'Login',
        action: async () => {
          await page1.fill('input[name="email"]', 'user_a@example.com');
          await page1.fill('input[name="password"]', 'password');
          await page1.click('button[type="submit"]');
        }
      },
      {
        name: 'Initiate transfer',
        action: async () => {
          await page1.goto('/transfer');
          await page1.fill('input[name="amount"]', '100');
          await page1.click('button[name="submit"]');
        }
      }
    ]
  });

  // Scenario 2: User B's flow
  runner.addScenario({
    name: 'User B: Login and Check Balance',
    steps: [
      {
        name: 'Navigate to login',
        action: async () => {
          await page2.goto('/login');
        }
      },
      {
        name: 'Login',
        action: async () => {
          await page2.fill('input[name="email"]', 'user_b@example.com');
          await page2.fill('input[name="password"]', 'password');
          await page2.click('button[type="submit"]');
        }
      },
      {
        name: 'Check balance',
        action: async () => {
          await page2.goto('/dashboard');
          const balance = await page2.textContent('[data-testid="balance"]');
          expect(balance).toBeTruthy();
        }
      }
    ]
  });

  const results = await runner.runAll();
  expect(results.every(r => r.status === 'success')).toBe(true);

  await ctx1.close();
  await ctx2.close();
});
```

## Best Practices

### 1. Use State Machines for Complex Flows

 **Do:**
```typescript
const sm = new StateMachineBuilder('start')
  .withState({ name: 'start' })
  .withState({ name: 'processing' })
  .withState({ name: 'complete' })
  .withTransition({ from: 'start', to: 'processing', event: 'begin' })
  .build();
```

 **Don't:**
```typescript
// Instead of manual state tracking
let currentState = 'start';
currentState = 'processing'; // Easy to lose track
```

### 2. Verify State Transitions

 **Do:**
```typescript
const verifier = createStateVerifier(sm);
verifier.addAllowedTransition({
  from: 'start',
  to: 'processing',
  allowedEvents: ['begin']
});
expect(verifier.verifyNoInvalidTransitions().isValid).toBe(true);
```

### 3. Use Appropriate Concurrency

 **Do:**
```typescript
// Run related scenarios concurrently
const runner = new ConcurrentScenarioRunner(3); // 3 max concurrent
```

 **Don't:**
```typescript
// Running everything concurrently can cause resource issues
const runner = new ConcurrentScenarioRunner(100);
```

### 4. Log State Transitions

 **Do:**
```typescript
const sm = new StateMachineBuilder('start')
  .withLogger(logger) // Always include logger
  .build();
```

### 5. Use Guards for Complex Transitions

 **Do:**
```typescript
.withTransition({
  from: 'pending_payment',
  to: 'order_confirmed',
  event: 'payment_received',
  guard: async (ctx) => {
    // Verify payment actually received
    return ctx.data.paymentAmount > 0;
  }
})
```

## Performance Considerations

### Concurrent Execution

- **Default Max:** 3 scenarios at a time
- **Adjust based on system resources:** Reduce for CI/limited resources
- **Isolation:** Use separate browser contexts for true parallelism

### State Machine Overhead

- Minimal overhead for typical flows
- State tracking is ~0.1ms per transition
- History is kept in memory (consider clearing for very long-running tests)

## Troubleshooting

### Issue: State Transition Failed

**Cause:** Guard condition returned false

**Solution:**
```typescript
// Add logging to guard
guard: async (ctx) => {
  logger.debug('Checking guard condition', { data: ctx.data });
  return checkCondition(ctx);
}
```

### Issue: Scenarios Timing Out

**Cause:** Step timeout too aggressive

**Solution:**
```typescript
.addStep('long_operation', action, {
  timeout: 30000, // Increase timeout
  retries: 2      // Add retries
})
```

### Issue: Concurrent Scenarios Interfering

**Cause:** Shared state between scenarios

**Solution:**
```typescript
// Use separate browser contexts
const ctx1 = await browser.newContext();
const ctx2 = await browser.newContext();
// Each scenario gets its own context
```

## Reporting

Generate comprehensive reports for all features:

```typescript
// State machine report
const smReport = sm.generateReport();

// Verification report
const verifyReport = verifier.generateReport();

// Scenario execution report
const scenarioReport = runner.generateReport();

// Attach all reports
testInfo.attach('state-machine', { body: smReport, contentType: 'text/plain' });
testInfo.attach('verification', { body: verifyReport, contentType: 'text/plain' });
testInfo.attach('scenarios', { body: scenarioReport, contentType: 'text/plain' });
```

## Files

| File | Purpose |
|------|---------|
| helpers/state-machine.ts | State machine implementation |
| helpers/state-verification.ts | State validation and verification |
| helpers/scenario-runner.ts | Scenario execution engine |
| helpers/common-scenarios.ts | Pre-built scenario definitions |
| tests/advanced-integration.spec.ts | Demo tests |
| ADVANCED_INTEGRATION.md | This guide |

## Next Steps

Phase 4 is complete with advanced integration capabilities. You can now:
- Model complex application flows with state machines
- Verify state transitions follow business rules
- Execute multiple test scenarios in parallel
- Test complete user journeys

This provides a foundation for sophisticated end-to-end testing and multi-user concurrent scenarios.
