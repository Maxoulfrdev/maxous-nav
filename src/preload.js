const { contextBridge, ipcRenderer } = require('electron');

// Icônes des extensions dans la barre d'outils (<browser-action-list>)
try { require('electron-chrome-extensions/browser-action').injectBrowserAction(); } catch (e) { console.error(e); }

const CHANNELS = [
  'cmd', 'open-tab', 'download', 'adblock:blocked', 'adblock:state', 'update', 'prefs', 'toast',
  'ext:changed', 'ext:create-tab', 'ext:select-tab', 'ext:remove-tab'
];

contextBridge.exposeInMainWorld('maxou', {
  on: (channel, cb) => {
    if (CHANNELS.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => cb(...args));
  },
  suggest: (q) => ipcRenderer.invoke('suggest', q),
  adblock: {
    get: () => ipcRenderer.invoke('adblock:get'),
    set: (on) => ipcRenderer.invoke('adblock:set', on)
  },
  download: {
    open: (id) => ipcRenderer.send('download:open', id),
    show: (id) => ipcRenderer.send('download:show', id),
    cancel: (id) => ipcRenderer.send('download:cancel', id),
    folder: () => ipcRenderer.send('download:folder')
  },
  update: {
    get: () => ipcRenderer.invoke('update:get'),
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install')
  },
  prefs: {
    get: () => ipcRenderer.invoke('prefs:get'),
    set: (patch) => ipcRenderer.invoke('prefs:set', patch)
  },
  ext: {
    list: () => ipcRenderer.invoke('ext:list'),
    remove: (id) => ipcRenderer.invoke('ext:remove', id),
    tabCreated: (reqId, wcId) => ipcRenderer.send('ext:tab-created', { reqId, wcId }),
    tabSelected: (wcId) => ipcRenderer.send('ext:tab-selected', wcId)
  },
  toggleFullscreen: () => ipcRenderer.send('fullscreen'),
  info: () => ipcRenderer.invoke('app:info'),
  mica: process.argv.includes('--maxou-mica'),
  platform: process.platform
});
