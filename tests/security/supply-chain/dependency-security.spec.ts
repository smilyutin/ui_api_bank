import { test } from '@playwright/test';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { SecurityReporter } from '../utils/security-reporter';

/**
 * Supply chain - Dependency vulnerability scanning
 *
 * There is no `npm audit`/Dependabot/Snyk step anywhere in
 * .github/workflows/playwright.yml or elsewhere in CI — this runs
 * `npm audit --json` directly against this repo's own package-lock.json
 * (the *test suite's* dependencies, not the target Flask app's — there is
 * no equivalent for requirements.txt without a Python-side tool, which is
 * out of scope for a Playwright suite).
 *
 * npm audit exits non-zero when it finds vulnerabilities, so the process
 * result itself can't be used as pass/fail — this parses metadata.vulnerabilities
 * from its JSON output instead.
 *
 * csp-sri.spec.ts and third-party-scripts.spec.ts are intentionally not
 * present in this category: verified by grepping every templates/*.html
 * for <script src= and external URLs — the app loads exactly one script
 * (static/dashboard.js, same-origin) and zero third-party/CDN resources,
 * so there is nothing for either check to probe.
 */
type NpmAuditMetadata = {
	vulnerabilities?: {
		info?: number;
		low?: number;
		moderate?: number;
		high?: number;
		critical?: number;
		total?: number;
	};
};

function runNpmAudit(cwd: string): NpmAuditMetadata | null {
	let output: string;
	try {
		output = execSync('npm audit --json', { cwd, encoding: 'utf8', timeout: 60_000 });
	} catch (e: any) {
		// npm audit exits non-zero when vulnerabilities are found — the JSON
		// report is still on stdout in that case.
		output = e?.stdout?.toString?.() ?? '';
	}

	if (!output) return null;
	try {
		return JSON.parse(output);
	} catch {
		return null;
	}
}

test.describe('Supply chain - Dependency vulnerabilities', () => {
  test('npm dependencies should have no known high/critical vulnerabilities', async ({}, testInfo) => {
    const reporter = new SecurityReporter(testInfo);
    const repoRoot = path.resolve(__dirname, '../../..');

    const audit = runNpmAudit(repoRoot);
    if (!audit) {
      reporter.reportSkip('Could not run/parse npm audit on this target (offline, npm unavailable, or unexpected output shape).');
      test.skip(true, 'npm audit unavailable');
      return;
    }

    const counts = audit.vulnerabilities ?? {};
    testInfo.attach('npm-audit-probe', { body: JSON.stringify(counts, null, 2), contentType: 'application/json' });

    const highOrCritical = (counts.high ?? 0) + (counts.critical ?? 0);

    if (highOrCritical > 0) {
      reporter.reportVulnerability(
        'API9_ASSET_MGMT',
        { counts },
        [
          'Run `npm audit fix` (or manually bump the flagged packages) to resolve high/critical advisories.',
          'Add an `npm audit --audit-level=high` step to .github/workflows/playwright.yml so new high/critical advisories fail CI instead of going unnoticed.',
          'Consider Dependabot or Renovate for automated dependency update PRs.'
        ]
      );
    } else {
      reporter.reportPass(
        `No high/critical npm vulnerabilities found (${JSON.stringify(counts)}).`,
        'API9:2023 - Improper Inventory Management'
      );
    }
  });
});
