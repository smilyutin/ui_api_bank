import { Reporter, FullResult, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

interface AssertionDetails {
  num: number;
  description: string;
  type: string;
  actualValue?: string;
  expectedValue?: string;
  passed: boolean;
  error?: string;
  context?: Record<string, any>;
  timestamp: number;
}

class AssertionLoggerReporter implements Reporter {
  private currentTest: TestCase | null = null;
  private testStepCount = new Map<string, number>();
  private currentTestAssertions = new Map<string, AssertionDetails[]>();
  private failedAssertions: Array<{ test: string; assertion: AssertionDetails }> = [];

  onBegin() {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           DETAILED ASSERTION LOGGER REPORTER                    ║');
    console.log('║     Shows: exact values, actual vs expected, user context        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  }

  onTestBegin(test: TestCase) {
    this.currentTest = test;
    this.testStepCount.set(test.id, 0);
    this.currentTestAssertions.set(test.id, []);
  }

  onStepEnd(step: TestStep) {
    if (!this.currentTest) return;

    const stepTitle = step.title;
    const isAssertion = stepTitle.includes('expect(') ||
                       stepTitle.includes('toBe(') ||
                       stepTitle.includes('toEqual(') ||
                       stepTitle.includes('toContain(') ||
                       stepTitle.includes('toMatch(') ||
                       stepTitle.includes('toHaveProperty(') ||
                       stepTitle.includes('toHaveLength(') ||
                       stepTitle.includes('toBeTruthy(') ||
                       stepTitle.includes('toBeFalsy(') ||
                       stepTitle.includes('toBeDefined(') ||
                       stepTitle.includes('toThrow(');

    if (isAssertion) {
      const stepNum = (this.testStepCount.get(this.currentTest.id) || 0) + 1;
      this.testStepCount.set(this.currentTest.id, stepNum);

      const status = step.error ? '✗ FAILED' : '✓ PASSED';
      const mark = step.error ? '✗' : '✓';

      console.log(`  ${mark} [Assertion ${stepNum}] ${status}`);
      console.log(`     Expression: ${stepTitle}`);

      if (step.error) {
        console.log(`     Error: ${step.error.message.split('\n')[0]}`);
        this.failedAssertions.push({
          test: this.currentTest.title,
          assertion: {
            num: stepNum,
            description: this.currentTest.title,
            type: this.extractAssertionType(stepTitle),
            actualValue: this.extractActualValue(step.error.message),
            expectedValue: this.extractExpectedValue(step.error.message),
            passed: false,
            error: step.error.message.split('\n')[0],
            timestamp: Date.now(),
          },
        });
      }

      const assertions = this.currentTestAssertions.get(this.currentTest.id) || [];
      assertions.push({
        num: stepNum,
        description: stepTitle,
        type: this.extractAssertionType(stepTitle),
        passed: !step.error,
        error: step.error?.message,
        timestamp: Date.now(),
      });
      this.currentTestAssertions.set(this.currentTest.id, assertions);
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const assertions = this.currentTestAssertions.get(test.id) || [];
    const assertionCount = assertions.length;
    const passedCount = assertions.filter((a) => a.passed).length;
    const failedCount = assertions.filter((a) => !a.passed).length;

    const statusIcon = result.status === 'passed' ? '✓' : result.status === 'failed' ? '✗' : '⊘';
    const statusText = result.status === 'passed' ? 'PASSED' : result.status === 'failed' ? 'FAILED' : 'SKIPPED';

    console.log(`\n┌─────────────────────────────────────────────────────────────┐`);
    console.log(`│ ${statusIcon} ${test.title}`);
    console.log(`│ Status: ${statusText} | Assertions: ${assertionCount} (✓ ${passedCount} / ✗ ${failedCount})`);
    console.log(`│ Duration: ${result.duration}ms`);
    if (test.parent?.project?.name) {
      console.log(`│ Browser: ${test.parent.project.name}`);
    }
    console.log(`└─────────────────────────────────────────────────────────────┘\n`);

    this.currentTest = null;
  }

  onEnd(result: FullResult) {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                       TEST SUMMARY                             ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');

    try {
      const total = result?.stats?.expected ?? 0;
      const failed = result?.stats?.unexpected ?? 0;
      const passed = total - failed;
      const skipped = (result?.stats?.skipped ?? 0);

      if (total > 0) {
        console.log(`\nTotal Tests: ${total}`);
        console.log(`  ✓ Passed:  ${passed}`);
        console.log(`  ✗ Failed:  ${failed}`);
        console.log(`  ⊘ Skipped: ${skipped}`);
      }
    } catch (e) {
      // Silently ignore any errors accessing stats
    }

    if (this.failedAssertions.length > 0) {
      console.log(`\n┌─ FAILED ASSERTIONS (${this.failedAssertions.length}) ─┐`);
      this.failedAssertions.forEach(({ test, assertion }) => {
        console.log(`│ ✗ [${assertion.num}] ${test}`);
        console.log(`│   Type: ${assertion.type}`);
        if (assertion.actualValue) {
          console.log(`│   Actual: ${assertion.actualValue.substring(0, 80)}`);
        }
        if (assertion.expectedValue) {
          console.log(`│   Expected: ${assertion.expectedValue.substring(0, 80)}`);
        }
        if (assertion.error) {
          console.log(`│   ${assertion.error.substring(0, 80)}`);
        }
      });
      console.log(`└─────────────────────────────────────────────┘`);
    }

    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  }

  private extractAssertionType(stepTitle: string): string {
    const match = stepTitle.match(/\.(\w+)\(/);
    return match ? match[1] : 'unknown';
  }

  private extractActualValue(errorMessage: string): string | undefined {
    const match = errorMessage.match(/Actual:\s*(.+?)(?:\n|Expected:|$)/);
    return match ? match[1].trim() : undefined;
  }

  private extractExpectedValue(errorMessage: string): string | undefined {
    const match = errorMessage.match(/Expected:\s*(.+?)(?:\n|$)/);
    return match ? match[1].trim() : undefined;
  }
}

export default AssertionLoggerReporter;
