import { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import fs from 'fs';
import path from 'path';

interface FailureData {
  testName: string;
  status: string;
  error: string | null;
  duration: number;
  timestamp: string;
  projectName: string;
  file: string;
  line: number;
  attachments: string[];
}

export default class FailureContextReporter implements Reporter {
  private failureData: FailureData[] = [];
  private testResultsDir = 'failure-context';

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'failed' || result.status === 'timedOut') {
      const failureInfo: FailureData = {
        testName: test.title,
        status: result.status,
        error: result.error?.message || null,
        duration: result.duration,
        timestamp: new Date().toISOString(),
        projectName: test.project?.name || 'unknown',
        file: test.location?.file || '',
        line: test.location?.line || 0,
        attachments: result.attachments.map(a => a.name)
      };

      this.failureData.push(failureInfo);

      this.writeFailureData(failureInfo);
    }
  }

  onEnd(result: FullResult) {
    const summary = {
      totalTests: this.failureData.length,
      failures: this.failureData,
      generatedAt: new Date().toISOString()
    };

    this.ensureDir(this.testResultsDir);

    const summaryPath = path.join(this.testResultsDir, 'failure-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    if (this.failureData.length > 0) {
      console.log(`\nFailure Context Summary:`);
      console.log(`- Failed tests: ${this.failureData.length}`);
      console.log(`- Context saved to: ${this.testResultsDir}/`);
    }
  }

  private writeFailureData(failureInfo: FailureData) {
    this.ensureDir(this.testResultsDir);

    const sanitizedName = failureInfo.testName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `${sanitizedName}-${Date.now()}.json`;
    const filepath = path.join(this.testResultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(failureInfo, null, 2));
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
