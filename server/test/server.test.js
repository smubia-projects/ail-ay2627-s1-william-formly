// Runs the API against a stub OpenAI-compatible server (no real key, limiter off).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';

let stub, api, seen = [];
const PORT = 18080 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${PORT}`;

function reply(body) {
  const prompt = body.messages[1].content;
  if (prompt.includes('<questions>')) return '```json\n{"answers":[{"id":"f1","value":"Alex Tan"}]}\n```';
  if (prompt.startsWith('Keys:')) return '{"profile":{"fullName":"Alex Tan"}}';
  return '{"facts":[{"label":"Telegram username","value":"@alextan","section":"Contact","keep":true}]}';
}

function startApi(env) {
  const p = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(PORT), ...env }, stdio: 'pipe' });
  return new Promise((ok) => p.stdout.on('data', (d) => String(d).includes('Formly API') && ok(p)));
}

before(async () => {
  stub = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      const body = JSON.parse(b);
      seen.push({ auth: req.headers.authorization, body });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: reply(body) } }] }));
    });
  }).listen(0);
  api = await startApi({
    API_BASE_URL: `http://127.0.0.1:${stub.address().port}/v1`, API_KEY: 'test-key', MODEL_NAME: 'stub-model',
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_URL: '', CORS_ORIGINS: 'http://localhost:5173',
  });
});
after(() => { api?.kill(); stub?.close(); });

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const fields = [{ id: 'f1', question: 'Full name', type: 'short_text' }];

test('health', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'ok' });
});

test('no static frontend', async () => {
  assert.equal((await fetch(base + '/')).status, 404);
});

test('answer: validation runs before any model call', async () => {
  const n = seen.length;
  assert.equal((await post('/api/answer', { fields: [] })).status, 400);
  assert.equal((await post('/api/answer', { fields, profile: '', docText: '' })).status, 400);
  assert.equal(seen.length, n);
});

test('answer: fills from the model (code fences stripped) with the env model and key', async () => {
  const r = await post('/api/answer', { fields, profile: 'Full name: Alex Tan', page: { title: 't', url: 'u', intro: 'i' } });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).answers, [{ id: 'f1', value: 'Alex Tan' }]);
  const last = seen.at(-1);
  assert.equal(last.body.model, 'stub-model');
  assert.equal(last.auth, 'Bearer test-key');
  assert.equal(last.body.usage, undefined);
});

test('extract-profile and learn', async () => {
  const e = await post('/api/extract-profile', { text: 'Alex Tan resume', keys: [['fullName', 'Full name']] });
  assert.deepEqual((await e.json()).profile, { fullName: 'Alex Tan' });
  const l = await post('/api/learn', { boxList: 'Contact: Email', items: [{ question: 'Telegram', answer: '@alextan' }] });
  assert.equal((await l.json()).facts[0].label, 'Telegram username');
});

test('CORS allows the configured origin only', async () => {
  const ok = await fetch(base + '/api/health', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  const no = await fetch(base + '/api/health', { headers: { origin: 'https://evil.example' } });
  assert.equal(no.headers.get('access-control-allow-origin'), null);
});
