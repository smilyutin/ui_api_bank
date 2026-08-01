// Environment context: where tests run (local dev, CI, staging, test).
export const EnvironmentName = {
  local: 'local',
  ci: 'ci',
  dev: 'dev',
  test: 'test'
} as const;

export type EnvironmentName = (typeof EnvironmentName)[keyof typeof EnvironmentName];
