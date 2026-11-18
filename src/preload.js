const { contextBridge, ipcRenderer } = require('electron');

const CHANNELS = ['cmd', 'open-tab', 'download', 'adblock:blocked', 'adblock:state', 'update'];

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
  toggleFullscreen: () => ipcRenderer.send('fullscreen'),
  info: () => ipcRenderer.invoke('app:info'),
  mica: process.argv.includes('--maxou-mica'),
  platform: process.platform
});
