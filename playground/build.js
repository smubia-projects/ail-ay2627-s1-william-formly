// Vercel build (root directory = repo root). The site root is William's own landing page (docs/index.html and its
// images); the playground, which reuses the extension's scripts, is at /playground/ with config.js for the API URL.
// docs/join.html (phone sign-up), install.html / formly-beta.zip (his beta) and privacy.html (his beta's accounts)
// are not deployed: the hosted demo has no sign-up and the extension download is the fork's keyless build.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const site = path.join(__dirname, 'dist');
const out = path.join(site, 'playground');
const apiBase = (process.env.VITE_API_BASE || 'http://localhost:8080').replace(/\/+$/, '');

fs.rmSync(site, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'lib'), { recursive: true });

const copy = (from, to = path.basename(from)) => fs.copyFileSync(path.join(root, from), path.join(out, to));
for (const f of ['background.js', 'content.js', 'content.css', 'cta.js', 'profile.js']) copy(`client/${f}`);
for (const f of fs.readdirSync(path.join(root, 'client/lib'))) copy(`client/lib/${f}`, `lib/${f}`);
for (const f of ['index.html', 'chrome-shim.js', 'playground.js', 'playground.css']) copy(`playground/${f}`);

// My Profile: the extension's page, with the shim and a link back to the form
const shim =
  '<script src="config.js"></script>\n  <script src="chrome-shim.js"></script>\n  <script src="background.js"></script>\n' +
  '  <script>chrome.__seal();</script>\n  <script src="cta.js"></script>\n  <script src="profile.js"></script>';
// A Windows checkout has CRLF line endings: normalise them so the check below matches.
let profile = fs.readFileSync(path.join(root, 'client/profile.html'), 'utf8').replace(/\r\n/g, '\n');
if (!profile.includes('<script src="cta.js"></script>\n  <script src="profile.js"></script>')) {
  throw new Error('client/profile.html changed: update playground/build.js');
}
profile = profile
  .replace('<script src="cta.js"></script>\n  <script src="profile.js"></script>', shim)
  .replace(/<body([^>]*)>/, '<body$1>\n  <a href="index.html" style="display:block;padding:10px 16px;background:#1a73e8;color:#fff;text-decoration:none;font:600 15px system-ui,sans-serif">← Back to the sample form</a>');
fs.writeFileSync(path.join(out, 'profile.html'), profile);

fs.writeFileSync(path.join(out, 'config.js'), `window.FORMLY_API_BASE = ${JSON.stringify(apiBase)};\n`);
// Landing page: William's site from docs/ (the page and its screenshots only)
fs.copyFileSync(path.join(root, 'docs/index.html'), path.join(site, 'index.html'));
fs.mkdirSync(path.join(site, 'images'), { recursive: true });
for (const f of fs.readdirSync(path.join(root, 'docs/images'))) {
  fs.copyFileSync(path.join(root, 'docs/images', f), path.join(site, 'images', f));
}
console.log(`Site built in playground/dist: landing page at /, playground at /playground/ (API: ${apiBase})`);
