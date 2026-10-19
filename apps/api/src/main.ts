import { buildApp } from './app';
import { loadEnv } from './env';
import { markInterruptedRuns } from './runtime/pipeline-runner';

const env = loadEnv();
const app = await buildApp({ env });
const interrupted = await markInterruptedRuns(app.prisma);
if (interrupted > 0) app.log.warn({ interrupted }, 'runs marked as interrupted after restart');

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: '0.0.0.0', port: env.PORT });
