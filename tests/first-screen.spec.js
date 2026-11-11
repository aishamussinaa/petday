import { test, expect } from '@playwright/test';

test('API напрямую, через proxy и неизвестный маршрут', async ({ request }) => {
  for (const url of ['http://127.0.0.1:3011/api/health', '/api/health']) {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  }
  const missing = await request.get('/api/missing');
  expect(missing.status()).toBe(404);
  expect(await missing.json()).toEqual({ error: { code: 'API_NOT_FOUND' } });
  const malformed = await request.post('/api/health', {
    headers: { 'Content-Type': 'application/json' }, data: '{',
  });
  expect(malformed.status()).toBe(400);
  expect(await malformed.json()).toEqual({ error: { code: 'INVALID_JSON' } });
});

