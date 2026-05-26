import { TestInfo } from '@playwright/test';

/**
 * Security Test Reporter
 * 
 * Provides comprehensive reporting for security tests including:
 * - Test results and vulnerability details
 * - Risk levels and severity ratings
 * - Remediation actions and recommendations
 * - OWASP references and best practices
 */

export enum SecurityRiskLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  INFO = 'INFO'
}

export enum SecurityTestStatus {
  PASS = 'PASS',
  FAIL = 'FAIL',
  SKIP = 'SKIP',
  WARNING = 'WARNING'
}

export interface SecurityTestResult {
  testName: string;
  status: SecurityTestStatus;
  owaspCategory: string;
  vulnerability?: string;
  riskLevel?: SecurityRiskLevel;
  description: string;
  evidence?: any;
  recommendations?: string[];
  remediationSteps?: string[];
  references?: string[];
  timestamp: string;
}

/**
 * OWASP API Security Top 10 vulnerability definitions with remediation guidance
 */
export const OWASP_VULNERABILITIES = {
  API1_BOLA: {
    name: 'API1:2023 - Broken Object Level Authorization',
    description: 'Attackers can exploit API endpoints that are vulnerable to broken object level authorization by manipulating the ID of an object sent within the request.',
    riskLevel: SecurityRiskLevel.CRITICAL,
    recommendations: [
      'Implement proper authorization checks for every object access',
      'Validate user permissions before returning sensitive data',
      'Use random, unpredictable resource identifiers (UUIDs)',
      'Avoid exposing internal object IDs in API responses',
      'Log and monitor all object access attempts'
    ],
    remediationSteps: [
      '1. Review all endpoints that accept object IDs',
      '2. Implement authorization middleware that validates ownership',
      '3. Add unit tests for authorization on all resource endpoints',
      '4. Use policy-based authorization (e.g., RBAC, ABAC)',
      '5. Implement audit logging for sensitive resource access'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'
    ]
  },
  API2_AUTH: {
    name: 'API2:2023 - Broken Authentication',
    description: 'Authentication mechanisms are often implemented incorrectly, allowing attackers to compromise authentication tokens or exploit implementation flaws.',
    riskLevel: SecurityRiskLevel.CRITICAL,
    recommendations: [
      'Use industry-standard authentication mechanisms (OAuth 2.0, OpenID Connect)',
      'Implement strong password policies and MFA',
      'Use secure session management with proper timeouts',
      'Protect credentials in transit and at rest',
      'Implement account lockout mechanisms after failed attempts'
    ],
    remediationSteps: [
      '1. Audit all authentication endpoints and flows',
      '2. Implement rate limiting on authentication endpoints',
      '3. Use bcrypt/argon2 for password hashing (cost factor ≥ 12)',
      '4. Implement JWT with short expiration times',
      '5. Add refresh token rotation mechanism',
      '6. Enable MFA for sensitive operations'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa2-broken-authentication/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html'
    ]
  },
  API3_DATA_EXPOSURE: {
    name: 'API3:2023 - Broken Object Property Level Authorization',
    description: 'APIs tend to expose sensitive object properties without proper filtering, leading to excessive data exposure.',
    riskLevel: SecurityRiskLevel.HIGH,
    recommendations: [
      'Never include sensitive fields in API responses (passwords, tokens, etc.)',
      'Implement response filtering based on user permissions',
      'Use Data Transfer Objects (DTOs) to control exposed fields',
      'Validate and sanitize all API responses',
      'Document what data should be exposed for each endpoint'
    ],
    remediationSteps: [
      '1. Audit all API responses for sensitive data exposure',
      '2. Create serializers/DTOs that explicitly define allowed fields',
      '3. Remove password hashes, tokens, and internal IDs from responses',
      '4. Implement field-level authorization checks',
      '5. Add automated tests to detect sensitive data in responses',
      '6. Use allow-lists instead of block-lists for field exposure'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html'
    ]
  },
  API4_RATE_LIMIT: {
    name: 'API4:2023 - Unrestricted Resource Consumption',
    description: 'APIs often do not impose restrictions on the size or number of resources that can be requested, leaving them vulnerable to DoS attacks.',
    riskLevel: SecurityRiskLevel.HIGH,
    recommendations: [
      'Implement rate limiting on all API endpoints',
      'Set maximum page sizes for paginated responses',
      'Add request timeouts and payload size limits',
      'Monitor and alert on unusual traffic patterns',
      'Use API gateways for centralized rate limiting'
    ],
    remediationSteps: [
      '1. Implement rate limiting middleware (e.g., 100 requests/minute per user)',
      '2. Add rate limit headers (X-RateLimit-Limit, X-RateLimit-Remaining)',
      '3. Return 429 status code when rate limit exceeded',
      '4. Set maximum request body size (e.g., 10MB)',
      '5. Implement pagination with maximum page size (e.g., 100 items)',
      '6. Add request queue monitoring and alerting',
      '7. Consider implementing CAPTCHA for public endpoints'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html'
    ]
  },
  API5_BFLA: {
    name: 'API5:2023 - Broken Function Level Authorization',
    description: 'Access control policies are often poorly enforced, allowing unauthorized users to access administrative functions.',
    riskLevel: SecurityRiskLevel.CRITICAL,
    recommendations: [
      'Deny access by default to all administrative functions',
      'Implement role-based access control (RBAC)',
      'Verify user roles/permissions on every request',
      'Separate admin and user API endpoints clearly',
      'Audit administrative function access regularly'
    ],
    remediationSteps: [
      '1. Map all API endpoints and required permissions',
      '2. Implement authorization middleware for all routes',
      '3. Use decorators/annotations for permission requirements',
      '4. Add integration tests for authorization on all endpoints',
      '5. Review and remove any "admin" parameters in requests',
      '6. Implement principle of least privilege'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html'
    ]
  },
  API6_MASS_ASSIGNMENT: {
    name: 'API6:2023 - Unrestricted Access to Sensitive Business Flows',
    description: 'Mass assignment vulnerabilities occur when APIs automatically bind request parameters to internal objects, allowing attackers to modify sensitive fields.',
    riskLevel: SecurityRiskLevel.HIGH,
    recommendations: [
      'Use allowlists for bindable object properties',
      'Never allow mass assignment of sensitive fields (isAdmin, role, etc.)',
      'Validate and sanitize all input data',
      'Use separate DTOs for create/update operations',
      'Implement explicit field assignment instead of automatic binding'
    ],
    remediationSteps: [
      '1. Identify all endpoints that accept object creation/updates',
      '2. Create explicit DTOs with only allowed fields',
      '3. Disable automatic parameter binding in your framework',
      '4. Add validation for sensitive fields (role, permissions, etc.)',
      '5. Use readonly decorators for fields that should never be updated',
      '6. Add tests that attempt to modify sensitive fields',
      '7. Review and remove any privilege escalation possibilities'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html'
    ]
  },
  API7_MISCONFIGURATION: {
    name: 'API7:2023 - Server Side Request Forgery',
    description: 'Security misconfigurations include missing security headers, verbose error messages, and exposed sensitive information.',
    riskLevel: SecurityRiskLevel.MEDIUM,
    recommendations: [
      'Implement all recommended security headers',
      'Disable detailed error messages in production',
      'Remove server version information from headers',
      'Use HTTPS for all API communications',
      'Regularly update and patch dependencies'
    ],
    remediationSteps: [
      '1. Add Content-Security-Policy header',
      '2. Add X-Frame-Options: DENY or SAMEORIGIN',
      '3. Add X-Content-Type-Options: nosniff',
      '4. Add Strict-Transport-Security header (HSTS)',
      '5. Remove or obscure Server and X-Powered-By headers',
      '6. Configure proper CORS policies',
      '7. Disable debug mode and verbose error messages in production',
      '8. Implement centralized error handling with sanitized messages'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa7-server-side-request-forgery/',
      'https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html'
    ]
  },
  API8_SECURITY_MISCONFIGURATION: {
    name: 'API8:2023 - Security Misconfiguration',
    description: 'Injection flaws occur when untrusted data is sent as part of a command or query, allowing attackers to execute unintended commands.',
    riskLevel: SecurityRiskLevel.CRITICAL,
    recommendations: [
      'Use parameterized queries (prepared statements) for all database access',
      'Validate and sanitize all user input',
      'Implement input validation with allowlists',
      'Use ORM/query builders instead of raw SQL',
      'Escape special characters in user input'
    ],
    remediationSteps: [
      '1. Replace all string concatenation in queries with parameterized queries',
      '2. Implement input validation middleware',
      '3. Use ORM frameworks with built-in protection',
      '4. Add Web Application Firewall (WAF) rules',
      '5. Implement least-privilege database access',
      '6. Sanitize error messages to avoid information disclosure',
      '7. Add automated SAST/DAST scanning for injection vulnerabilities',
      '8. Review and test all data processing endpoints'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/',
      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      'https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html'
    ]
  },
  API9_ASSET_MGMT: {
    name: 'API9:2023 - Improper Inventory Management',
    description: 'Old API versions or debug endpoints left accessible can provide attack vectors.',
    riskLevel: SecurityRiskLevel.MEDIUM,
    recommendations: [
      'Maintain an inventory of all API versions and endpoints',
      'Deprecate and remove old API versions',
      'Disable debug endpoints in production',
      'Use API versioning strategy consistently',
      'Document all API endpoints and their security requirements'
    ],
    remediationSteps: [
      '1. Create comprehensive API documentation',
      '2. Implement API versioning (e.g., /api/v1/, /api/v2/)',
      '3. Set sunset dates for old API versions',
      '4. Remove or secure debug/test endpoints',
      '5. Use environment-specific configurations',
      '6. Implement API discovery and inventory tools',
      '7. Regularly audit exposed endpoints'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/',
      'https://owasp.org/www-project-api-security/'
    ]
  },
  API10_LOGGING: {
    name: 'API10:2023 - Unsafe Consumption of APIs',
    description: 'Insufficient logging and monitoring allow attacks to go undetected and facilitate damage assessment.',
    riskLevel: SecurityRiskLevel.MEDIUM,
    recommendations: [
      'Log all authentication attempts, failures, and access control violations',
      'Implement centralized logging with proper retention',
      'Set up real-time alerting for security events',
      'Never log sensitive data (passwords, tokens, PII)',
      'Monitor for unusual patterns and anomalies'
    ],
    remediationSteps: [
      '1. Implement structured logging throughout the application',
      '2. Log security-relevant events (auth failures, permission denials)',
      '3. Add correlation IDs for request tracking',
      '4. Set up log aggregation (e.g., ELK Stack, Splunk)',
      '5. Create alerts for suspicious patterns',
      '6. Implement log integrity protection',
      '7. Define log retention policies',
      '8. Regularly review logs and create incident response procedures'
    ],
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xaa-unsafe-consumption-of-apis/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html'
    ]
  }
};

/**
 * Security Test Reporter Class
 */
export class SecurityReporter {
  private results: SecurityTestResult[] = [];
  private testInfo: TestInfo;

  constructor(testInfo: TestInfo) {
    this.testInfo = testInfo;
  }

  /**
   * Report a security test result with full details
   */
  report(result: Partial<SecurityTestResult>) {
    const fullResult: SecurityTestResult = {
      testName: result.testName || this.testInfo.title,
      status: result.status || SecurityTestStatus.PASS,
      owaspCategory: result.owaspCategory || 'N/A',
      vulnerability: result.vulnerability,
      riskLevel: result.riskLevel,
      description: result.description || '',
      evidence: result.evidence,
      recommendations: result.recommendations || [],
      remediationSteps: result.remediationSteps || [],
      references: result.references || [],
      timestamp: new Date().toISOString()
    };

    this.results.push(fullResult);
    this.attachReport(fullResult);
  }

  /**
   * Report a vulnerability finding with OWASP reference
   */
  reportVulnerability(
    owaspKey: keyof typeof OWASP_VULNERABILITIES,
    evidence: any,
    additionalRecommendations?: string[]
  ) {
    const owasp = OWASP_VULNERABILITIES[owaspKey];
    
    const result: SecurityTestResult = {
      testName: this.testInfo.title,
      status: SecurityTestStatus.FAIL,
      owaspCategory: owasp.name,
      vulnerability: owasp.name,
      riskLevel: owasp.riskLevel,
      description: owasp.description,
      evidence,
      recommendations: [
        ...owasp.recommendations,
        ...(additionalRecommendations || [])
      ],
      remediationSteps: owasp.remediationSteps,
      references: owasp.references,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    this.attachReport(result);
    
    // Add Playwright annotation
    this.testInfo.annotations.push({
      type: 'security-vulnerability',
      description: `${owasp.riskLevel}: ${owasp.name}`
    });
    
    // Add Allure labels and metadata
    this.addAllureMetadata(result);
  }

  /**
   * Report a passing security test
   */
  reportPass(description: string, owaspCategory?: string) {
    const result: SecurityTestResult = {
      testName: this.testInfo.title,
      status: SecurityTestStatus.PASS,
      owaspCategory: owaspCategory || 'N/A',
      description,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    this.attachReport(result);
    this.addAllureMetadata(result);
  }

  /**
   * Report a skipped test
   */
  reportSkip(reason: string) {
    const result: SecurityTestResult = {
      testName: this.testInfo.title,
      status: SecurityTestStatus.SKIP,
      owaspCategory: 'N/A',
      description: `Test skipped: ${reason}`,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    this.attachReport(result);
  }

  /**
   * Report a warning (test passed but with concerns)
   */
  reportWarning(description: string, recommendations: string[], owaspCategory?: string) {
    const result: SecurityTestResult = {
      testName: this.testInfo.title,
      status: SecurityTestStatus.WARNING,
      owaspCategory: owaspCategory || 'N/A',
      description,
      recommendations,
      riskLevel: SecurityRiskLevel.LOW,
      timestamp: new Date().toISOString()
    };

    this.results.push(result);
    this.attachReport(result);
    
    this.testInfo.annotations.push({
      type: 'security-warning',
      description
    });
    
    this.addAllureMetadata(result);

        if (process.env.SECURITY_SOFT !== '1') {
          const recommendationText = recommendations.length > 0
            ? ` Recommended fixes: ${recommendations.join(' | ')}`
            : '';
          throw new Error(`${description}${recommendationText}`);
        }
  }

  /**
   * Attach report to test results
   */
  private attachReport(result: SecurityTestResult) {
    const report = this.formatReport(result);
    
    // Always log summary to console for visibility
    const statusSymbol = {
      [SecurityTestStatus.PASS]: '',
      [SecurityTestStatus.FAIL]: '',
      [SecurityTestStatus.SKIP]: '',
      [SecurityTestStatus.WARNING]: ''
    };
    
    console.log(`\n${statusSymbol[result.status]} ${result.testName}`);
    if (result.status === SecurityTestStatus.FAIL && result.riskLevel) {
      console.log(`   Risk: ${result.riskLevel} | ${result.owaspCategory}`);
    }
    if (result.status === SecurityTestStatus.SKIP) {
      console.log(`   Reason: ${result.description}`);
    }
    
    try {
      this.testInfo.attach(`security-report-${Date.now()}`, {
        body: report,
        contentType: 'text/plain'
      });
    } catch (e) {
      // Fallback to full console output
      console.log(report);
    }
  }

  /**
   * Format report as readable markdown
   */
  private getResultExplanation(result: SecurityTestResult): string {
    const evidenceReason = this.getEvidenceReason(result.evidence);
    const description = result.status === SecurityTestStatus.SKIP
      ? result.description.replace(/^Test skipped:\s*/i, '').trim()
      : result.description.trim();

    if (result.status === SecurityTestStatus.PASS) {
      return evidenceReason
        ? `Passed because ${evidenceReason}`
        : description
          ? `Passed because ${description}`
          : `Passed because the tested behavior matched the expected secure outcome.`;
    }

    if (result.status === SecurityTestStatus.FAIL) {
      return evidenceReason
        ? `Failed because ${evidenceReason}`
        : description
          ? `Failed because ${description}`
          : `Failed because the test detected a security issue or unsafe behavior.`;
    }

    if (result.status === SecurityTestStatus.SKIP) {
      return evidenceReason
        ? `Skipped because ${evidenceReason}`
        : description
          ? `Skipped because ${description}`
          : `Skipped because the prerequisites for this test were not met.`;
    }

    return evidenceReason
      ? `Completed with warning because ${evidenceReason}`
      : description
        ? `Completed with warning because ${description}`
        : `Completed with warning because the test found a concern that did not warrant a hard failure.`;
  }

  private getEvidenceReason(evidence: any): string | null {
    if (!evidence) return null;

    if (typeof evidence === 'string') {
      return evidence;
    }

    if (Array.isArray(evidence)) {
      return evidence.length > 0 ? this.getEvidenceReason(evidence[0]) : null;
    }

    if (typeof evidence === 'object') {
      const keys = ['issue', 'reason', 'message', 'description', 'detail'];
      for (const key of keys) {
        const value = evidence[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }

      if (Array.isArray(evidence.issues) && evidence.issues.length > 0) {
        return this.getEvidenceReason(evidence.issues[0]);
      }

      if (Array.isArray(evidence.examples) && evidence.examples.length > 0) {
        return this.getEvidenceReason(evidence.examples[0]);
      }

      if (evidence.vulnerability && typeof evidence.vulnerability === 'string') {
        return evidence.vulnerability;
      }
    }

    return null;
  }

  private formatReport(result: SecurityTestResult): string {
    const statusEmoji = {
      [SecurityTestStatus.PASS]: '',
      [SecurityTestStatus.FAIL]: '',
      [SecurityTestStatus.SKIP]: '',
      [SecurityTestStatus.WARNING]: ''
    };

    const riskEmoji = {
      [SecurityRiskLevel.CRITICAL]: '',
      [SecurityRiskLevel.HIGH]: '',
      [SecurityRiskLevel.MEDIUM]: '',
      [SecurityRiskLevel.LOW]: '',
      [SecurityRiskLevel.INFO]: ''
    };

    let report = `# Security Test Report\n\n`;
    report += `## ${statusEmoji[result.status]} Test Result: ${result.status}\n\n`;
    report += `**Test:** ${result.testName}\n`;
    report += `**Timestamp:** ${result.timestamp}\n`;
    report += `**OWASP Category:** ${result.owaspCategory}\n`;

    if (result.riskLevel) {
      report += `**Risk Level:** ${riskEmoji[result.riskLevel]} ${result.riskLevel}\n`;
    }

    report += `\n## Description\n\n${result.description}\n`;

    report += `\n## Why this result\n\n${this.getResultExplanation(result)}\n`;

    if (result.vulnerability) {
      report += `\n##  Vulnerability Detected\n\n${result.vulnerability}\n`;
    }

    if (result.evidence) {
      report += `\n## Evidence\n\n\`\`\`json\n${JSON.stringify(result.evidence, null, 2)}\n\`\`\`\n`;
    }

    if (result.recommendations && result.recommendations.length > 0) {
      report += `\n##  Recommendations\n\n`;
      result.recommendations.forEach((rec, idx) => {
        report += `${idx + 1}. ${rec}\n`;
      });
    }

    if (result.remediationSteps && result.remediationSteps.length > 0) {
      report += `\n##  Remediation Steps\n\n`;
      result.remediationSteps.forEach(step => {
        report += `${step}\n`;
      });
    }

    if (result.references && result.references.length > 0) {
      report += `\n##  References\n\n`;
      result.references.forEach(ref => {
        report += `- ${ref}\n`;
      });
    }

    report += `\n---\n`;
    report += `*Generated by Security Test Reporter*\n`;

    return report;
  }

  /**
   * Get summary of all results
   */
  getSummary(): string {
    const passed = this.results.filter(r => r.status === SecurityTestStatus.PASS).length;
    const failed = this.results.filter(r => r.status === SecurityTestStatus.FAIL).length;
    const skipped = this.results.filter(r => r.status === SecurityTestStatus.SKIP).length;
    const warnings = this.results.filter(r => r.status === SecurityTestStatus.WARNING).length;

    return `Security Tests Summary: ${passed} passed, ${failed} failed, ${warnings} warnings, ⏭️ ${skipped} skipped`;
  }

  /**
   * Get all results
   */
  getResults(): SecurityTestResult[] {
    return this.results;
  }
  
  /**
   * Add Allure-specific metadata for better visualization
   */
  private addAllureMetadata(result: SecurityTestResult) {
    // Add severity label
    if (result.riskLevel) {
      const severityMap = {
        [SecurityRiskLevel.CRITICAL]: 'blocker',
        [SecurityRiskLevel.HIGH]: 'critical',
        [SecurityRiskLevel.MEDIUM]: 'normal',
        [SecurityRiskLevel.LOW]: 'minor',
        [SecurityRiskLevel.INFO]: 'trivial'
      };
      
      this.testInfo.annotations.push({
        type: 'severity',
        description: severityMap[result.riskLevel]
      });
    }
    
    // Add OWASP category as tag
    if (result.owaspCategory && result.owaspCategory !== 'N/A') {
      this.testInfo.annotations.push({
        type: 'tag',
        description: result.owaspCategory.split(':')[0] // e.g., "API3:2023" -> "API3"
      });
      
      this.testInfo.annotations.push({
        type: 'epic',
        description: 'OWASP API Security Top 10'
      });
    }
    
    // Add links to OWASP documentation
    if (result.references && result.references.length > 0) {
      result.references.forEach((ref, idx) => {
        this.testInfo.annotations.push({
          type: 'link',
          description: `OWASP Reference ${idx + 1}: ${ref}`
        });
      });
    }
    
    // Add feature label
    const feature = result.testName.split(':')[0].trim();
    this.testInfo.annotations.push({
      type: 'feature',
      description: feature
    });
  }
}
