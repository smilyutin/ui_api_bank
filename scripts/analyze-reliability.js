const { FlakinessAnalyzer } = require('../helpers/flakiness-analyzer');
const fs = require('fs');
const path = require('path');

try {
  const analyzer = new FlakinessAnalyzer();

  console.log('\n' + '='.repeat(70));
  console.log('TEST RELIABILITY ANALYSIS');
  console.log('='.repeat(70) + '\n');

  const reports = analyzer.analyzeFlakiness();

  if (reports.length === 0) {
    console.log('No test data available yet. Run tests to collect data.');
    process.exit(0);
  }

  console.log(`Total tests analyzed: ${reports.length}\n`);

  const criticalTests = reports.filter(r => r.flakinessScore >= 50);
  const highRiskTests = reports.filter(r => r.flakinessScore >= 20 && r.flakinessScore < 50);
  const timeoutTests = reports.filter(r => r.timeoutRuns > 0);
  const stableTests = reports.filter(r => r.flakinessScore === 0);

  console.log(`Stable Tests (0% flaky): ${stableTests.length}`);
  console.log(`Low Risk Tests (1-20% flaky): ${reports.filter(r => r.flakinessScore > 0 && r.flakinessScore < 20).length}`);
  console.log(`High Risk Tests (20-50% flaky): ${highRiskTests.length}`);
  console.log(`Critical Tests (>50% flaky): ${criticalTests.length}`);
  console.log(`Tests with Timeout Issues: ${timeoutTests.length}\n`);

  if (criticalTests.length > 0) {
    console.log('CRITICAL FLAKINESS - REQUIRES IMMEDIATE ATTENTION:');
    console.log('-'.repeat(70));
    criticalTests.forEach((r, idx) => {
      console.log(`\n${idx + 1}. ${r.testName}`);
      console.log(`   Flakiness: ${r.flakinessScore.toFixed(1)}% (${r.failedRuns}/${r.totalRuns} failed)`);
      console.log(`   Duration: ${r.averageDuration.toFixed(0)}ms (range: ${r.minDuration.toFixed(0)}-${r.maxDuration.toFixed(0)}ms)`);
      console.log(`   Recommendation: ${r.recommendation}`);
      if (r.commonErrors.length > 0) {
        console.log(`   Common Errors:`);
        r.commonErrors.forEach(err => {
          console.log(`     - ${err.error.substring(0, 50)}... (${err.count}x)`);
        });
      }
    });
  }

  if (highRiskTests.length > 0) {
    console.log('\n\nHIGH RISK - NEEDS IMPROVEMENT:');
    console.log('-'.repeat(70));
    highRiskTests.slice(0, 10).forEach((r, idx) => {
      console.log(`\n${idx + 1}. ${r.testName}`);
      console.log(`   Flakiness: ${r.flakinessScore.toFixed(1)}% (${r.failedRuns}/${r.totalRuns} failed)`);
      console.log(`   Recommendation: ${r.recommendation}`);
    });
  }

  if (timeoutTests.length > 0) {
    console.log('\n\nTIMEOUT ISSUES:');
    console.log('-'.repeat(70));
    timeoutTests.forEach((r, idx) => {
      console.log(`\n${idx + 1}. ${r.testName}`);
      console.log(`   Timeouts: ${r.timeoutRuns}/${r.totalRuns}`);
      console.log(`   Avg Duration: ${r.averageDuration.toFixed(0)}ms (max: ${r.maxDuration.toFixed(0)}ms)`);
      console.log(`   Recommendation: ${r.recommendation}`);
    });
  }

  console.log('\n' + '='.repeat(70));
  console.log('Report saved to: test-analytics/flakiness-report.md');
  console.log('='.repeat(70) + '\n');

  process.exit(0);
} catch (error) {
  console.error('Error analyzing reliability:', error);
  process.exit(1);
}
