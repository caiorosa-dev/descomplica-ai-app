import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = await buildApp({ env });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ host: '0.0.0.0', port: env.PORT });
