// Without API_KEY the AI routes answer 501, not 503 (503 is the kill switch).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('501 when the AI is not configured', async () => {
  const PORT = 19500 + Math.floor(Math.random() * 400);
  const p = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(PORT), API_KEY: '', APIYI_API_KEY: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_URL: '' },
  });
  await new Promise((ok) => p.stdout.on('data', (d) => String(d).includes('Formly API') && ok()));
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/api/answer`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields: [{ id: 'f1', question: 'Name', type: 'short_text' }], profile: 'Name: A' }),
    });
    assert.equal(r.status, 501);
  } finally {
    p.kill();
  }
});
