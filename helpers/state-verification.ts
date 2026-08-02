import { StateMachine } from './state-machine';
import { TestLogger } from './logger';

export interface StateTransitionRule {
  from: string;
  to: string;
  allowedEvents: string[];
  forbidden?: boolean;
}

export interface StateValidation {
  isValid: boolean;
  violations: string[];
  details: Record<string, any>;
}

export class StateVerifier {
  private stateMachine: StateMachine;
  private logger?: TestLogger;
  private allowedTransitions: StateTransitionRule[] = [];

  constructor(stateMachine: StateMachine, logger?: TestLogger) {
    this.stateMachine = stateMachine;
    this.logger = logger;
  }

  addAllowedTransition(rule: StateTransitionRule): this {
    this.allowedTransitions.push(rule);
    return this;
  }

  verifyState(expectedState: string): StateValidation {
    const violations: string[] = [];
    const currentState = this.stateMachine.getCurrentState();

    this.logger?.debug('Verifying state', {
      expected: expectedState,
      current: currentState
    });

    if (currentState !== expectedState) {
      violations.push(`Expected state '${expectedState}' but got '${currentState}'`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        expected: expectedState,
        current: currentState,
        previousState: this.stateMachine.getPreviousState()
      }
    };
  }

  verifyTransitionAllowed(fromState: string, toState: string, event: string): StateValidation {
    const violations: string[] = [];

    this.logger?.debug('Verifying transition allowed', {
      from: fromState,
      to: toState,
      event
    });

    const rule = this.allowedTransitions.find(
      r => r.from === fromState && r.to === toState
    );

    if (!rule) {
      violations.push(`No transition rule found from '${fromState}' to '${toState}'`);
    } else if (rule.forbidden) {
      violations.push(`Transition from '${fromState}' to '${toState}' is forbidden`);
    } else if (!rule.allowedEvents.includes(event)) {
      violations.push(
        `Event '${event}' not allowed for transition from '${fromState}' to '${toState}'. Allowed: ${rule.allowedEvents.join(', ')}`
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        from: fromState,
        to: toState,
        event,
        rule: rule ? { ...rule } : null
      }
    };
  }

  verifyNoInvalidTransitions(): StateValidation {
    const violations: string[] = [];
    const history = this.stateMachine.getTransitionHistory();

    this.logger?.debug('Verifying no invalid transitions', {
      historyLength: history.length
    });

    history.forEach((transition, idx) => {
      const validation = this.verifyTransitionAllowed(
        transition.from,
        transition.to,
        transition.event
      );

      if (!validation.isValid) {
        violations.push(
          `Transition #${idx + 1}: ${validation.violations[0]}`
        );
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        transitionCount: history.length,
        invalidCount: violations.length
      }
    };
  }

  verifyContextData(key: string, expectedValue: any): StateValidation {
    const violations: string[] = [];
    const actualValue = this.stateMachine.getContextData(key);

    this.logger?.debug('Verifying context data', {
      key,
      expected: expectedValue,
      actual: actualValue
    });

    if (actualValue !== expectedValue) {
      violations.push(
        `Context data '${key}': expected '${expectedValue}' but got '${actualValue}'`
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        key,
        expected: expectedValue,
        actual: actualValue
      }
    };
  }

  verifyContextDataExists(key: string): StateValidation {
    const violations: string[] = [];
    const hasData = this.stateMachine.getContextData(key) !== undefined;

    this.logger?.debug('Verifying context data exists', {
      key,
      exists: hasData
    });

    if (!hasData) {
      violations.push(`Context data '${key}' does not exist`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        key,
        exists: hasData
      }
    };
  }

  verifyTransitionCount(expectedCount: number): StateValidation {
    const violations: string[] = [];
    const actualCount = this.stateMachine.getTransitionHistory().length;

    this.logger?.debug('Verifying transition count', {
      expected: expectedCount,
      actual: actualCount
    });

    if (actualCount !== expectedCount) {
      violations.push(
        `Expected ${expectedCount} transitions but got ${actualCount}`
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        expected: expectedCount,
        actual: actualCount
      }
    };
  }

  verifyTransitionCountAtLeast(minimumCount: number): StateValidation {
    const violations: string[] = [];
    const actualCount = this.stateMachine.getTransitionHistory().length;

    this.logger?.debug('Verifying minimum transition count', {
      minimum: minimumCount,
      actual: actualCount
    });

    if (actualCount < minimumCount) {
      violations.push(
        `Expected at least ${minimumCount} transitions but got ${actualCount}`
      );
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        minimum: minimumCount,
        actual: actualCount
      }
    };
  }

  verifyNoErrors(): StateValidation {
    const violations: string[] = [];
    const stats = this.stateMachine.getStatistics();

    this.logger?.debug('Verifying no errors', {
      errorCount: stats.totalErrors
    });

    if (stats.totalErrors > 0) {
      violations.push(`State machine encountered ${stats.totalErrors} error(s)`);
    }

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        errorCount: stats.totalErrors
      }
    };
  }

  verifySequence(expectedSequence: Array<{ from: string; to: string; event: string }>): StateValidation {
    const violations: string[] = [];
    const history = this.stateMachine.getTransitionHistory();

    this.logger?.debug('Verifying sequence', {
      expectedLength: expectedSequence.length,
      actualLength: history.length
    });

    if (history.length < expectedSequence.length) {
      violations.push(
        `Expected at least ${expectedSequence.length} transitions but got ${history.length}`
      );
      return {
        isValid: false,
        violations,
        details: { expectedLength: expectedSequence.length, actualLength: history.length }
      };
    }

    expectedSequence.forEach((expected, idx) => {
      const actual = history[idx];
      if (
        actual.from !== expected.from ||
        actual.to !== expected.to ||
        actual.event !== expected.event
      ) {
        violations.push(
          `Transition #${idx + 1} mismatch: expected ${expected.from} --(${expected.event})--> ${expected.to} but got ${actual.from} --(${actual.event})--> ${actual.to}`
        );
      }
    });

    return {
      isValid: violations.length === 0,
      violations,
      details: {
        expectedSequence,
        actualHistory: history.slice(0, expectedSequence.length)
      }
    };
  }

  generateReport(): string {
    const stats = this.stateMachine.getStatistics();
    let report = '# State Verification Report\n\n';

    report += '## Machine Statistics\n\n';
    report += `- **Current State:** ${stats.currentState}\n`;
    report += `- **Total Transitions:** ${stats.totalTransitions}\n`;
    report += `- **Total Errors:** ${stats.totalErrors}\n`;
    report += `- **Uptime:** ${stats.uptime}ms\n\n`;

    report += '## Validation Results\n\n';

    const stateCheck = this.verifyState(stats.currentState);
    report += `- State Validation: ${stateCheck.isValid ? '✓ PASSED' : '✗ FAILED'}\n`;

    const errorCheck = this.verifyNoErrors();
    report += `- Error Check: ${errorCheck.isValid ? '✓ PASSED' : '✗ FAILED'}\n`;

    const sequenceCheck = this.verifyNoInvalidTransitions();
    report += `- Transition Validation: ${sequenceCheck.isValid ? '✓ PASSED' : '✗ FAILED'}\n\n`;

    if (!sequenceCheck.isValid) {
      report += '## Invalid Transitions\n\n';
      sequenceCheck.violations.forEach(v => {
        report += `- ${v}\n`;
      });
      report += '\n';
    }

    report += this.stateMachine.generateReport();

    return report;
  }
}

export function createStateVerifier(
  stateMachine: StateMachine,
  logger?: TestLogger
): StateVerifier {
  return new StateVerifier(stateMachine, logger);
}
