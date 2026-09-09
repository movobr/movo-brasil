/** Health/readiness — 36-OBSERVABILITY + G5. */
export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface DependencyCheck {
  readonly name: string;
  check(): Promise<boolean>;
}

export interface HealthReport {
  readonly status: HealthStatus;
  readonly version: string;
  readonly checks: ReadonlyArray<{ name: string; ok: boolean }>;
}

export async function checkHealth(version: string, dependencies: ReadonlyArray<DependencyCheck>): Promise<HealthReport> {
  const checks = [];
  for (const dependency of dependencies) {
    let ok = false;
    try {
      ok = await dependency.check();
    } catch {
      ok = false;
    }
    checks.push({ name: dependency.name, ok });
  }
  const failed = checks.filter((c) => !c.ok).length;
  const status: HealthStatus = failed === 0 ? 'healthy' : failed < checks.length ? 'degraded' : 'down';
  return { status, version, checks };
}
