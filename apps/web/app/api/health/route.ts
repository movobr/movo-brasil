import { checkHealth } from '@movo/brasil/src/infrastructure/observability/health.js';

/** G5: health check para Traefik, CI smoke e Portainer. */
export async function GET(): Promise<Response> {
  const report = await checkHealth('0.1.0', []);
  return Response.json(report, { status: report.status === 'down' ? 503 : 200 });
}
