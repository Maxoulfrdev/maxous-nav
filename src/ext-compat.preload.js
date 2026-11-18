// Service worker des extensions (isolé) : permet aux sites autorisés par une extension
// (« externally_connectable », ex. *.proton.me pour Proton Pass) de lui envoyer des messages,
// comme dans Chrome. Les messages arrivent par Maxou's Nav et sont remis à
// chrome.runtime.onMessageExternal.
const { contextBridge, ipcRenderer } = require('electron');

if (process.type === 'service-worker') {
  let dispatcher = null;

  contextBridge.exposeInMainWorld('__maxouExtSW', {
    register: (fn) => { dispatcher = fn; },
    reply: (reqId, ok, response) => ipcRenderer.send('maxou-ext:ec-reply', reqId, !!ok, response)
  });

  ipcRenderer.on('maxou-ext:ec-message', (_e, reqId, message, sender) => {
    if (dispatcher) dispatcher(reqId, message, sender);
    else ipcRenderer.send('maxou-ext:ec-reply', reqId, false, 'Receiving end does not exist.');
  });

  contextBridge.executeInMainWorld({
    func: () => {
      const api = globalThis.__maxouExtSW;
      try { delete globalThis.__maxouExtSW; } catch {}
      const rt = globalThis.chrome && globalThis.chrome.runtime;
      if (!rt || !api) return;

      const listeners = new Set();
      const native = rt.onMessageExternal;
      const event = {
        addListener(fn) { listeners.add(fn); try { native && native.addListener(fn); } catch {} },
        removeListener(fn) { listeners.delete(fn); try { native && native.removeListener(fn); } catch {} },
        hasListener(fn) { return listeners.has(fn); },
        hasListeners() { return listeners.size > 0; }
      };
      try {
        Object.defineProperty(rt, 'onMessageExternal', { value: event, enumerable: true, configurable: true, writable: true });
      } catch { return; }

      api.register((reqId, message, sender) => {
        let done = false;
        let pending = false;
        const respond = (ok, value) => { if (!done) { done = true; api.reply(reqId, ok, value); } };
        const sendResponse = (value) => respond(true, value);
        for (const fn of listeners) {
          try {
            const ret = fn(message, sender, sendResponse);
            if (ret === true) pending = true;
            else if (ret && typeof ret.then === 'function') {
              pending = true;
              ret.then((v) => sendResponse(v), (err) => respond(false, String((err && err.message) || err)));
            }
          } catch (err) { console.error(err); }
        }
        if (!pending) respond(true, undefined);
      });
    }
  });
}
