'use strict';

const SITES = [
  ['YouTube', 'https://www.youtube.com'],
  ['Gmail', 'https://mail.google.com'],
  ['Wikipédia', 'https://fr.wikipedia.org'],
  ['Netflix', 'https://www.netflix.com'],
  ['Twitch', 'https://www.twitch.tv'],
  ['Amazon', 'https://www.amazon.fr'],
  ['Google Maps', 'https://maps.google.com'],
  ['ChatGPT', 'https://chatgpt.com'],
];

const tiles = document.getElementById('tiles');
for (const [name, url] of SITES) {
  const a = document.createElement('a');
  a.className = 'tile';
  a.href = url;
  const host = new URL(url).hostname;
  a.innerHTML = `<div class="ic"><img alt="" src="https://www.google.com/s2/favicons?domain=${host}&sz=64"></div><span></span>`;
  a.querySelector('span').textContent = name;
  a.querySelector('img').onerror = function () {
    const letter = document.createElement('b');
    letter.textContent = name[0];
    letter.style.cssText = 'font-size:22px;color:#4F46E5';
    this.replaceWith(letter);
  };
  tiles.appendChild(a);
}

const greet = document.getElementById('greet');
function tick() {
  const d = new Date();
  const h = d.getHours();
  const hello = h < 5 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  greet.innerHTML = '';
  greet.append(`${hello} Maxou · `);
  const b = document.createElement('b'); b.textContent = time; greet.append(b);
  greet.append(` · ${day}`);
}
tick();
setInterval(tick, 10000);
