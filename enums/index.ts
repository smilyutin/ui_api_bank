export const EnvironmentName = {
  local: 'local',
  ci: 'ci',
  dev: 'dev',
  test: 'test'
} as const;

export type EnvironmentName = (typeof EnvironmentName)[keyof typeof EnvironmentName];
