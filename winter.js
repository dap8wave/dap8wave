/*
 * WINTER.JS — Winter Animation Engine
 *
 * This script injects a winter overlay on top of the existing Wave
 * Check site without touching any of its functional logic. It uses
 * lightweight effects and CSS animations. On page load it creates
 * a floating "Happy Holidays" banner, spawns snowflakes that gently
 * drift down the screen, adds a subtle frost layer, and plays a
 * quiet ambient winter wind sound. The audio begins playing after
 * the user's first interaction to satisfy autoplay restrictions.
 */

// Configuration
const NUM_SNOWFLAKES = 50;
const AUDIO_URL = "https://cdn.pixabay.com/download/audio/2022/03/24/audio_c6b8e2a52e.mp3?filename=cold-wind-14369.mp3";

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
audio.volume = 0.15;
document.addEventListener("click", () => {
  if (audio.paused) {
    audio.play().catch(() => {});
  }
}, { once: true });

// Create a floating banner with a winter greeting
function createBanner() {
  const banner = document.createElement('div');
  banner.id = 'winter-banner';
  banner.textContent = '❄️ Happy Holidays ⛄';
  document.body.appendChild(banner);
}

// Spawn snowflakes and animate them falling down
function spawnSnowflakes() {
  for (let i = 0; i < NUM_SNOWFLAKES; i++) {
    const snowflake = createElement('div', 'snowflake', document.body);
    snowflake.textContent = '❄';
    
    // Random starting position
    snowflake.style.left = `${Math.random() * 100}%`;
    snowflake.style.fontSize = `${Math.random() * 20 + 10}px`;
    snowflake.style.opacity = Math.random() * 0.6 + 0.4;
    
    // Random animation delay and duration
    const duration = Math.random() * 10000 + 10000; // 10-20 seconds
    const delay = Math.random() * 5000; // 0-5 second delay
    
    animateSnowflake(snowflake, duration, delay);
  }
}

function animateSnowflake(snowflake, duration, delay) {
  const horizontalDrift = (Math.random() - 0.5) * 100; // Drift left or right
  
  setTimeout(() => {
    snowflake.animate([
      { 
        transform: 'translateY(-10px) translateX(0px) rotate(0deg)',
        opacity: 0
      },
      { 
        transform: `translateY(${window.innerHeight + 10}px) translateX(${horizontalDrift}px) rotate(360deg)`,
        opacity: snowflake.style.opacity
      }
    ], {
      duration: duration,
      iterations: Infinity,
      easing: 'linear'
    });
  }, delay);
}

// Create a frost layer using CSS gradients
function createFrost() {
  const frost = createElement('div', 'frost-layer', document.body);
}

// Create occasional sparkle effects
function createSparkle() {
  const sparkle = createElement('div', 'sparkle', document.body);
  sparkle.style.left = `${Math.random() * 100}%`;
  sparkle.style.top = `${Math.random() * 100}%`;
  
  sparkle.animate([
    { opacity: 0, transform: 'scale(0)' },
    { opacity: 1, transform: 'scale(1)' },
    { opacity: 0, transform: 'scale(0)' }
  ], {
    duration: 2000,
    easing: 'ease-in-out'
  });
  
  setTimeout(() => sparkle.remove(), 2100);
}

// Trigger sparkles periodically
setInterval(createSparkle, 3000);

// Inject styles for snowflakes, frost and sparkles
const style = document.createElement('style');
style.textContent = `
/* Snowflake styling */
.snowflake {
  position: fixed;
  z-index: 50;
  pointer-events: none;
  color: #ffffff;
  text-shadow: 0 0 5px rgba(255, 255, 255, 0.8);
  user-select: none;
  top: -10px;
}

/* Frost overlay: subtle vignette effect */
.frost-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
  opacity: 0.12;
  background:
    radial-gradient(circle at 10% 20%, rgba(200, 220, 255, 0.08), transparent 40%),
    radial-gradient(circle at 80% 30%, rgba(200, 220, 255, 0.06), transparent 40%),
    radial-gradient(circle at 30% 80%, rgba(200, 220, 255, 0.07), transparent 45%);
  background-size: 200% 100%, 180% 100%, 220% 100%;
}

/* Sparkle effects */
.sparkle {
  position: fixed;
  width: 4px;
  height: 4px;
  background: radial-gradient(circle, rgba(255, 255, 255, 1) 0%, rgba(200, 220, 255, 0) 70%);
  border-radius: 50%;
  pointer-events: none;
  z-index: 60;
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
}
`;
document.head.appendChild(style);

// Launch the winter overlay when the DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  createBanner();
  createFrost();
  spawnSnowflakes();
});
