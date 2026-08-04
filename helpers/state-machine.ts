import { TestLogger } from './logger';

export type StateType = string;
export type EventType = string;
export type GuardFunction = (context: StateContext) => Promise<boolean>;
export type ActionFunction = (context: StateContext) => Promise<void>;

export interface StateContext {
  currentState: StateType;
  previousState?: StateType;
  data: Record<string, any>;
  timestamp: number;
  transitionCount: number;
  errorCount: number;
}

export interface Transition {
  from: StateType;
  to: StateType;
  event: EventType;
  guard?: GuardFunction;
  action?: ActionFunction;
}

export interface StateDefinition {
  name: StateType;
  onEnter?: ActionFunction;
  onExit?: ActionFunction;
  timeout?: number;
}

export interface StateMachineConfig {
  initialState: StateType;
  states: StateDefinition[];
  transitions: Transition[];
  logger?: TestLogger;
}

export class StateMachine {
  private config: StateMachineConfig;
  private context: StateContext;
  private transitionHistory: Array<{ from: StateType; to: StateType; event: EventType; timestamp: number }> = [];
  private logger?: TestLogger;

  constructor(config: StateMachineConfig) {
    this.config = config;
    this.logger = config.logger;
    this.context = {
      currentState: config.initialState,
      data: {},
      timestamp: Date.now(),
      transitionCount: 0,
      errorCount: 0
    };

    this.logger?.info('State machine initialized', {
      initialState: this.config.initialState,
      stateCount: this.config.states.length,
      transitionCount: this.config.transitions.length
    });
  }

  async initialize(): Promise<void> {
    const stateDefinition = this.getStateDefinition(this.context.currentState);
    if (stateDefinition?.onEnter) {
      this.logger?.debug('Executing state on-enter handler', { state: this.context.currentState });
      await stateDefinition.onEnter(this.context);
    }
  }

  async handleEvent(event: EventType, data?: Record<string, any>): Promise<boolean> {
    const applicableTransitions = this.findApplicableTransitions(this.context.currentState, event);

    if (applicableTransitions.length === 0) {
      this.logger?.warn('No transition found for event', {
        currentState: this.context.currentState,
        event
      });
      this.context.errorCount++;
      return false;
    }

    for (const transition of applicableTransitions) {
      try {
        // Check guard condition
        if (transition.guard) {
          this.logger?.debug('Checking guard condition', {
            from: transition.from,
            to: transition.to,
            event
          });
          const guardPassed = await transition.guard(this.context);
          if (!guardPassed) {
            this.logger?.debug('Guard condition failed, trying next transition');
            continue;
          }
        }

        // Exit current state
        const exitHandler = this.getStateDefinition(this.context.currentState)?.onExit;
        if (exitHandler) {
          this.logger?.debug('Executing state on-exit handler', { state: this.context.currentState });
          await exitHandler(this.context);
        }

        // Execute transition action
        if (transition.action) {
          this.logger?.debug('Executing transition action', {
            from: transition.from,
            to: transition.to,
            event
          });
          await transition.action(this.context);
        }

        // Update context
        const previousState = this.context.currentState;
        this.context.previousState = previousState;
        this.context.currentState = transition.to;
        this.context.transitionCount++;
        this.context.timestamp = Date.now();

        if (data) {
          this.context.data = { ...this.context.data, ...data };
        }

        // Record transition
        this.transitionHistory.push({
          from: previousState,
          to: transition.to,
          event,
          timestamp: this.context.timestamp
        });

        // Enter new state
        const enterHandler = this.getStateDefinition(transition.to)?.onEnter;
        if (enterHandler) {
          this.logger?.debug('Executing state on-enter handler', { state: transition.to });
          await enterHandler(this.context);
        }

        this.logger?.info('State transition successful', {
          from: previousState,
          to: transition.to,
          event
        });

        return true;
      } catch (e) {
        this.logger?.error('Transition failed', { error: String(e) }, e as Error);
        this.context.errorCount++;
      }
    }

    return false;
  }

  async waitForState(targetState: StateType, timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();

    this.logger?.debug('Waiting for state', { targetState, timeoutMs });

    while (Date.now() - startTime < timeoutMs) {
      if (this.context.currentState === targetState) {
        this.logger?.info('Target state reached', { state: targetState });
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.logger?.warn('Timeout waiting for state', { targetState, timeoutMs });
    return false;
  }

  getCurrentState(): StateType {
    return this.context.currentState;
  }

  getPreviousState(): StateType | undefined {
    return this.context.previousState;
  }

  getContext(): StateContext {
    return { ...this.context };
  }

  setContextData(key: string, value: unknown): void {
    this.context.data[key] = value;
    this.logger?.debug('Context data updated', { key, value });
  }

  getContextData(key: string): unknown {
    return this.context.data[key];
  }

  getTransitionHistory(): typeof this.transitionHistory {
    return [...this.transitionHistory];
  }

  getStatistics(): {
    currentState: StateType;
    totalTransitions: number;
    totalErrors: number;
    uptime: number;
    transitionHistory: typeof this.transitionHistory;
  } {
    return {
      currentState: this.context.currentState,
      totalTransitions: this.context.transitionCount,
      totalErrors: this.context.errorCount,
      uptime: Date.now() - this.context.timestamp,
      transitionHistory: this.getTransitionHistory()
    };
  }

  private findApplicableTransitions(state: StateType, event: EventType): Transition[] {
    return this.config.transitions.filter(t => t.from === state && t.event === event);
  }

  private getStateDefinition(state: StateType): StateDefinition | undefined {
    return this.config.states.find(s => s.name === state);
  }

  reset(newInitialState?: StateType): void {
    const initialState = newInitialState ?? this.config.initialState;
    this.context = {
      currentState: initialState,
      data: {},
      timestamp: Date.now(),
      transitionCount: 0,
      errorCount: 0
    };
    this.transitionHistory = [];
    this.logger?.info('State machine reset', { newState: initialState });
  }

  generateReport(): string {
    const stats = this.getStatistics();
    let report = '# State Machine Report\n\n';
    report += `**Current State:** ${stats.currentState}\n`;
    report += `**Total Transitions:** ${stats.totalTransitions}\n`;
    report += `**Total Errors:** ${stats.totalErrors}\n`;
    report += `**Uptime:** ${stats.uptime}ms\n\n`;

    report += '## Transition History\n\n';
    stats.transitionHistory.forEach((t, idx) => {
      report += `${idx + 1}. ${t.from} --(${t.event})--> ${t.to} (${new Date(t.timestamp).toISOString()})\n`;
    });

    report += '\n## Context Data\n\n';
    report += '```json\n';
    report += JSON.stringify(this.context.data, null, 2);
    report += '\n```\n';

    return report;
  }
}

export class StateMachineBuilder {
  private config: StateMachineConfig;

  constructor(initialState: StateType) {
    this.config = {
      initialState,
      states: [],
      transitions: []
    };
  }

  withState(definition: StateDefinition): this {
    this.config.states.push(definition);
    return this;
  }

  withTransition(transition: Transition): this {
    this.config.transitions.push(transition);
    return this;
  }

  withLogger(logger: TestLogger): this {
    this.config.logger = logger;
    return this;
  }

  build(): StateMachine {
    return new StateMachine(this.config);
  }
}
