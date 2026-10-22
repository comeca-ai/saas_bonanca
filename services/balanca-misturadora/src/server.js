import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { catalog, ensure, number, validateRecord, buildBatch, summarize, recipeSummary, DomainError } from './domain.js';

const ORG_RE = /^[A-Za-z0-9_-]{8,100}$/;

function safeTokenEqual(supplied, expected) {
  if (!expected) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ dbPath = ':memory:', apiToken = process.env.BALANCA_SERVICE_TOKEN, allowAnonymous = false } = {}) {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS records(
      organization TEXT NOT NULL,
      type TEXT NOT NULL,
      id TEXT NOT NULL,
      body TEXT NOT NULL,
      PRIMARY KEY(organization,id)
    );
    CREATE TABLE IF NOT EXISTS audit(
      organization TEXT NOT NULL,
      id TEXT NOT NULL,
      at TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      actor TEXT NOT NULL,
      PRIMARY KEY(organization,id)
    );
    CREATE TABLE IF NOT EXISTS idempotency(
      organization TEXT NOT NULL,
      key TEXT NOT NULL,
      body TEXT NOT NULL,
      PRIMARY KEY(organization,key)
    );
  `);

  const list = (type, organization) => db.prepare('SELECT body FROM records WHERE organization=? AND type=? ORDER BY rowid DESC').all(organization, type).map(row => JSON.parse(row.body));
  const get = (type, id, organization) => {
    const row = db.prepare('SELECT body FROM records WHERE organization=? AND type=? AND id=?').get(organization, type, id);
    ensure(row, 'Registro não encontrado.', 404);
    return JSON.parse(row.body);
  };
  const audit = (organization, actor, action, entity) => db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(organization, randomUUID(), new Date().toISOString(), action, entity, actor);
  const put = (type, object, organization, actor) => {
    db.prepare('INSERT INTO records(organization,type,id,body) VALUES(?,?,?,?) ON CONFLICT(organization,id) DO UPDATE SET type=excluded.type, body=excluded.body').run(organization, type, object.id, JSON.stringify(object));
    audit(organization, actor, 'save', `${type}/${object.id}`);
    return object;
  };
  const record = (type, id, organization) => {
    const value = get(type, id, organization);
    ensure(value.enabled !== false, 'Registro inativo.');
    return value;
  };
  const stock = (ingredientId, organization) => list('movements', organization).filter(move => move.ingredientId === ingredientId).reduce((sum, move) => sum + move.kg, 0);
  const tx = fn => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  const context = req => {
    const organization = req.headers['x-bonanca-organization'] || (allowAnonymous ? 'local-test' : '');
    const actor = String(req.headers['x-bonanca-user'] || 'bonanca-service').slice(0, 120);
    ensure(ORG_RE.test(organization), 'Contexto de organização ausente ou inválido.', 401);
    if (!allowAnonymous) ensure(safeTokenEqual(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''), apiToken), 'Acesso interno não autorizado.', 401);
    return { organization, actor };
  };
  const readBody = async req => {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      ensure(Buffer.byteLength(raw) <= 256000, 'Conteúdo muito grande.', 413);
    }
    try { return JSON.parse(raw || '{}'); } catch { throw new DomainError('JSON inválido.', 400); }
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { status: 'ok', service: 'balanca-misturadora', version: '1.0' });
      ensure(parts[0] === 'api', 'Recurso não encontrado.', 404);
      const { organization, actor } = context(req);
      const [, type, id, action] = parts;
      let body = {};
      if (['POST', 'PUT'].includes(req.method)) {
        body = await readBody(req);
        ensure(body && typeof body === 'object' && !Array.isArray(body), 'Informe um objeto JSON.');
      }

      if (type === 'catalog' && req.method === 'GET') return json(res, 200, catalog);
      if (type === 'dashboard' && req.method === 'GET') {
        const from = url.searchParams.get('from') || '0000';
        const to = url.searchParams.get('to') || '9999';
        ensure(from <= to, 'A data inicial deve ser anterior à final.');
        return json(res, 200, summarize(list('batches', organization).filter(batch => batch.completedAt?.slice(0, 10) >= from && batch.completedAt?.slice(0, 10) <= to)));
      }
      if (type === 'audit' && req.method === 'GET') return json(res, 200, db.prepare('SELECT at,action,entity,actor FROM audit WHERE organization=? ORDER BY rowid DESC LIMIT 200').all(organization));
      if (type === 'sync' && req.method === 'POST') return json(res, 501, { message: 'Nenhum adaptador físico de balança foi homologado. Os dados locais foram preservados.' });
      if (type === 'stock' && req.method === 'GET') return json(res, 200, list('ingredients', organization).map(ingredient => ({ ...ingredient, balanceKg: stock(ingredient.id, organization) })));
      if (type === 'movements' && req.method === 'POST') return json(res, 201, tx(() => {
        record('ingredients', body.ingredientId, organization);
        number(body.kg, 'Quantidade', { min: 0.001 });
        ensure(['entry', 'adjustment'].includes(body.kind), 'Tipo de movimento inválido.');
        if (body.supplierId) record('suppliers', body.supplierId, organization);
        ensure(typeof body.notes === 'string' && body.notes.trim(), 'Informe a origem ou justificativa.');
        return put(type, { id: randomUUID(), ingredientId: body.ingredientId, kg: body.kg, kind: body.kind, notes: body.notes, supplierId: body.supplierId, at: new Date().toISOString() }, organization, actor);
      }));
      if (type === 'batches' && req.method === 'POST' && !id) return json(res, 201, tx(() => {
        const batch = buildBatch(record('recipes', body.recipeId, organization), record('machines', body.machineId, organization), record('pens', body.penId, organization), body.animals);
        if (body.feederId) record('feeders', body.feederId, organization);
        return put(type, { ...batch, id: randomUUID(), createdAt: new Date().toISOString(), feederId: body.feederId }, organization, actor);
      }));
      if (type === 'batches' && req.method === 'POST' && action === 'complete') return json(res, 200, tx(() => {
        const key = req.headers['idempotency-key'];
        ensure(typeof key === 'string' && key.length >= 8, 'Envie Idempotency-Key com pelo menos 8 caracteres.');
        const cached = db.prepare('SELECT body FROM idempotency WHERE organization=? AND key=?').get(organization, `${id}:${key}`);
        if (cached) return JSON.parse(cached.body);
        const batch = get(type, id, organization);
        ensure(batch.status === 'planned', 'Esta batida já foi encerrada.', 409);
        ensure(Array.isArray(body.actualKg) && body.actualKg.length === batch.lines.length, 'Informe a pesagem de todos os ingredientes.');
        const needed = {};
        batch.lines = batch.lines.map((line, index) => {
          const actualKg = number(body.actualKg[index], line.name);
          needed[line.ingredientId] = (needed[line.ingredientId] || 0) + actualKg;
          return { ...line, actualKg, deviationKg: actualKg - line.targetKg };
        });
        const total = batch.lines.reduce((sum, line) => sum + line.actualKg, 0);
        ensure(total > 0, 'A pesagem total deve ser maior que zero.');
        ensure(total <= get('machines', batch.machineId, organization).capacityKg, 'A pesagem excede a capacidade da máquina.');
        for (const [ingredientId, kg] of Object.entries(needed)) ensure(stock(ingredientId, organization) >= kg, `Estoque insuficiente para ${get('ingredients', ingredientId, organization).name}.`, 409);
        for (const line of batch.lines) put('movements', { id: randomUUID(), ingredientId: line.ingredientId, kg: -line.actualKg, kind: 'consumption', batchId: batch.id, at: new Date().toISOString() }, organization, actor);
        batch.status = 'completed';
        batch.completedAt = new Date().toISOString();
        put(type, batch, organization, actor);
        db.prepare('INSERT INTO idempotency VALUES(?,?,?)').run(organization, `${id}:${key}`, JSON.stringify(batch));
        return batch;
      }));
      if (type === 'batches' && req.method === 'POST' && action === 'cancel') return json(res, 200, tx(() => {
        const batch = get(type, id, organization);
        ensure(batch.status === 'planned', 'Apenas batidas planejadas podem ser canceladas.', 409);
        return put(type, { ...batch, status: 'cancelled' }, organization, actor);
      }));
      if (type === 'refusals' && req.method === 'POST') return json(res, 201, tx(() => {
        record('pens', body.penId, organization);
        number(body.kg, 'Sobra (kg)', { min: 0.001 });
        return put(type, { id: randomUUID(), penId: body.penId, kg: body.kg, at: new Date().toISOString() }, organization, actor);
      }));
      if (type === 'milking' && req.method === 'POST') return json(res, 201, tx(() => {
        record('pens', body.penId, organization);
        number(body.litres, 'Leite (L)');
        ensure(/^\d{4}-\d{2}-\d{2}$/.test(body.date) && !Number.isNaN(Date.parse(body.date)), 'Informe uma data válida.');
        return put(type, { id: randomUUID(), penId: body.penId, litres: body.litres, date: body.date, at: new Date().toISOString() }, organization, actor);
      }));
      const readable = [...Object.keys(catalog), 'batches', 'movements', 'refusals', 'milking'];
      ensure(readable.includes(type), 'Recurso não encontrado.', 404);
      if (req.method === 'GET') return json(res, 200, id ? get(type, id, organization) : list(type, organization));
      if (catalog[type] && ['POST', 'PUT'].includes(req.method)) return json(res, req.method === 'POST' ? 201 : 200, tx(() => {
        const old = id ? get(type, id, organization) : {};
        const data = validateRecord(type, body);
        ensure(!list(type, organization).some(row => row.id !== id && row.name.toLowerCase() === data.name.toLowerCase()), 'Já existe um registro com esse nome.', 409);
        if (type === 'machines') ensure(!list(type, organization).some(row => row.id !== id && row.serial === data.serial), 'Número de série já cadastrado.', 409);
        if (type === 'recipes') {
          ensure(Array.isArray(body.lines) && body.lines.length > 0, 'Adicione pelo menos um ingrediente.');
          const seen = new Set();
          data.lines = body.lines.map(line => {
            const ingredient = record('ingredients', line.ingredientId, organization);
            ensure(!seen.has(ingredient.id), 'Ingrediente repetido na receita.');
            seen.add(ingredient.id);
            number(line.kg, 'Peso por animal', { min: 0.001 });
            return { ingredientId: ingredient.id, name: ingredient.name, kg: line.kg, costKg: ingredient.costKg, dryMatter: ingredient.dryMatter };
          });
          data.summary = recipeSummary(data.lines);
          data.revision = (old.revision || 0) + 1;
          data.revisedAt = new Date().toISOString();
        }
        return put(type, { ...data, id: id || randomUUID(), createdAt: old.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }, organization, actor);
      }));
      throw new DomainError('Operação não permitida.', 405);
    } catch (error) {
      json(res, error.status || 500, { message: error.status ? error.message : 'Não foi possível concluir. Tente novamente.' });
    }
  });
  return { server, db, close: () => { server.close(); db.close(); } };
}

if (process.argv[1] && process.argv[1].endsWith('/src/server.js')) {
  const dbPath = process.env.DB_PATH || '/data/mixer.sqlite';
  mkdirSync(dbPath === ':memory:' ? '/tmp' : dbPath.substring(0, dbPath.lastIndexOf('/')) || '.', { recursive: true });
  const token = process.env.BALANCA_SERVICE_TOKEN || '';
  if (process.env.NODE_ENV === 'production' && (token.length < 24 || /^(troque-por-|change-me)/i.test(token))) throw new Error('BALANCA_SERVICE_TOKEN deve ser forte e não pode usar placeholder.');
  const { server } = createApp({ dbPath, apiToken: token });
  server.listen(Number(process.env.PORT) || 8080, '0.0.0.0', () => console.log(`[bonanca-balanca] ouvindo em ${process.env.PORT || 8080}`));
}
