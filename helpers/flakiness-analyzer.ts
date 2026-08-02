import fs from 'fs';
import path from 'path';

export interface TestRun {
  testName: string;
  projectName: string;
  duration: number;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped';
  timestamp: string;
  error?: string;
  retryCount: number;
}

export interface FlakinessReport {
  testName: string;
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  timeoutRuns: number;
  skippedRuns: number;
  flakinessScore: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  stdDev: number;
  projectBreakdown: Record<string, number>;
  commonErrors: Array<{ error: string; count: number }>;
  recommendation: string;
}

export class FlakinessAnalyzer {
  private runs: TestRun[] = [];
  private dataDir = 'test-analytics';

  constructor() {
    this.ensureDataDir();
  }

  private ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  recordTestRun(run: TestRun) {
    this.runs.push(run);
    this.persistRun(run);
  }

  private persistRun(run: TestRun) {
    const runsFile = path.join(this.dataDir, 'test-runs.jsonl');
    fs.appendFileSync(runsFile, JSON.stringify(run) + '\n');
  }

  loadTestRuns(): TestRun[] {
    const runsFile = path.join(this.dataDir, 'test-runs.jsonl');
    if (!fs.existsSync(runsFile)) return [];

    const content = fs.readFileSync(runsFile, 'utf-8');
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  analyzeFlakiness(): FlakinessReport[] {
    const runs = this.loadTestRuns();
    const groupedByTest = this.groupByTest(runs);

    return Array.from(groupedByTest.values())
      .map(testRuns => this.generateReport(testRuns))
      .sort((a, b) => b.flakinessScore - a.flakinessScore);
  }

  private groupByTest(
    runs: TestRun[]
  ): Map<string, TestRun[]> {
    const grouped = new Map<string, TestRun[]>();
    runs.forEach(run => {
      const key = run.testName;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(run);
    });
    return grouped;
  }

  private generateReport(testRuns: TestRun[]): FlakinessReport {
    const totalRuns = testRuns.length;
    const passedRuns = testRuns.filter(r => r.status === 'passed').length;
    const failedRuns = testRuns.filter(r => r.status === 'failed').length;
    const timeoutRuns = testRuns.filter(r => r.status === 'timedOut').length;
    const skippedRuns = testRuns.filter(r => r.status === 'skipped').length;

    const durations = testRuns.map(r => r.duration);
    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    const variance = durations.reduce((sum, d) => sum + Math.pow(d - averageDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);

    const flakinessScore = ((failedRuns + timeoutRuns) / totalRuns) * 100;

    const projectBreakdown: Record<string, number> = {};
    testRuns.forEach(run => {
      if (!projectBreakdown[run.projectName]) {
        projectBreakdown[run.projectName] = 0;
      }
      if (run.status !== 'passed') {
        projectBreakdown[run.projectName]++;
      }
    });

    const errorCounts = new Map<string, number>();
    testRuns.forEach(run => {
      if (run.error) {
        const key = run.error.substring(0, 100);
        errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
      }
    });

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const recommendation = this.getRecommendation(
      flakinessScore,
      stdDev,
      timeoutRuns,
      averageDuration
    );

    return {
      testName: testRuns[0].testName,
      totalRuns,
      passedRuns,
      failedRuns,
      timeoutRuns,
      skippedRuns,
      flakinessScore,
      averageDuration,
      maxDuration,
      minDuration,
      stdDev,
      projectBreakdown,
      commonErrors,
      recommendation
    };
  }

  private getRecommendation(
    flakinessScore: number,
    stdDev: number,
    timeoutRuns: number,
    averageDuration: number
  ): string {
    if (flakinessScore >= 50) {
      return 'CRITICAL: Test is highly flaky. Requires immediate investigation and refactoring.';
    }
    if (flakinessScore >= 20) {
      return 'HIGH: Test shows significant flakiness. Consider increasing timeouts or improving isolation.';
    }
    if (timeoutRuns > 0) {
      return 'MEDIUM: Test experiences timeouts. Consider increasing timeout values or optimizing performance.';
    }
    if (stdDev > averageDuration * 0.5) {
      return 'MEDIUM: Test has high variance in execution time. May benefit from improved stability.';
    }
    return 'LOW: Test appears stable. Monitor for regressions.';
  }

  generateFormattedReport(includeDetails: boolean = false): string {
    const reports = this.analyzeFlakiness();

    let output = '# Test Flakiness Analysis Report\n\n';
    output += `Generated: ${new Date().toISOString()}\n`;
    output += `Total tests analyzed: ${reports.length}\n\n`;

    const criticalTests = reports.filter(r => r.flakinessScore >= 50);
    const highRiskTests = reports.filter(r => r.flakinessScore >= 20 && r.flakinessScore < 50);

    if (criticalTests.length > 0) {
      output += `## Critical Tests (${criticalTests.length})\n\n`;
      criticalTests.forEach(r => {
        output += this.formatReportRow(r);
      });
    }

    if (highRiskTests.length > 0) {
      output += `## High Risk Tests (${highRiskTests.length})\n\n`;
      highRiskTests.forEach(r => {
        output += this.formatReportRow(r);
      });
    }

    if (includeDetails) {
      output += `## All Tests\n\n`;
      reports.forEach(r => {
        output += this.formatDetailedReport(r);
      });
    }

    return output;
  }

  private formatReportRow(report: FlakinessReport): string {
    let row = `### ${report.testName}\n`;
    row += `- Flakiness Score: ${report.flakinessScore.toFixed(1)}%\n`;
    row += `- Passed: ${report.passedRuns}/${report.totalRuns}\n`;
    row += `- Failed: ${report.failedRuns}, Timeouts: ${report.timeoutRuns}\n`;
    row += `- Duration: ${report.averageDuration.toFixed(0)}ms (min: ${report.minDuration.toFixed(0)}ms, max: ${report.maxDuration.toFixed(0)}ms, stdDev: ${report.stdDev.toFixed(0)}ms)\n`;
    row += `- Recommendation: ${report.recommendation}\n\n`;
    return row;
  }

  private formatDetailedReport(report: FlakinessReport): string {
    let detailed = `### ${report.testName}\n`;
    detailed += `- Total Runs: ${report.totalRuns}\n`;
    detailed += `- Passed: ${report.passedRuns} (${(report.passedRuns / report.totalRuns * 100).toFixed(1)}%)\n`;
    detailed += `- Failed: ${report.failedRuns} (${(report.failedRuns / report.totalRuns * 100).toFixed(1)}%)\n`;
    detailed += `- Timeouts: ${report.timeoutRuns}\n`;
    detailed += `- Skipped: ${report.skippedRuns}\n`;
    detailed += `- Flakiness Score: ${report.flakinessScore.toFixed(1)}%\n`;
    detailed += `- Avg Duration: ${report.averageDuration.toFixed(0)}ms\n`;
    detailed += `- Duration Range: ${report.minDuration.toFixed(0)}ms - ${report.maxDuration.toFixed(0)}ms\n`;
    detailed += `- Duration Std Dev: ${report.stdDev.toFixed(0)}ms\n`;

    if (Object.keys(report.projectBreakdown).length > 0) {
      detailed += `- Failures by Project:\n`;
      Object.entries(report.projectBreakdown).forEach(([project, failures]) => {
        detailed += `  - ${project}: ${failures}\n`;
      });
    }

    if (report.commonErrors.length > 0) {
      detailed += `- Common Errors:\n`;
      report.commonErrors.forEach(({ error, count }) => {
        detailed += `  - ${error.substring(0, 60)}... (${count} times)\n`;
      });
    }

    detailed += `- Recommendation: ${report.recommendation}\n\n`;
    return detailed;
  }

  saveReport(filename: string = 'flakiness-report.md') {
    const report = this.generateFormattedReport(true);
    const filepath = path.join(this.dataDir, filename);
    fs.writeFileSync(filepath, report);
    console.log(`Flakiness report saved to: ${filepath}`);
  }

  clearOldData(daysOld: number = 30) {
    const runsFile = path.join(this.dataDir, 'test-runs.jsonl');
    if (!fs.existsSync(runsFile)) return;

    const content = fs.readFileSync(runsFile, 'utf-8');
    const runs = content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line)) as TestRun[];

    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    const recentRuns = runs.filter(r => new Date(r.timestamp).getTime() > cutoffTime);

    fs.writeFileSync(runsFile, recentRuns.map(r => JSON.stringify(r)).join('\n'));
  }
}

export function createAnalyzer(): FlakinessAnalyzer {
  return new FlakinessAnalyzer();
}
