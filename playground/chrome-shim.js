// =============================================================
// Formly playground — chrome-shim.js
// Lets the extension's own scripts (background.js, content.js, profile.js) run
// on a normal web page: chrome.storage.local is kept in localStorage, and
// messages go straight to the listeners on this page.
// Load order: config.js, chrome-shim.js, background.js, then chrome.__seal(),
// then cta.js and content.js / profile.js.
// =============================================================
(() => {
  const PREFIX = 'formly:';
  const storageListeners = [];
  const bgListeners = []; // background.js (registered before __seal)
  const tabListeners = []; // content.js (registered after __seal)
  let sealed = false;

  const read = (k) => {
    try {
      const v = localStorage.getItem(PREFIX + k);
      return v == null ? undefined : JSON.parse(v);
    } catch {
      return undefined;
    }
  };
  const write = (k, v) => {
    try {
      if (v === undefined) localStorage.removeItem(PREFIX + k);
      else localStorage.setItem(PREFIX + k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: the demo still works for this page */
    }
  };
  const fire = (changes) => storageListeners.forEach((fn) => fn(changes, 'local'));
  const list = (keys) => (keys == null ? [] : Array.isArray(keys) ? keys : [keys]);

  const local = {
    async get(keys) {
      const out = {};
      for (const k of list(keys)) {
        const v = read(k);
        if (v !== undefined) out[k] = v;
      }
      return out;
    },
    async set(items) {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        changes[k] = { oldValue: read(k), newValue: v };
        write(k, v);
      }
      fire(changes);
    },
    async remove(keys) {
      const changes = {};
      for (const k of list(keys)) {
        changes[k] = { oldValue: read(k) };
        write(k, undefined);
      }
      fire(changes);
    },
  };

  // Another tab (e.g. My Profile while the form learns something) changed storage
  window.addEventListener('storage', (e) => {
    if (!e.key?.startsWith(PREFIX)) return;
    const parse = (v) => (v == null ? undefined : JSON.parse(v));
    fire({ [e.key.slice(PREFIX.length)]: { oldValue: parse(e.oldValue), newValue: parse(e.newValue) } });
  });

  function dispatch(listeners, msg) {
    return new Promise((resolve) => {
      let later = false;
      for (const fn of listeners) if (fn(msg, {}, resolve) === true) later = true;
      if (!later) resolve(undefined);
    });
  }

  const shim = {
    storage: { local, onChanged: { addListener: (fn) => storageListeners.push(fn) } },
    runtime: {
      sendMessage: (msg) => dispatch(bgListeners, msg),
      onMessage: { addListener: (fn) => (sealed ? tabListeners : bgListeners).push(fn) },
      getURL: (path) => path,
    },
    tabs: {
      create: ({ url }) => window.open(url, '_blank'),
      sendMessage: (_tabId, msg) => dispatch(tabListeners, msg),
    },
    __seal: () => (sealed = true),
  };
  Object.defineProperty(window, 'chrome', { value: shim, configurable: true, writable: true });
})();
