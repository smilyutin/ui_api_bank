import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Prints one compact table of every SecurityReporter.reportVulnerability()
 * finding at the end of a run, so real findings are visible without opening
 * every passed test's attachment. reportVulnerability() never throws (see
 * fixtures/helper/security-reporter.ts), so these tests stay green and never
 * block a PR — this reporter is purely additional visibility, it does not
 * change pass/fail status for anything.
 */
interface Finding {
	testName: string;
	riskLevel: string;
	owaspCategory: string;
	count: number;
}

class SecuritySummaryReporter implements Reporter {
	private findings = new Map<string, Finding>();

	onTestEnd(test: TestCase, result: TestResult) {
		for (const annotation of result.annotations) {
			if (annotation.type !== 'security-vulnerability') continue;

			// Pushed as `${riskLevel}: ${owaspName}` in reportVulnerability().
			const description = annotation.description ?? '';
			const separatorIndex = description.indexOf(': ');
			const riskLevel = separatorIndex === -1 ? 'UNKNOWN' : description.slice(0, separatorIndex);
			const owaspCategory = separatorIndex === -1 ? description : description.slice(separatorIndex + 2);

			const key = `${test.title}|${riskLevel}|${owaspCategory}`;
			const existing = this.findings.get(key);
			if (existing) {
				existing.count += 1;
			} else {
				this.findings.set(key, { testName: test.title, riskLevel, owaspCategory, count: 1 });
			}
		}
	}

	onEnd(_result: FullResult) {
		if (this.findings.size === 0) return;

		const rows = [...this.findings.values()];
		const nameWidth = Math.max(9, ...rows.map((f) => f.testName.length));
		const riskWidth = Math.max(4, ...rows.map((f) => f.riskLevel.length));
		const categoryWidth = Math.max(14, ...rows.map((f) => f.owaspCategory.length));

		const row = (testName: string, riskLevel: string, owaspCategory: string, count: string) =>
			`${testName.padEnd(nameWidth)}  ${riskLevel.padEnd(riskWidth)}  ${owaspCategory.padEnd(categoryWidth)}  ${count}`;

		console.log("\nSecurity findings (reportVulnerability) - tests still pass; see each test's attached report for full recommendations.");
		console.log(row('Test', 'Risk', 'OWASP Category', 'Count'));
		console.log('-'.repeat(nameWidth + riskWidth + categoryWidth + 12));
		for (const f of rows) {
			console.log(row(f.testName, f.riskLevel, f.owaspCategory, String(f.count)));
		}

		const total = rows.reduce((sum, f) => sum + f.count, 0);
		console.log(`\nTotal: ${total} finding(s) across ${rows.length} distinct check(s).`);
	}
}

export default SecuritySummaryReporter;
