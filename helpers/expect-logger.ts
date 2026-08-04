import { expect as playwrightExpect } from '@playwright/test';

interface AssertionRecord {
  num: number;
  description: string;
  type: string;
  actualValue?: unknown;
  expectedValue?: unknown;
  passed: boolean;
  error?: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

let assertionCount = 0;
let currentTestAssertions: AssertionRecord[] = [];
let testContext: Record<string, unknown> = {};

const valueToString = (val: unknown, maxLength = 100): string => {
  try {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return `"${val}"`;
    if (typeof val === 'boolean' || typeof val === 'number') return String(val);
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  } catch {
    return String(val);
  }
};

const createAssertions = (value: unknown, description: string, isNot: boolean = false) => {
  const prefix = isNot ? '.not' : '';

  const logAssertion = (type: string, expected?: unknown, actual?: unknown) => {
    const desc = description || 'value';
    const expectedStr = expected !== undefined ? valueToString(expected) : '';
    const actualStr = actual !== undefined ? valueToString(actual) : '';
    const assertionStr = `expect(${desc})${prefix}.${type}(${expectedStr})`.replace(/\(\)$/, '()').trim();

    console.log(`  [${assertionCount}] ${assertionStr}`);
    if (actualStr) {
      if (expectedStr) {
        if (isNot) {
          console.log(`      Actual: ${actualStr} | Should NOT be: ${expectedStr}`);
        } else {
          console.log(`      Actual: ${actualStr} | Expected: ${expectedStr}`);
        }
      } else if (isNot) {
        console.log(`      Actual: ${actualStr} (assertion uses negation)`);
      } else {
        console.log(`      Actual: ${actualStr}`);
      }
    }
    return { type, desc, assertionStr };
  };

  return {
    toContain: (expected: unknown) => {
      logAssertion('toContain', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toContain(expected) : playwrightExpect(value).toContain(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toContain(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toContain(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBe: (expected: unknown) => {
      logAssertion('toBe', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBe(expected) : playwrightExpect(value).toBe(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBe(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBe(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toEqual: (expected: unknown) => {
      logAssertion('toEqual', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toEqual(expected) : playwrightExpect(value).toEqual(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toEqual(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toEqual(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeTruthy: () => {
      logAssertion('toBeTruthy', 'truthy', value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeTruthy() : playwrightExpect(value).toBeTruthy();
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeTruthy',
          actualValue: value,
          expectedValue: 'truthy',
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeTruthy',
          actualValue: value,
          expectedValue: 'truthy',
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeFalsy: () => {
      logAssertion('toBeFalsy', 'falsy', value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeFalsy() : playwrightExpect(value).toBeFalsy();
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeFalsy',
          actualValue: value,
          expectedValue: 'falsy',
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeFalsy',
          actualValue: value,
          expectedValue: 'falsy',
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toMatch: (expected: RegExp | string) => {
      logAssertion('toMatch', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toMatch(expected) : playwrightExpect(value).toMatch(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toMatch(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toMatch(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toHaveProperty: (property: string, propValue?: unknown) => {
      logAssertion('toHaveProperty', property, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toHaveProperty(property, propValue) : playwrightExpect(value).toHaveProperty(property, propValue);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toHaveProperty('${property}')`,
          actualValue: value,
          expectedValue: { property, value: propValue },
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toHaveProperty('${property}')`,
          actualValue: value,
          expectedValue: { property, value: propValue },
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toHaveLength: (length: number) => {
      logAssertion('toHaveLength', length, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toHaveLength(length) : playwrightExpect(value).toHaveLength(length);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toHaveLength(${length})`,
          actualValue: value,
          expectedValue: length,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toHaveLength(${length})`,
          actualValue: value,
          expectedValue: length,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toStrictEqual: (expected: unknown) => {
      logAssertion('toStrictEqual', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toStrictEqual(expected) : playwrightExpect(value).toStrictEqual(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toStrictEqual(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toStrictEqual(${valueToString(expected)})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeDefined: () => {
      logAssertion('toBeDefined', 'defined', value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeDefined() : playwrightExpect(value).toBeDefined();
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeDefined',
          actualValue: value,
          expectedValue: 'defined',
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeDefined',
          actualValue: value,
          expectedValue: 'defined',
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeNull: () => {
      logAssertion('toBeNull', 'null', value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeNull() : playwrightExpect(value).toBeNull();
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeNull',
          actualValue: value,
          expectedValue: 'null',
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: 'toBeNull',
          actualValue: value,
          expectedValue: 'null',
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeGreaterThan: (expected: number) => {
      logAssertion('toBeGreaterThan', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeGreaterThan(expected) : playwrightExpect(value).toBeGreaterThan(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeGreaterThan(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeGreaterThan(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeGreaterThanOrEqual: (expected: number) => {
      logAssertion('toBeGreaterThanOrEqual', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeGreaterThanOrEqual(expected) : playwrightExpect(value).toBeGreaterThanOrEqual(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeGreaterThanOrEqual(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeGreaterThanOrEqual(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeLessThan: (expected: number) => {
      logAssertion('toBeLessThan', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeLessThan(expected) : playwrightExpect(value).toBeLessThan(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeLessThan(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeLessThan(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
    toBeLessThanOrEqual: (expected: number) => {
      logAssertion('toBeLessThanOrEqual', expected, value);
      try {
        const result = isNot ? playwrightExpect(value).not.toBeLessThanOrEqual(expected) : playwrightExpect(value).toBeLessThanOrEqual(expected);
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeLessThanOrEqual(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: true,
          context: testContext,
          timestamp: Date.now(),
        });
        return result;
      } catch (e) {
        currentTestAssertions.push({
          num: assertionCount,
          description,
          type: `toBeLessThanOrEqual(${expected})`,
          actualValue: value,
          expectedValue: expected,
          passed: false,
          error: String(e),
          context: testContext,
          timestamp: Date.now(),
        });
        throw e;
      }
    },
  };
};

export function loggedExpect<T>(value: T, description?: string) {
  assertionCount++;

  const assertions = createAssertions(value, description || 'value', false);

  return {
    ...assertions,
    not: createAssertions(value, description || 'value', true),
  };
}

export function setTestContext(context: Record<string, any>) {
  testContext = { ...testContext, ...context };
  if (context.user) {
    console.log(`  User: ${context.user.username || context.user.email} (${context.user.role || 'user'})`);
  }
  if (context.url) {
    console.log(`  URL: ${context.url}`);
  }
  if (context.uiState) {
    console.log(`  UI State: ${context.uiState}`);
  }
}

export function setupAssertionLogging(testName: string) {
  assertionCount = 0;
  currentTestAssertions = [];
  testContext = {};
  console.log(`\n╔════════════════════════════════════════════════════════════════╗`);
  console.log(`║ TEST: ${testName.padEnd(60)}║`);
  console.log(`╚════════════════════════════════════════════════════════════════╝`);
}

export function endAssertionLogging(status: 'passed' | 'failed' | 'skipped' = 'passed') {
  const icon = status === 'passed' ? '✓' : status === 'failed' ? '✗' : '⊘';
  const statusText = status.toUpperCase();

  console.log(`\n${icon} ${statusText}`);

  if (currentTestAssertions.length > 0) {
    console.log(`\n┌─ Assertion Summary (${currentTestAssertions.length} total) ─┐`);
    currentTestAssertions.forEach(assertion => {
      const mark = assertion.passed ? '  ✓' : '  ✗';
      console.log(`${mark} [${assertion.num}] ${assertion.description}`);
      console.log(`     Type: ${assertion.type}`);
      if (assertion.actualValue !== undefined) {
        console.log(`     Actual: ${valueToString(assertion.actualValue, 120)}`);
      }
      if (assertion.expectedValue !== undefined) {
        console.log(`     Expected: ${valueToString(assertion.expectedValue, 120)}`);
      }
      if (assertion.context && Object.keys(assertion.context).length > 0) {
        const ctxStr = Object.entries(assertion.context)
          .filter(([k]) => k !== 'password')
          .map(([k, v]) => `${k}=${valueToString(v, 50)}`)
          .join(', ');
        if (ctxStr) console.log(`     Context: ${ctxStr}`);
      }
      if (assertion.error) {
        const errorLine = assertion.error.split('\n')[0].substring(0, 150);
        console.log(`     Error: ${errorLine}`);
      }
    });
    console.log(`└${'─'.repeat(55)}┘`);
  }

  console.log('');
  assertionCount = 0;
  currentTestAssertions = [];
  testContext = {};
}
