// =============================================================
// Formly API (Cloud Run). Stateless and API-only: the profile and documents
// stay in the browser; each request carries what the AI needs for one job.
//   POST /api/answer          fill a form            (bucket "fill")
//   POST /api/extract-profile read documents         (bucket "extract")
//   POST /api/learn           tidy typed answers     (bucket "learn")
//   GET  /api/health
// The web playground lives on Vercel; nothing static is served from here.
// =============================================================
import express from 'express';
import cors from 'cors';
import { createRateLimiter } from './rateLimitEngine.js';
import {
  SYSTEM_PROMPT, buildPrompt, EXTRACT_SYSTEM, buildExtractPrompt, LEARN_SYSTEM, buildLearnPrompt, parseJSON,
} from './prompts.js';

const API_BASE_URL = (process.env.API_BASE_URL || 'https://api.apiyi.com/v1').replace(/\/+$/, '');
const MODEL_NAME = process.env.MODEL_NAME || 'deepseek-v4-1-flash-260910';
const apiKey = () => process.env.API_KEY || process.env.APIYI_API_KEY || '';

const limiter = createRateLimiter({
  project: 'ail-ay2627-s1-william-formly',
  buckets: {
    fill: Number(process.env.RATE_LIMIT_FILL_MAX || 5),
    extract: Number(process.env.RATE_LIMIT_EXTRACT_MAX || 3),
    learn: Number(process.env.RATE_LIMIT_LEARN_MAX || 5),
  },
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN,
  defaultWindow: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 432000),
});

const app = express();

// The playground (Vercel) is listed in CORS_ORIGINS. The extension calls from its
// service worker, where host_permissions apply instead of CORS.
const allowed = (process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowed.includes(origin) || origin.startsWith('chrome-extension://')),
}));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// ---------- the AI call ----------
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function callAI({ system, prompt, maxTokens }) {
  if (!apiKey()) throw new HttpError(501, 'The AI is not configured on this server.');
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey()}` },
      body: JSON.stringify({
        model: MODEL_NAME,
        max_tokens: maxTokens,
        messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
        // DeepSeek thinks first by default; switch it off to stay well inside the 60 s timeout.
        ...(/deepseek/i.test(MODEL_NAME) ? { reasoning_effort: 'none' } : {}),
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw new HttpError(502, 'Could not reach the AI service. Try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(502, data?.error?.message || `The AI service returned error ${res.status}.`);
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') throw new HttpError(502, 'The answers were too long and got cut off. Try fewer questions.');
  try {
    return parseJSON(choice?.message?.content || '');
  } catch (e) {
    throw new HttpError(502, e.message);
  }
}

const str = (v, n) => String(v ?? '').slice(0, n);
const bad = (res, message) => res.status(400).json({ message });
const run = (fn) => async (req, res) => {
  try {
    res.json(await fn(req.body));
  } catch (e) {
    res.status(e.status || 500).json({ message: e.status ? e.message : 'Something went wrong on the server.' });
    if (!e.status) console.error(e);
  }
};

// ---------- validation (before the limiter, so rejected requests cost nothing) ----------
function checkAnswer(req, res, next) {
  const { profile, docText, page, fields } = req.body || {};
  if (!Array.isArray(fields) || !fields.length) return bad(res, 'No questions were sent.');
  if (fields.length > 80) return bad(res, 'This form has too many questions (80 max).');
  if (!String(profile || '').trim() && !String(docText || '').trim()) {
    return bad(res, 'Add your details first: My Profile, or a document.');
  }
  req.body = {
    profile: str(profile, 8000),
    docText: str(docText, 7000),
    page: { title: str(page?.title, 300), url: str(page?.url, 500), intro: str(page?.intro, 1200) },
    fields: fields.map((f) => ({
      id: str(f?.id, 20), question: str(f?.question, 300), type: str(f?.type, 30),
      ...(Array.isArray(f?.options) ? { options: f.options.slice(0, 60).map((o) => str(o, 200)) } : {}),
    })),
  };
  next();
}

function checkExtract(req, res, next) {
  const { text, keys } = req.body || {};
  if (!String(text || '').trim()) return bad(res, 'Add a document first (for example your resume) in the Documents tab.');
  if (!Array.isArray(keys) || !keys.length) return bad(res, 'No profile boxes were sent.');
  req.body = { text: str(text, 15000), keys: keys.slice(0, 60).map(([k, l]) => [str(k, 40), str(l, 80)]) };
  next();
}

function checkLearn(req, res, next) {
  const { boxList, items } = req.body || {};
  if (!Array.isArray(items) || !items.length) return bad(res, 'Nothing to learn.');
  req.body = {
    boxList: str(boxList, 4000),
    items: items.slice(0, 20).map((i) => ({ question: str(i?.question, 300), answer: str(i?.answer, 200) })),
  };
  next();
}

// ---------- routes ----------
app.post('/api/answer', checkAnswer, limiter('fill'), run(async ({ profile, docText, page, fields }) => {
  const data = await callAI({ system: SYSTEM_PROMPT, prompt: buildPrompt(profile, docText, page, fields), maxTokens: 2000 });
  if (!Array.isArray(data.answers)) throw new HttpError(502, 'The AI reply had no answers list. Try again.');
  return { answers: data.answers };
}));

app.post('/api/extract-profile', checkExtract, limiter('extract'), run(async ({ text, keys }) => {
  const data = await callAI({ system: EXTRACT_SYSTEM, prompt: buildExtractPrompt(keys, text), maxTokens: 2000 });
  return { profile: data.profile || {} };
}));

app.post('/api/learn', checkLearn, limiter('learn'), run(async ({ boxList, items }) => {
  const data = await callAI({ system: LEARN_SYSTEM, prompt: buildLearnPrompt(boxList, items), maxTokens: 1200 });
  return { facts: Array.isArray(data.facts) ? data.facts : [] };
}));

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

const port = Number(process.env.PORT || 8080);
app.listen(port, '0.0.0.0', () => console.log(`Formly API on :${port}`));
