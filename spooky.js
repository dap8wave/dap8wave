/*
 * SPOOKY.JS — Halloween Animation Engine (CDN‑fixed)
 *
 * This script injects a Halloween overlay on top of the existing Wave
 * Check site without touching any of its functional logic. It uses
 * lightweight SVGs from Twemoji and CSS‑only fog so there are no
 * broken images. On page load it creates a floating "Happy Halloween"
 * banner, spawns a few ghosts and bats that gently drift across the
 * screen, adds a subtle fog layer, triggers occasional lightning
 * flashes, and plays a quiet ambient wind/whisper sound. The audio
 * begins playing after the user's first interaction to satisfy
 * autoplay restrictions.
 */

// Configuration
const NUM_GHOSTS = 3;
const NUM_BATS = 4;
const LIGHTNING_INTERVAL = 15000; // milliseconds between flashes
const AUDIO_URL = "https://cdn.pixabay.com/download/audio/2022/03/15/audio_80b0f17a8d.mp3?filename=spooky-wind-ambient-14395.mp3";

// Twemoji SVG sources (reliable CDN)
const GHOST_SRC = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f47b.svg"; // 👻
const BAT_SRC   = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/1f987.svg"; // 🦇

// Utility for creating elements
function createElement(tag, className, parent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (parent) parent.appendChild(el);
  return el;
}

// Ambient audio: loops, starts on first user interaction
const audio = new Audio(AUDIO_URL);
audio.loop = true;
audio.volume = 0.25;
document.addEventListener("click", () => {
  if (audio.paused) {
    audio.play().catch(() => {});
  }
}, { once: true });

// Create a floating banner with a Halloween greeting
function createBanner() {
  const banner = document.createElement('div');
  banner.id = 'halloween-banner';
  banner.textContent = '🎃 Happy Halloween 👻';
  document.body.appendChild(banner);
}

// Spawn ghosts and animate them with a gentle horizontal drift
function spawnGhosts() {
  for (let i = 0; i < NUM_GHOSTS; i++) {
    const ghost = createElement('img', 'ghost', document.body);
    ghost.src = GHOST_SRC;
    ghost.alt = 'ghost';
    ghost.style.top = `${Math.random() * 60 + 10}%`;
    ghost.style.left = `${Math.random() * 80 + 10}%`;
    animateGhost(ghost);
  }
}
function animateGhost(ghost) {
  const speed = 10000 + Math.random() * 10000;
  const dir = Math.random() > 0.5 ? 1 : -1;
  ghost.animate([
    { transform: `translateX(0px) scaleX(${dir})`, opacity: 0.7 },
    { transform: `translateX(${dir * 120}px) scaleX(${dir})`, opacity: 1 },
    { transform: `translateX(0px) scaleX(${dir})`, opacity: 0.7 }
  ], {
    duration: speed,
    iterations: Infinity,
    easing: 'ease-in-out'
  });
}

// Spawn bats and animate them with a flapping, swooping motion
function spawnBats() {
  for (let i = 0; i < NUM_BATS; i++) {
    const bat = createElement('img', 'bat', document.body);
    bat.src = BAT_SRC;
    bat.alt = 'bat';
    bat.style.top = `${Math.random() * 40 + 5}%`;
    bat.style.left = `${Math.random() * 100}%`;
    animateBat(bat);
  }
}
function animateBat(bat) {
  const speed = 7000 + Math.random() * 7000;
  const dir = Math.random() > 0.5 ? 1 : -1;
  const amp = 40 + Math.random() * 30;
  bat.animate([
    { transform: `translate(${dir * 10}px, 0px) scale(${dir},1)` },
    { transform: `translate(${dir * amp}px, ${amp / 3}px) scale(${dir},1)` },
    { transform: `translate(${dir * 10}px, 0px) scale(${dir},1)` }
  ], {
    duration: speed,
    iterations: Infinity,
    easing: 'ease-in-out'
  });
}

// Create a fog layer using CSS gradients and animate it slowly
function createFog() {
  const fog = createElement('div', 'fog-layer', document.body);
  fog.animate([
    { backgroundPosition: '0% 0%' },
    { backgroundPosition: '100% 0%' }
  ], {
    duration: 60000,
    iterations: Infinity,
    easing: 'linear'
  });
}

// Trigger a lightning flash by momentarily overlaying a radial gradient
function triggerLightning() {
  const flash = createElement('div', 'lightning', document.body);
  flash.animate([
    { opacity: 0 },
    { opacity: 0.9 },
    { opacity: 0.2 },
    { opacity: 0.8 },
    { opacity: 0 }
  ], {
    duration: 1000,
    easing: 'ease-out'
  });
  setTimeout(() => flash.remove(), 1200);
}
setInterval(triggerLightning, LIGHTNING_INTERVAL);

// Inject styles for ghosts, bats, fog and lightning.  These styles are
// defined here instead of in the main CSS to avoid polluting the core
// stylesheet and ensure they load with the script.
const style = document.createElement('style');
style.textContent = `
/* Ghost and bat sizes and drop shadows */
.ghost, .bat {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  filter: drop-shadow(0 0 8px rgba(255,145,0,0.6));
  opacity: 0.85;
}
.ghost {
  width: 60px;
  height: 60px;
}
.bat {
  width: 50px;
  height: 30px;
  opacity: 0.7;
}

/* CSS‑only fog: layered radial gradients that drift slowly */
.fog-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  opacity: 0.18;
  background:
    radial-gradient(circle at 10% 20%, rgba(255,255,255,0.08), transparent 40%),
    radial-gradient(circle at 80% 30%, rgba(255,255,255,0.06), transparent 40%),
    radial-gradient(circle at 30% 80%, rgba(255,255,255,0.07), transparent 45%);
  background-size: 200% 100%, 180% 100%, 220% 100%;
  background-repeat: no-repeat;
}

/* Lightning overlay */
.lightning {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background: radial-gradient(circle, rgba(255,255,255,0.95) 10%, rgba(255,255,255,0.2) 30%, transparent 70%);
}
`;
document.head.appendChild(style);

// Launch the Halloween overlay when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  createBanner();
  createFog();
  spawnGhosts();
  spawnBats();
});