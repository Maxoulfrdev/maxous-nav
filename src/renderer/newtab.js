'use strict';

const DEFAULT_SITES = [
  ['YouTube', 'https://www.youtube.com'],
  ['Gmail', 'https://mail.google.com'],
  ['Wikipédia', 'https://fr.wikipedia.org'],
  ['Netflix', 'https://www.netflix.com'],
  ['Twitch', 'https://www.twitch.tv'],
  ['Amazon', 'https://www.amazon.fr'],
  ['Google Maps', 'https://maps.google.com'],
  ['ChatGPT', 'https://chatgpt.com'],
];
const MAX_TILES = 12;
const KEY = 'maxou.tiles';

function loadTiles() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(t)) return t;
  } catch {}
  return DEFAULT_SITES.map(([name, url]) => ({ name, url }));
}
function saveTiles(t) { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch {} }

function normalize(url) {
  url = url.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return new URL(url).href;
}

const tilesEl = document.getElementById('tiles');
let tiles = loadTiles();

function render() {
  tilesEl.innerHTML = '';
  tiles.forEach((t, i) => {
    const a = document.createElement('a');
    a.className = 'tile';
    a.href = t.url;
    let host = '';
    try { host = new URL(t.url).hostname; } catch {}
    a.innerHTML = `<div class="ic"><img alt="" src="https://www.google.com/s2/favicons?domain=${host}&sz=64"></div><span></span>
      <button class="tile-x" title="Retirer ce raccourci">✕</button>`;
    a.querySelector('span').textContent = t.name;
    a.querySelector('img').onerror = function () {
      const letter = document.createElement('b');
      letter.textContent = (t.name || '?')[0].toUpperCase();
      letter.style.cssText = 'font-size:22px;color:#4F46E5';
      this.replaceWith(letter);
    };
    a.querySelector('.tile-x').onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      tiles.splice(i, 1);
      saveTiles(tiles);
      render();
    };
    tilesEl.appendChild(a);
  });
  if (tiles.length < MAX_TILES) {
    const add = document.createElement('button');
    add.className = 'tile add';
    add.innerHTML = '<div class="ic plus">+</div><span>Ajouter</span>';
    add.onclick = openForm;
    tilesEl.appendChild(add);
  }
}

// Formulaire d'ajout de raccourci
const dlg = document.getElementById('add-dialog');
const nameIn = document.getElementById('add-name');
const urlIn = document.getElementById('add-url');
const err = document.getElementById('add-err');
function openForm() {
  nameIn.value = '';
  urlIn.value = '';
  err.textContent = '';
  dlg.hidden = false;
  nameIn.focus();
}
function closeForm() { dlg.hidden = true; }
document.getElementById('add-cancel').onclick = closeForm;
dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) closeForm(); });
document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  let url;
  try { url = normalize(urlIn.value); } catch { err.textContent = 'Adresse invalide'; return; }
  let name = nameIn.value.trim();
  if (!name) name = new URL(url).hostname.replace(/^www\./, '');
  tiles.push({ name, url });
  saveTiles(tiles);
  closeForm();
  render();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !dlg.hidden) closeForm(); });

document.getElementById('reset-tiles').onclick = (e) => {
  e.preventDefault();
  tiles = DEFAULT_SITES.map(([name, url]) => ({ name, url }));
  saveTiles(tiles);
  render();
};

render();

// Heure + salutation
const clock = document.getElementById('clock');
const greet = document.getElementById('greet');
function tick() {
  const d = new Date();
  const h = d.getHours();
  const hello = h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
  clock.textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  greet.innerHTML = '';
  const b = document.createElement('b'); b.textContent = `${hello} Maxou`; greet.append(b, ` · ${day}`);
}
tick();
setInterval(tick, 5000);

// Ciel étoilé (dessiné une seule fois, redessiné si la fenêtre change de taille)
const canvas = document.getElementById('stars');
function drawStars() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = innerWidth, h = innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = Math.round((w * h) / 5200);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, r = rnd() < 0.92 ? rnd() * 0.9 + 0.2 : rnd() * 1.4 + 0.8;
    const tint = rnd();
    ctx.fillStyle = tint < 0.15 ? 'rgba(165,243,252,' : tint < 0.3 ? 'rgba(233,213,255,' : 'rgba(255,255,255,';
    ctx.fillStyle += (0.25 + rnd() * 0.7).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
}
drawStars();
let rs; addEventListener('resize', () => { clearTimeout(rs); rs = setTimeout(drawStars, 150); });

// Quelques étoiles qui scintillent
const tw = document.getElementById('twinkles');
for (let i = 0; i < 14; i++) {
  const s = document.createElement('i');
  s.style.left = (Math.random() * 100).toFixed(1) + 'vw';
  s.style.top = (Math.random() * 70).toFixed(1) + 'vh';
  s.style.animationDelay = (-Math.random() * 4).toFixed(2) + 's';
  s.style.animationDuration = (3 + Math.random() * 4).toFixed(2) + 's';
  tw.appendChild(s);
}
