import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import { FlakinessAnalyzer, TestRun } from '../helpers/flakiness-analyzer';

export default class ReliabilityReporter implements Reporter {
  private analyzer = new FlakinessAnalyzer();

  onTestEnd(test: TestCase, result: TestResult) {
    const run: TestRun = {
      testName: test.title,
      projectName: test.project?.name || 'unknown',
      duration: result.duration,
      status: result.status as 'passed' | 'failed' | 'timedOut' | 'skipped',
      timestamp: new Date().toISOString(),
      error: result.error?.message,
      retryCount: result.retry
    };

    this.analyzer.recordTestRun(run);
  }

  onEnd(result: FullResult) {
    const flakinessReports = this.analyzer.analyzeFlakiness();

    const criticalTests = flakinessReports.filter(r => r.flakinessScore >= 50);
    const highRiskTests = flakinessReports.filter(r => r.flakinessScore >= 20 && r.flakinessScore < 50);
    const timeoutTests = flakinessReports.filter(r => r.timeoutRuns > 0);

    if (criticalTests.length > 0 || highRiskTests.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('RELIABILITY ANALYSIS');
      console.log('='.repeat(60));

      if (criticalTests.length > 0) {
        console.log(`\nCRITICAL FLAKINESS (${criticalTests.length} tests):`);
        criticalTests.slice(0, 5).forEach(r => {
          console.log(`  - ${r.testName}: ${r.flakinessScore.toFixed(1)}% flaky`);
        });
      }

      if (highRiskTests.length > 0) {
        console.log(`\nHIGH RISK (${highRiskTests.length} tests):`);
        highRiskTests.slice(0, 5).forEach(r => {
          console.log(`  - ${r.testName}: ${r.flakinessScore.toFixed(1)}% flaky`);
        });
      }

      if (timeoutTests.length > 0) {
        console.log(`\nTIMEOUT ISSUES (${timeoutTests.length} tests):`);
        timeoutTests.slice(0, 5).forEach(r => {
          console.log(`  - ${r.testName}: ${r.timeoutRuns} timeout(s)`);
        });
      }

      console.log('\nRun: npm run reliability:report');
      console.log('='.repeat(60));
    }

    this.analyzer.saveReport();
  }
}
