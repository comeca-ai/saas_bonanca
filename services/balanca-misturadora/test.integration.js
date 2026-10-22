import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './src/server.js';

const token = 'balanca-integration-token-123456';

test('balança isola organizações e conclui batida de modo idempotente', async t => {
  const app = createApp({ apiToken: token });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}/api/`;
  const call = async (path, method = 'GET', body, { organization = 'organization-demo-001', idempotencyKey } = {}) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Bonanca-Organization': organization,
        'X-Bonanca-User': '42',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };

  assert.equal((await fetch(base + 'catalog')).status, 401);
  const ingredient = (await call('ingredients', 'POST', { name: 'Milho', costKg: 2.1, dryMatter: 88 })).data;
  const machine = (await call('machines', 'POST', { name: 'Misturador 01', category: 'Misturador', capacityKg: 500, serial: 'MIX-001' })).data;
  const pen = (await call('pens', 'POST', { name: 'Curral A', animals: 10 })).data;
  const recipe = (await call('recipes', 'POST', { name: 'Dieta inicial', mixSeconds: 180, lines: [{ ingredientId: ingredient.id, kg: 3 }] })).data;
  await call('movements', 'POST', { ingredientId: ingredient.id, kg: 40, kind: 'entry', notes: 'Romaneio R-001' });
  const batch = (await call('batches', 'POST', { recipeId: recipe.id, machineId: machine.id, penId: pen.id, animals: 10 })).data;
  const complete = await call(`batches/${batch.id}/complete`, 'POST', { actualKg: [31] }, { idempotencyKey: 'batch-test-key-001' });
  assert.equal(complete.status, 200);
  assert.equal((await call(`batches/${batch.id}/complete`, 'POST', { actualKg: [31] }, { idempotencyKey: 'batch-test-key-001' })).status, 200);
  assert.equal((await call('stock')).data[0].balanceKg, 9);
  assert.equal((await call('ingredients', 'GET', undefined, { organization: 'organization-demo-002' })).data.length, 0);
});
