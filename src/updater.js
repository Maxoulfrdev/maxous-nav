// Maxou's Nav — mises à jour automatiques (comme Chrome)
// 1. Vérifie sur GitHub (dernière "release") au démarrage puis toutes les 4 h
// 2. Télécharge l'installateur en arrière-plan et vérifie son empreinte SHA-256
// 3. Propose "Redémarrer pour mettre à jour" ; sinon s'installe tout seul à la fermeture
const { app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const pkg = require('../package.json');
const REPO = process.env.MAXOU_UPDATE_REPO ||
  ((pkg.updates && pkg.updates.owner && pkg.updates.repo) ? `${pkg.updates.owner}/${pkg.updates.repo}` : null);
const API = process.env.MAXOU_UPDATE_API || 'https://api.github.com'; // (surchargé seulement pour les tests)
const CHECK_EVERY = 4 * 3600 * 1000;

const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;

let send = () => {};
let state = { status: 'idle', current: app.getVersion() };
let installerPath = null;
let installStarted = false;
let checking = false;

function setState(patch) {
  state = { ...state, ...patch };
  send(state);
}

function newer(a, b) {
  const pa = String(a).replace(/^v/, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split(/[.-]/).map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

async function getJson(url) {
  const r = await net.fetch(url, {
    headers: { 'User-Agent': 'MaxousNav-Updater', Accept: 'application/vnd.github+json' },
    cache: 'no-store'
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}

async function download(url, dest, size, onProgress) {
  const r = await net.fetch(url, { headers: { 'User-Agent': 'MaxousNav-Updater' }, cache: 'no-store' });
  if (!r.ok || !r.body) throw new Error('HTTP ' + r.status + ' ' + url);
  const total = size || parseInt(r.headers.get('content-length') || '0', 10);
  const hash = crypto.createHash('sha256');
  const tmp = dest + '.part';
  const out = fs.createWriteStream(tmp);
  let received = 0;
  let last = 0;
  const reader = r.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const buf = Buffer.from(value);
    hash.update(buf);
    received += buf.length;
    if (!out.write(buf)) await new Promise((res) => out.once('drain', res));
    const now = Date.now();
    if (now - last > 400) { last = now; onProgress(total ? received / total : 0); }
  }
  await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
  fs.renameSync(tmp, dest);
  return hash.digest('hex');
}

async function check(manual = false) {
  if (!REPO) { setState({ status: 'disabled' }); return state; }
  if (!app.isPackaged) { setState({ status: 'dev' }); return state; }
  if (checking || state.status === 'downloading' || state.status === 'ready') return state;
  checking = true;
  setState({ status: 'checking', manual });
  try {
    const rel = await getJson(`${API}/repos/${REPO}/releases/latest`);
    const version = String(rel.tag_name || '').replace(/^v/, '');
    if (!version || !newer(version, app.getVersion())) {
      setState({ status: 'uptodate', checkedAt: Date.now() });
      return state;
    }
    const assets = rel.assets || [];
    const metaAsset = assets.find((a) => a.name === 'latest.json');
    if (!metaAsset) throw new Error('latest.json manquant');
    const meta = await getJson(metaAsset.browser_download_url);
    const exe = assets.find((a) => a.name === meta.file);
    if (!exe) throw new Error('installateur manquant');

    const info = { version, notes: rel.body || '', page: rel.html_url };

    // Version portable : pas d'installation possible, on prévient juste
    if (isPortable) { setState({ status: 'available', ...info }); return state; }

    const dir = path.join(app.getPath('temp'), 'MaxousNav-update');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, meta.file);
    for (const f of fs.readdirSync(dir)) if (f !== meta.file) { try { fs.rmSync(path.join(dir, f), { force: true }); } catch {} }

    let sha = null;
    if (fs.existsSync(dest)) {
      sha = crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex');
    }
    if (sha !== meta.sha256) {
      setState({ status: 'downloading', progress: 0, ...info });
      sha = await download(exe.browser_download_url, dest, exe.size, (p) => setState({ progress: p }));
    }
    if (sha !== meta.sha256) {
      try { fs.rmSync(dest, { force: true }); } catch {}
      throw new Error('fichier corrompu (empreinte invalide)');
    }
    installerPath = dest;
    setState({ status: 'ready', progress: 1, ...info });
  } catch (err) {
    setState({ status: 'error', error: String(err.message || err) });
  } finally {
    checking = false;
  }
  return state;
}

function runInstaller(relaunch) {
  if (!installerPath || installStarted) return false;
  installStarted = true;
  const args = ['/S'];
  if (relaunch) args.push('--updated');
  const child = spawn(installerPath, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
  return true;
}

// Bouton "Redémarrer pour mettre à jour"
function installNow() {
  if (state.status !== 'ready') return false;
  if (runInstaller(true)) setImmediate(() => app.quit());
  return true;
}

function init(sendFn) {
  send = sendFn;
  if (!REPO || !app.isPackaged) { setState({ status: REPO ? 'dev' : 'disabled' }); return; }
  setTimeout(() => check(), 8000);
  setInterval(() => check(), CHECK_EVERY);
  // Mise à jour prête mais pas installée → elle s'installe en silence à la fermeture
  app.on('will-quit', () => { if (state.status === 'ready') runInstaller(false); });
}

module.exports = { init, check, installNow, getState: () => state };
