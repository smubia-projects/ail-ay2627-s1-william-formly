// =============================================================
// Formly — cta.js
// The card shown when the free demo limit is reached (HTTP 429) or the demo is
// paused (HTTP 503). Used on web pages (with content.js), My Profile and the
// web playground. It lives in a shadow root so page styles can't break it.
// =============================================================
(() => {
  if (window.FormlyCTA) return;

  const PROJECT = {
    name: 'Formly',
    emoji: '✨',
    accentColor: '#1a73e8',
    headline: "You've filled your share of forms!",
    description: 'This demo used {count} free AI requests for this action. Formly was built by an SMU BIA AI Lodge member.',
    programme: 'AI Lodge',
    programmeLink: 'https://www.smubia.com/ailodge',
    showcaseLink: 'https://www.smubia.com/Projects',
    githubLink: 'https://github.com/smubia-projects/ail-ay2627-s1-william-formly',
  };

  const CSS = `
    .backdrop { position: fixed; inset: 0; z-index: 2147483647; display: flex; align-items: center; justify-content: center;
      background: rgba(15, 23, 42, .45); backdrop-filter: blur(12px); animation: fade .5s ease; padding: 16px;
      font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
    .card { width: min(420px, 100%); border-radius: 18px; overflow: hidden; background: #111827; color: #f9fafb;
      box-shadow: 0 24px 60px rgba(0,0,0,.35); animation: pop .6s cubic-bezier(.2,1.4,.4,1); }
    .top { position: relative; overflow: hidden; padding: 24px 22px 20px; background: linear-gradient(135deg, ${PROJECT.accentColor}, #7c3aed); }
    .top::before, .top::after { content: ""; position: absolute; border-radius: 50%; background: rgba(255,255,255,.12); }
    .top::before { width: 160px; height: 160px; right: -50px; top: -60px; }
    .top::after { width: 90px; height: 90px; right: 70px; bottom: -40px; }
    .emoji { font-size: 34px; }
    h2 { margin: 6px 0 6px; font-size: 21px; }
    p { margin: 0; opacity: .95; }
    .body { padding: 18px 22px 20px; display: grid; gap: 10px; }
    a.btn { position: relative; display: flex; justify-content: center; padding: 12px 18px; border-radius: 12px;
      text-decoration: none; font-weight: 700; color: #f9fafb; background: #1f2937; border: 1px solid #374151; }
    a.btn.primary { background: linear-gradient(135deg, ${PROJECT.accentColor}, #7c3aed); border: 0; }
    a.btn span { position: absolute; right: 18px; }
    button.later { background: none; border: 0; color: #9ca3af; cursor: pointer; font: inherit; padding: 6px; }
    @keyframes fade { from { opacity: 0 } }
    @keyframes pop { from { transform: scale(.95); opacity: 0 } }`;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // limit = { status: 429 | 503, queriesUsed, message }
  function show(limit) {
    document.getElementById('formly-cta-host')?.remove();
    const host = document.createElement('div');
    host.id = 'formly-cta-host';
    const root = host.attachShadow({ mode: 'open' });
    const paused = limit?.status === 503;
    const top = paused
      ? `<div class="emoji">⏸️</div><h2>This demo is paused</h2><p>${esc(limit.message || 'This demo is temporarily paused. Check back soon.')}</p>`
      : `<div class="emoji">${PROJECT.emoji}</div><h2>${esc(PROJECT.headline)}</h2>
         <p>${esc(PROJECT.description.replace('{count}', limit?.queriesUsed ?? 'all its'))}</p>`;
    const links = paused
      ? ''
      : `<a class="btn primary" href="${PROJECT.programmeLink}" target="_blank" rel="noopener">Join ${PROJECT.programme}<span>→</span></a>
         <a class="btn" href="${PROJECT.showcaseLink}" target="_blank" rel="noopener">Explore other projects<span>→</span></a>
         <a class="btn" href="${PROJECT.githubLink}" target="_blank" rel="noopener">View on GitHub<span>→</span></a>`;
    root.innerHTML = `<style>${CSS}</style>
      <div class="backdrop"><div class="card" role="dialog" aria-modal="true" aria-label="${paused ? 'Demo paused' : 'Demo limit reached'}">
        <div class="top">${top}</div>
        <div class="body">${links}<button class="later" type="button">${paused ? 'Close' : 'Maybe later'}</button></div>
      </div></div>`;
    const close = () => host.remove();
    root.querySelector('.later').addEventListener('click', close);
    root.querySelector('.backdrop').addEventListener('click', (e) => e.target === e.currentTarget && close());
    // keep Tab inside the card
    const focusables = () => [...root.querySelectorAll('a, button')];
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab') return;
      const f = focusables();
      const i = f.indexOf(root.activeElement);
      e.preventDefault();
      f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    });
    document.documentElement.appendChild(host);
    focusables()[0].focus();
  }

  window.FormlyCTA = { show };
})();
