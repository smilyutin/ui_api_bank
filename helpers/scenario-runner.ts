import { Page, BrowserContext } from '@playwright/test';
import { TestLogger, createLogger } from './logger';
import { PageManager } from '../pages/page-manager';

export interface ScenarioStep {
  name: string;
  action: () => Promise<void>;
  timeout?: number;
  retries?: number;
}

export interface ScenarioConfig {
  name: string;
  description?: string;
  steps: ScenarioStep[];
  maxConcurrent?: number;
  timeout?: number;
}

export interface ScenarioResult {
  scenarioName: string;
  status: 'success' | 'failed' | 'timeout';
  startTime: number;
  endTime: number;
  duration: number;
  completedSteps: number;
  totalSteps: number;
  error?: string;
  logs: string[];
}

export class Scenario {
  private config: ScenarioConfig;
  private logger: TestLogger;
  private results: ScenarioResult[] = [];

  constructor(config: ScenarioConfig, logger: TestLogger) {
    this.config = config;
    this.logger = logger;
  }

  async execute(): Promise<ScenarioResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    this.logger.info('Scenario starting', {
      name: this.config.name,
      steps: this.config.steps.length
    });

    let completedSteps = 0;
    let error: string | undefined;
    let status: 'success' | 'failed' | 'timeout' = 'success';

    try {
      for (let i = 0; i < this.config.steps.length; i++) {
        const step = this.config.steps[i];
        const stepTimeout = step.timeout ?? this.config.timeout ?? 30000;
        const retries = step.retries ?? 1;

        this.logger.info(`Executing step ${i + 1}/${this.config.steps.length}`, {
          name: step.name,
          timeout: stepTimeout,
          retries
        });

        let stepSucceeded = false;

        for (let attempt = 1; attempt <= retries; attempt++) {
          try {
            await this.executeWithTimeout(step.action, stepTimeout);
            this.logger.info(`Step completed: ${step.name}`);
            stepSucceeded = true;
            completedSteps++;
            logs.push(`✓ ${step.name}`);
            break;
          } catch (e) {
            const errorMsg = String(e);
            logs.push(`✗ ${step.name} (attempt ${attempt}/${retries}): ${errorMsg}`);

            if (attempt === retries) {
              throw e;
            }

            this.logger.warn(`Step failed, retrying`, {
              step: step.name,
              attempt,
              error: errorMsg
            });

            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
          }
        }

        if (!stepSucceeded) {
          throw new Error(`Step failed: ${step.name}`);
        }
      }
    } catch (e) {
      error = String(e);
      status = 'failed';
      this.logger.error('Scenario failed', { error }, e as Error);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    const result: ScenarioResult = {
      scenarioName: this.config.name,
      status,
      startTime,
      endTime,
      duration,
      completedSteps,
      totalSteps: this.config.steps.length,
      error,
      logs
    };

    this.results.push(result);

    this.logger.info('Scenario completed', {
      name: this.config.name,
      status,
      duration,
      completedSteps: `${completedSteps}/${this.config.steps.length}`
    });

    return result;
  }

  private async executeWithTimeout(
    action: () => Promise<void>,
    timeoutMs: number
  ): Promise<void> {
    return Promise.race([
      action(),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  getResults(): ScenarioResult[] {
    return [...this.results];
  }

  getLatestResult(): ScenarioResult | undefined {
    return this.results[this.results.length - 1];
  }
}

export class ConcurrentScenarioRunner {
  private scenarios: Scenario[] = [];
  private logger: TestLogger;
  private maxConcurrent: number;
  private results: Map<string, ScenarioResult> = new Map();

  constructor(maxConcurrent: number = 3, logger: TestLogger = createLogger()) {
    this.maxConcurrent = maxConcurrent;
    this.logger = logger;
  }

  addScenario(config: ScenarioConfig): this {
    const scenario = new Scenario(config, this.logger);
    this.scenarios.push(scenario);
    return this;
  }

  async runAll(): Promise<ScenarioResult[]> {
    this.logger.info('Starting concurrent scenario execution', {
      totalScenarios: this.scenarios.length,
      maxConcurrent: this.maxConcurrent
    });

    const results: ScenarioResult[] = [];

    // Chunk scenarios into batches based on maxConcurrent
    for (let i = 0; i < this.scenarios.length; i += this.maxConcurrent) {
      const batch = this.scenarios.slice(i, i + this.maxConcurrent);
      const batchPromises = batch.map(scenario =>
        scenario.execute().then(result => {
          this.results.set(result.scenarioName, result);
          return result;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    this.logger.info('All scenarios completed', {
      total: results.length,
      successful: results.filter(r => r.status === 'success').length,
      failed: results.filter(r => r.status === 'failed').length,
      timeouts: results.filter(r => r.status === 'timeout').length
    });

    return results;
  }

  async runSequential(): Promise<ScenarioResult[]> {
    this.logger.info('Starting sequential scenario execution', {
      totalScenarios: this.scenarios.length
    });

    const results: ScenarioResult[] = [];

    for (const scenario of this.scenarios) {
      const result = await scenario.execute();
      this.results.set(result.scenarioName, result);
      results.push(result);
    }

    return results;
  }

  getResults(): ScenarioResult[] {
    return Array.from(this.results.values());
  }

  generateReport(): string {
    const results = this.getResults();
    let report = '# Concurrent Scenario Execution Report\n\n';
    report += `**Total Scenarios:** ${results.length}\n`;
    report += `**Successful:** ${results.filter(r => r.status === 'success').length}\n`;
    report += `**Failed:** ${results.filter(r => r.status === 'failed').length}\n`;
    report += `**Timeouts:** ${results.filter(r => r.status === 'timeout').length}\n\n`;

    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    report += `**Total Duration:** ${totalDuration}ms\n`;
    report += `**Average Duration:** ${Math.round(totalDuration / results.length)}ms\n\n`;

    report += '## Scenario Results\n\n';

    results.forEach((result, idx) => {
      report += `### ${idx + 1}. ${result.scenarioName}\n`;
      report += `- **Status:** ${result.status.toUpperCase()}\n`;
      report += `- **Duration:** ${result.duration}ms\n`;
      report += `- **Steps:** ${result.completedSteps}/${result.totalSteps}\n`;

      if (result.error) {
        report += `- **Error:** ${result.error}\n`;
      }

      if (result.logs.length > 0) {
        report += `- **Execution Log:**\n`;
        result.logs.forEach(log => {
          report += `  ${log}\n`;
        });
      }

      report += '\n';
    });

    return report;
  }

  printSummary(): void {
    const results = this.getResults();
    const successful = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const timeouts = results.filter(r => r.status === 'timeout').length;

    console.log('\n' + '='.repeat(70));
    console.log('CONCURRENT SCENARIO EXECUTION SUMMARY');
    console.log('='.repeat(70));
    console.log(`Total Scenarios: ${results.length}`);
    console.log(`✓ Successful: ${successful}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`⏱ Timeouts: ${timeouts}`);

    if (failed > 0 || timeouts > 0) {
      console.log('\nFailed Scenarios:');
      results
        .filter(r => r.status !== 'success')
        .forEach(r => {
          console.log(`  - ${r.scenarioName}: ${r.error}`);
        });
    }

    console.log('='.repeat(70) + '\n');
  }
}

export class ScenarioBuilder {
  private steps: ScenarioStep[] = [];
  private name: string;
  private description?: string;
  private timeout?: number;

  constructor(name: string) {
    this.name = name;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  withTimeout(timeoutMs: number): this {
    this.timeout = timeoutMs;
    return this;
  }

  addStep(name: string, action: () => Promise<void>, options?: { timeout?: number; retries?: number }): this {
    this.steps.push({
      name,
      action,
      timeout: options?.timeout,
      retries: options?.retries
    });
    return this;
  }

  build(): ScenarioConfig {
    return {
      name: this.name,
      description: this.description,
      steps: this.steps,
      timeout: this.timeout
    };
  }
}
