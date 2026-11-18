// S'exécute (isolé, bac à sable) au chargement de chaque page.
//  1. Connexion Google : Maxou's Nav s'y présente comme Firefox → on masque navigator.userAgentData
//  2. Sites autorisés par une extension (« externally_connectable », ex. *.proton.me pour
//     Proton Pass) : on leur donne chrome.runtime.sendMessage(idExtension, …) comme dans Chrome.
//     Maxou's Nav revérifie à chaque message que le site est bien autorisé par l'extension.
const { webFrame, ipcRenderer, contextBridge } = require('electron');

try {
  const h = location.hostname;
  if (h === 'accounts.google.com' || h === 'accounts.youtube.com') {
    webFrame.executeJavaScript(
      "try{Object.defineProperty(Navigator.prototype,'userAgentData',{get:function(){return undefined},configurable:true});}catch(e){}"
    );
  }
} catch {}

try {
  if (location.protocol === 'https:' || location.protocol === 'http:') {
    const ids = ipcRenderer.sendSync('maxou-ext:ec-ids');
    if (Array.isArray(ids) && ids.length) {
      contextBridge.exposeInMainWorld('__maxouEC', {
        send: (extensionId, message) => ipcRenderer.invoke('maxou-ext:ec-send', String(extensionId), message)
      });
      contextBridge.executeInMainWorld({
        func: () => {
          const bridge = window.__maxouEC;
          if (!bridge) return;
          const chromeObj = window.chrome || (window.chrome = {});
          const runtime = chromeObj.runtime || (chromeObj.runtime = {});
          let lastError;
          try { Object.defineProperty(runtime, 'lastError', { get: () => lastError, configurable: true }); } catch {}
          const NO_RECEIVER = 'Could not establish connection. Receiving end does not exist.';
          runtime.sendMessage = function (extensionId, message, options, callback) {
            if (typeof options === 'function') { callback = options; options = undefined; }
            const p = bridge.send(extensionId, message).then((r) => {
              if (!r || !r.ok) throw new Error((r && r.error) || NO_RECEIVER);
              return r.response;
            });
            if (typeof callback === 'function') {
              p.then((resp) => callback(resp), (err) => {
                lastError = { message: err.message };
                try { callback(undefined); } finally { lastError = undefined; }
              });
              return undefined;
            }
            return p;
          };
        }
      });
    }
  }
} catch {}
