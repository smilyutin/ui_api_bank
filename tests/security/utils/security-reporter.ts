/**
 * Re-exports this project's canonical `SecurityReporter`
 * (fixtures/helper/security-reporter.ts) under tests/security/utils/ to
 * match this suite's expected layout, without duplicating the OWASP API
 * Security Top 10 vulnerability definitions it already contains. All
 * OWASP-tagged reporting across tests/security/ goes through this one
 * implementation.
 */
export * from '../../../fixtures/helper/security-reporter';
