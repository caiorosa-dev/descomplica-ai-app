import { ProvidersDto } from '@app/shared';
import { createTestApp } from './helpers/app';

test('/providers reflects env', async () => {
  const app = await createTestApp({ env: { ANTHROPIC_API_KEY: undefined } });
  const res = await app.inject({ method: 'GET', url: '/providers' });
  expect(res.statusCode).toBe(200);
  const body = ProvidersDto.parse(res.json());
  expect(body.providers).toEqual([
    { id: 'openai', configured: true },
    { id: 'anthropic', configured: false },
  ]);
  expect(body.models.length).toBeGreaterThan(0);
  await app.close();
});
