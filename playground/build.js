// Vercel build (root directory = repo root): copies the extension scripts the
// playground reuses into playground/dist and writes config.js with the API URL.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(__dirname, 'dist');
const apiBase = (process.env.VITE_API_BASE || 'http://localhost:8080').replace(/\/+$/, '');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });

const copy = (from, to = path.basename(from)) => fs.copyFileSync(path.join(root, from), path.join(out, to));
for (const f of ['background.js', 'content.js', 'content.css', 'cta.js', 'profile.js']) copy(`client/${f}`);
for (const f of fs.readdirSync(path.join(root, 'client/lib'))) copy(`client/lib/${f}`, `lib/${f}`);
for (const f of ['index.html', 'chrome-shim.js', 'playground.js', 'playground.css']) copy(`playground/${f}`);

// My Profile: the extension's page, with the shim and a link back to the form
const shim =
  '<script src="config.js"></script>\n  <script src="chrome-shim.js"></script>\n  <script src="background.js"></script>\n' +
  '  <script>chrome.__seal();</script>\n  <script src="cta.js"></script>\n  <script src="profile.js"></script>';
let profile = fs.readFileSync(path.join(root, 'client/profile.html'), 'utf8');
if (!profile.includes('<script src="cta.js"></script>\n  <script src="profile.js"></script>')) {
  throw new Error('client/profile.html changed: update playground/build.js');
}
profile = profile
  .replace('<script src="cta.js"></script>\n  <script src="profile.js"></script>', shim)
  .replace(/<body([^>]*)>/, '<body$1>\n  <a href="index.html" style="display:block;padding:10px 16px;background:#1a73e8;color:#fff;text-decoration:none;font:600 15px system-ui,sans-serif">← Back to the sample form</a>');
fs.writeFileSync(path.join(out, 'profile.html'), profile);

fs.writeFileSync(path.join(out, 'config.js'), `window.FORMLY_API_BASE = ${JSON.stringify(apiBase)};\n`);
console.log(`Playground built in playground/dist (API: ${apiBase})`);
