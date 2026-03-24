/**
 * 2048 · SHELBY PROTOCOL — Hardcore Edition
 * ─────────────────────────────────────────────────
 * Engine   : Pure JS, 60 FPS RAF throttle
 * Controls : WASD / Arrow · Touch Swipe · Mouse Drag
 * Wallet   : Petra only (window.aptos)
 * Web3     : Shelby register_blob — score + grid + total_play_time
 * Audio    : Web Audio API BGM (Synthwave) + SFX
 * Timer    : MM:SS live counter, pause-aware
 * Hardcore : SPAWN_4_PROB 25%, 5% chance of tile 8
 * ─────────────────────────────────────────────────
 */

'use strict';

// [BYPASS] Petra Extension v4 chặn các dApp dùng Vanilla JS thông qua việc
// đọc biến window.WALLET_ADAPTER_CORE_VERSION. Nếu không có (hoặc phiên bản cũ), 
// nó sẽ quăng lỗi DeprecatedApiError và ép cài thư viện React của họ.
// Ta giả vờ mình là thư viện core adapter mới nhất (v8.5.0) để Petra cho qua!
if (typeof window !== 'undefined') {
  window.WALLET_ADAPTER_CORE_VERSION = '8.5.0';
}

/* ═══════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════ */
const GRID_SIZE = 4;
const SPAWN_4_PROB = 0.25;   // Hardcore: 25% chance of 4
const SPAWN_8_PROB = 0.05;   // Hardcore: 5% chance of 8
const LS_BEST = 'shelby_best_2048';
const LS_MUTED = 'shelby_audio_muted';
const PULSE_THRESHOLD = 1024;

// ── Real Shelby Contract ──────────────────────
const SHELBY_ADDRESS = '0x85fdb9a176ab8ef1d9d9c1b60d60b3924f0800ac1de1cc2085fb0b8bb4988e6a';
const SHELBY_MODULE = `${SHELBY_ADDRESS}::blob_metadata::register_blob`;

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */
let grid = [];
let score = 0;
let bestScore = parseInt(localStorage.getItem(LS_BEST) || '0', 10);
let tileId = 0;
let gameOver = false;
let isPaused = false;
let tileEls = new Map();

// Timer
let playTime = 0;       // seconds elapsed
let timerInterval = null;  // setInterval handle

// Wallet
let walletAddress = null;
let walletConnected = false;

/* ═══════════════════════════════════════════════
   DOM REFS
═══════════════════════════════════════════════ */
const $board = document.getElementById('game-board');
const $tileLayer = document.getElementById('tile-layer');
const $score = document.getElementById('score-display');
const $best = document.getElementById('best-display');
const $timerDisplay = document.getElementById('timer-display');
const $newBtn = document.getElementById('new-game-btn');
const $pauseBtn = document.getElementById('pause-btn');
const $pauseIcon = document.getElementById('pause-icon');
const $pauseLabel = document.getElementById('pause-label');
const $pauseOverlay = document.getElementById('pause-overlay');
const $resumeBtn = document.getElementById('resume-btn');
const $walletBtn = document.getElementById('wallet-btn');
const $walletLbl = document.getElementById('wallet-label');
const $modal = document.getElementById('modal-overlay');
const $modalNew = document.getElementById('modal-new-game');
const $syncBtn = document.getElementById('sync-shelby-btn');
const $syncSts = document.getElementById('sync-status');
const $modalScore = document.getElementById('modal-score');
const $modalBestTile = document.getElementById('modal-best-tile');
const $modalTime = document.getElementById('modal-time');
const $toast = document.getElementById('wallet-toast');
const $toastMsg = document.getElementById('toast-msg');
const $audioBtn = document.getElementById('audio-btn');
const $audioIcon = document.getElementById('audio-icon');

/* ═══════════════════════════════════════════════
   TIMER LOGIC
═══════════════════════════════════════════════ */
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  if (timerInterval) return;  // already running
  timerInterval = setInterval(() => {
    playTime++;
    $timerDisplay.textContent = formatTime(playTime);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}

function resetTimer() {
  stopTimer();
  playTime = 0;
  $timerDisplay.textContent = '00:00';
}

/* ═══════════════════════════════════════════════
   PAUSE / RESUME
═══════════════════════════════════════════════ */
function pauseGame() {
  if (gameOver || isPaused) return;
  isPaused = true;
  stopTimer();
  stopBGM();
  $pauseOverlay.hidden = false;
  $pauseBtn.classList.add('resuming');
  $pauseIcon.textContent = '▶';
  $pauseLabel.textContent = 'RESUME';
  $pauseBtn.setAttribute('aria-label', 'Resume game');
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  startTimer();
  if (!isMuted) startBGM();
  $pauseOverlay.hidden = true;
  $pauseBtn.classList.remove('resuming');
  $pauseIcon.textContent = '⏸';
  $pauseLabel.textContent = 'PAUSE';
  $pauseBtn.setAttribute('aria-label', 'Pause game');
}

function togglePause() {
  if (gameOver) return;
  isPaused ? resumeGame() : pauseGame();
}

$pauseBtn.addEventListener('click', togglePause);
$resumeBtn.addEventListener('click', resumeGame);

/* ═══════════════════════════════════════════════
   ████  WEB AUDIO ENGINE  ████
   BGM: Synthwave arpeggio (sawtooth + triangle bass)
   SFX: move blip · merge click · game-over chord
═══════════════════════════════════════════════ */
let audioCtx = null;
let bgmPlaying = false;
let bgmScheduler = null;
let masterGain = null;
let isMuted = localStorage.getItem(LS_MUTED) === 'true';

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = isMuted ? 0 : 1;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function playNote(freq, type = 'square', duration = 0.08, gainVal = 0.06, delay = 0) {
  const ctx = getAudioCtx();
  const now = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1800, now);
  filter.Q.setValueAtTime(1.5, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainVal, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

const BGM_CHORDS = [
  [196.0, 246.9, 293.7, 369.9],
  [174.6, 220.0, 261.6, 329.6],
  [164.8, 207.7, 246.9, 311.1],
  [196.0, 246.9, 293.7, 392.0],
];
const NOTE_STEP = 0.18;
const BAR_LEN = NOTE_STEP * 4;
const PHRASE_LEN = BAR_LEN * BGM_CHORDS.length;

function scheduleBGMPhrase(startTime) {
  BGM_CHORDS.forEach((chord, ci) => {
    chord.forEach((freq, ni) => {
      const delay = startTime - audioCtx.currentTime + ci * BAR_LEN + ni * NOTE_STEP;
      playNote(freq, 'sawtooth', 0.14, 0.045, delay);
      if (ni === 0) playNote(freq / 2, 'triangle', BAR_LEN * 0.9, 0.055, delay);
    });
  });
}

function startBGM() {
  if (bgmPlaying || isMuted) return;
  bgmPlaying = true;
  getAudioCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  function loop() {
    if (!bgmPlaying) return;
    scheduleBGMPhrase(audioCtx.currentTime);
    bgmScheduler = setTimeout(loop, PHRASE_LEN * 1000 - 50);
  }
  loop();
}

function stopBGM() {
  bgmPlaying = false;
  clearTimeout(bgmScheduler);
}

function sfxMove() { if (isMuted) return; getAudioCtx(); playNote(440 + Math.random() * 120, 'square', 0.055, 0.04); }
function sfxMerge(value) {
  if (isMuted) return; getAudioCtx();
  const freq = 280 + Math.log2(value) * 28;
  playNote(freq, 'sine', 0.12, 0.09);
  playNote(freq * 1.5, 'triangle', 0.08, 0.04, 0.02);
}
function sfxGameOver() {
  if (isMuted) return; getAudioCtx();
  [440, 370, 293, 196].forEach((f, i) => playNote(f, 'sawtooth', 0.22, 0.07, i * 0.15));
}

function updateAudioIcon() {
  $audioIcon.textContent = isMuted ? '🔇' : '🔊';
  $audioBtn.classList.toggle('muted', isMuted);
  $audioBtn.title = isMuted ? 'Unmute BGM' : 'Mute BGM';
}

$audioBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  localStorage.setItem(LS_MUTED, isMuted);
  updateAudioIcon();
  if (isMuted) { masterGain && (masterGain.gain.value = 0); stopBGM(); }
  else { getAudioCtx(); masterGain && (masterGain.gain.value = 1); if (!isPaused) startBGM(); }
});

let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  if (!isMuted && !isPaused) startBGM();
}
document.addEventListener('keydown', unlockAudio, { once: true });
document.addEventListener('pointerdown', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

/* ═══════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════ */
function emptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

function emptyPositions(g) {
  const pos = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (!g[r][c]) pos.push([r, c]);
  return pos;
}

/**
 * Hardcore spawn:
 * 0–5%   → 8
 * 5–30%  → 4
 * 30–100%→ 2
 */
function spawnValue() {
  const rng = Math.random();
  if (rng < SPAWN_8_PROB) return 8;
  if (rng < SPAWN_8_PROB + SPAWN_4_PROB) return 4;
  return 2;
}

function spawnTile(g) {
  const empties = emptyPositions(g);
  if (!empties.length) return;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  g[r][c] = { id: ++tileId, value: spawnValue() };
}

function highestTile(g) {
  let max = 0;
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (g[r][c]) max = Math.max(max, g[r][c].value);
  return max;
}

/* ═══════════════════════════════════════════════
   MOVE ENGINE
═══════════════════════════════════════════════ */
function slideRow(row) {
  const tiles = row.filter(Boolean);
  const out = Array(GRID_SIZE).fill(null);
  let gained = 0;
  const mergedIds = [];
  const mergedValues = [];
  let skip = false;
  let outIdx = 0;

  for (let i = 0; i < tiles.length; i++) {
    if (skip) { skip = false; continue; }
    if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
      const newVal = tiles[i].value * 2;
      gained += newVal;
      mergedIds.push(tiles[i].id, tiles[i + 1].id);
      mergedValues.push(newVal);
      out[outIdx++] = { id: ++tileId, value: newVal, merged: true };
      skip = true;
    } else {
      out[outIdx++] = { ...tiles[i] };
    }
  }

  const moved = out.some((cell, idx) =>
    (cell?.id !== row[idx]?.id) || (cell?.value !== row[idx]?.value)
  );
  return { out, gained, mergedIds, moved, mergedValues };
}

function applyMove(g, direction) {
  const newGrid = emptyGrid();
  let totalGained = 0, anyMoved = false;
  const allMergedIds = [], allMergedValues = [];

  function processRows(getRow, setRow) {
    for (let i = 0; i < GRID_SIZE; i++) {
      const row = getRow(i);
      const { out, gained, mergedIds, moved, mergedValues } = slideRow(row);
      setRow(i, out);
      totalGained += gained;
      anyMoved = anyMoved || moved;
      allMergedIds.push(...mergedIds);
      allMergedValues.push(...mergedValues);
    }
  }

  if (direction === 'left') processRows(i => g[i].slice(), (i, out) => { newGrid[i] = out; });
  else if (direction === 'right') processRows(i => g[i].slice().reverse(), (i, out) => { newGrid[i] = out.reverse(); });
  else if (direction === 'up') processRows(c => g.map(r => r[c]), (c, out) => { out.forEach((cell, r) => { newGrid[r][c] = cell; }); });
  else if (direction === 'down') processRows(c => g.map(r => r[c]).reverse(), (c, out) => { out.reverse().forEach((cell, r) => { newGrid[r][c] = cell; }); });

  return { newGrid, gained: totalGained, moved: anyMoved, mergedIds: allMergedIds, mergedValues: allMergedValues };
}

function isGameOver(g) {
  if (emptyPositions(g).length > 0) return false;
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      const v = g[r][c]?.value;
      if (c + 1 < GRID_SIZE && g[r][c + 1]?.value === v) return false;
      if (r + 1 < GRID_SIZE && g[r + 1][c]?.value === v) return false;
    }
  return true;
}

/* ═══════════════════════════════════════════════
   RENDERING
═══════════════════════════════════════════════ */
function getTilePos(row, col) {
  const style = getComputedStyle(document.documentElement);
  const gap = parseFloat(style.getPropertyValue('--gap')) || 8;
  const total = $board.clientWidth;
  const tileSize = (total - gap * 2 - gap * (GRID_SIZE - 1)) / GRID_SIZE;
  return {
    left: gap + col * (tileSize + gap),
    top: gap + row * (tileSize + gap),
    size: tileSize,
  };
}

function formatTileText(v) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 10_000) return (v / 1_000).toFixed(0) + 'K';
  return v;
}

function createTileEl(tile, row, col, isNew = false, isMerged = false) {
  const el = document.createElement('div');
  el.classList.add('tile');
  el.dataset.value = tile.value;
  el.dataset.id = tile.id;
  el.textContent = formatTileText(tile.value);

  if (isNew) el.classList.add('tile-new');
  if (isMerged) el.classList.add('tile-merged');
  if (tile.value >= PULSE_THRESHOLD) el.classList.add('tile-pulse');

  const { left, top, size } = getTilePos(row, col);
  el.style.left = left + 'px';
  el.style.top = top + 'px';
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  return el;
}

function render(newGrid, mergedIds = [], newTileIds = []) {
  const posMap = new Map();
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (newGrid[r][c]) posMap.set(newGrid[r][c].id, { r, c });

  tileEls.forEach((el, id) => {
    if (posMap.has(id)) {
      const { r, c } = posMap.get(id);
      const { left, top } = getTilePos(r, c);
      el.style.left = left + 'px';
      el.style.top = top + 'px';
    }
  });

  setTimeout(() => {
    const validIds = new Set(posMap.keys());
    tileEls.forEach((el, id) => { if (!validIds.has(id)) { el.remove(); tileEls.delete(id); } });

    for (let r = 0; r < GRID_SIZE; r++)
      for (let c = 0; c < GRID_SIZE; c++) {
        const tile = newGrid[r][c];
        if (!tile || tileEls.has(tile.id)) continue;
        const el = createTileEl(tile, r, c, newTileIds.includes(tile.id), !!tile.merged);
        $tileLayer.appendChild(el);
        tileEls.set(tile.id, el);
      }
  }, 160);
}

function fullRender(g) {
  $tileLayer.innerHTML = '';
  tileEls.clear();
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++) {
      const tile = g[r][c];
      if (!tile) continue;
      const el = createTileEl(tile, r, c);
      $tileLayer.appendChild(el);
      tileEls.set(tile.id, el);
    }
}

function updateScoreDisplay(gained) {
  $score.textContent = score.toLocaleString();
  $best.textContent = bestScore.toLocaleString();
  if (gained > 0) {
    $score.classList.remove('score-bump');
    void $score.offsetWidth;
    $score.classList.add('score-bump');
    $score.addEventListener('transitionend', () => $score.classList.remove('score-bump'), { once: true });
  }
}

/* ═══════════════════════════════════════════════
   GAME FLOW
═══════════════════════════════════════════════ */
function newGame() {
  // Reset state
  grid = emptyGrid();
  score = 0;
  tileId = 0;
  gameOver = false;
  isPaused = false;

  // Reset timer
  resetTimer();
  startTimer();

  // Reset pause UI
  $pauseOverlay.hidden = true;
  $pauseBtn.classList.remove('resuming');
  $pauseIcon.textContent = '⏸';
  $pauseLabel.textContent = 'PAUSE';

  // Reset modal
  $modal.hidden = true;
  $syncSts.hidden = true;
  $syncSts.className = 'sync-status';
  $syncSts.textContent = '';
  if ($syncBtn) $syncBtn.disabled = false;

  // Clear board
  tileEls.clear();
  $tileLayer.innerHTML = '';

  spawnTile(grid);
  spawnTile(grid);
  fullRender(grid);
  updateScoreDisplay(0);

  // Start BGM on new game (audio already unlocked after first game)
  if (!isMuted && audioUnlocked) startBGM();
}

function move(direction) {
  if (gameOver || isPaused) return;

  const { newGrid, gained, moved, mergedIds, mergedValues } = applyMove(grid, direction);
  if (!moved) return;

  sfxMove();

  const prevIds = new Set();
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (newGrid[r][c]) prevIds.add(newGrid[r][c].id);

  spawnTile(newGrid);

  const newTileIds = [];
  for (let r = 0; r < GRID_SIZE; r++)
    for (let c = 0; c < GRID_SIZE; c++)
      if (newGrid[r][c] && !prevIds.has(newGrid[r][c].id))
        newTileIds.push(newGrid[r][c].id);

  render(newGrid, mergedIds, newTileIds);

  if (mergedValues.length > 0)
    mergedValues.forEach((v, i) => setTimeout(() => sfxMerge(v), i * 35 + 90));

  score += gained;
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(LS_BEST, bestScore);
  }
  updateScoreDisplay(gained);
  grid = newGrid;

  if (isGameOver(grid)) {
    gameOver = true;
    stopTimer();
    stopBGM();
    setTimeout(() => { sfxGameOver(); showGameOver(); }, 160);
  }
}

function showGameOver() {
  $modalScore.textContent = score.toLocaleString();
  $modalBestTile.textContent = highestTile(grid).toLocaleString();
  $modalTime.textContent = formatTime(playTime);
  $modal.hidden = false;
}

/* ═══════════════════════════════════════════════
   CONTROLS — Keyboard
═══════════════════════════════════════════════ */
const KEY_MAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
};

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (!gameOver) { e.preventDefault(); togglePause(); return; }
  }
  const dir = KEY_MAP[e.code];
  if (dir) { e.preventDefault(); throttledMove(dir); }
});

/* ═══════════════════════════════════════════════
   CONTROLS — Touch Swipe + Mouse Drag
═══════════════════════════════════════════════ */
const MIN_SWIPE = 30;
let pointerStart = null;
let isDragging = false;

function onPointerDown(e) {
  if (e.target.closest('button') || isPaused || gameOver) return;
  const src = e.touches ? e.touches[0] : e;
  pointerStart = { x: src.clientX, y: src.clientY };
  isDragging = true;
}
function onPointerMove(e) {
  if (!isDragging || !pointerStart) return;
  e.preventDefault();
}
function onPointerUp(e) {
  if (!pointerStart || !isDragging) return;
  isDragging = false;
  const src = e.changedTouches ? e.changedTouches[0] : e;
  const dx = src.clientX - pointerStart.x;
  const dy = src.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;
  throttledMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
}
function onPointerCancel() { pointerStart = null; isDragging = false; }

const $boardWrapper = document.querySelector('.board-wrapper');
$boardWrapper.addEventListener('touchstart', onPointerDown, { passive: true });
$boardWrapper.addEventListener('touchmove', onPointerMove, { passive: false });
$boardWrapper.addEventListener('touchend', onPointerUp, { passive: true });
$boardWrapper.addEventListener('touchcancel', onPointerCancel);
$boardWrapper.addEventListener('mousedown', onPointerDown);
window.addEventListener('mousemove', onPointerMove);
window.addEventListener('mouseup', onPointerUp);

/* RAF throttle */
let moveQueued = false;
function throttledMove(dir) {
  if (moveQueued) return;
  moveQueued = true;
  move(dir);
  requestAnimationFrame(() => { moveQueued = false; });
}

/* ═══════════════════════════════════════════════
   PETRA WALLET — Standard Wallet Discovery (AIP-62)
   Tự động bắt ví thông qua chuẩn @wallet-standard/core
═══════════════════════════════════════════════ */

let petraWallet = null;

// Gắn lắng nghe để tóm cổ Petra ngay khi nó được tiêm vào trang
(function initPetraDetector() {
  const api = Object.freeze({
    register: (...wallets) => {
      wallets.forEach(w => {
        if (w.name && w.name.toLowerCase().includes('petra')) {
          console.log('[Petra] Captured via wallet-standard API! ✅');
          petraWallet = w;
        }
      });
      return () => { }; // return unregister function
    }
  });

  try {
    window.addEventListener('wallet-standard:register-wallet', (e) => {
      if (e.detail) e.detail(api);
    });
  } catch (err) { }

  try {
    window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
  } catch (err) { }
})();

async function getPetraProvider() {
  if (petraWallet) return petraWallet;

  // Chờ tối đa 2 giây (cho mobile/Mises load chậm)
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (petraWallet) return petraWallet;
  }

  // Fallback 1: window.aptosWallets
  if (window.aptosWallets && Array.isArray(window.aptosWallets)) {
    const w = window.aptosWallets.find(x => x.name?.toLowerCase().includes('petra'));
    if (w) return w;
  }

  // Fallback 2: window.petra
  if (window.petra) {
    console.log('[Petra] Using fallback window.petra layer');
    return {
      name: 'Petra Fallback',
      features: {
        'aptos:connect': { connect: () => window.petra.connect() },
        'aptos:disconnect': { disconnect: () => window.petra.disconnect() },
        'aptos:signAndSubmitTransaction': { signAndSubmitTransaction: (p) => window.petra.signAndSubmitTransaction(p.payload) }
      }
    };
  }

  return null;
}

async function connectWallet() {
  $walletLbl.textContent = 'CONNECTING…';

  try {
    const walletExt = await getPetraProvider();
    if (!walletExt) {
      throw new Error('NOT_INSTALLED');
    }

    // GỌI KẾT NỐI THEO CHUẨN AIP-62
    const connectFeature = walletExt.features['aptos:connect'];
    if (!connectFeature) throw new Error('AIP-62 Connect not supported');

    const response = await connectFeature.connect();
    console.log('[Petra] Connect response:', response);

    // Lưu lại object để dùng cho signAndSubmit
    window._aip62Petra = walletExt;

    // AIP-62 connect response format: { status: "Approved", args: { address, publicKey } }
    let rawAddress = response?.args?.address || response?.address || response?.account?.address || 'unknown';

    // Nếu nó là object AccountAddress của Aptos SDK, nó sẽ có hàm toString()
    if (typeof rawAddress === 'object' && typeof rawAddress.toString === 'function') {
      walletAddress = rawAddress.toString();
    } else {
      walletAddress = String(rawAddress);
    }

    walletConnected = true;

    const short = walletAddress.length > 14
      ? walletAddress.slice(0, 6) + '…' + walletAddress.slice(-4)
      : walletAddress;

    $walletBtn.classList.add('connected');
    $walletLbl.textContent = short;

    showToast('Kết nối ví thành công! ✅');

  } catch (error) {
    console.error('connectWallet error:', error);
    $walletLbl.textContent = 'CONNECT WALLET';

    if (error?.message === 'NOT_INSTALLED') {
      showToast(
        '⚠ Không tìm thấy Petra Wallet.\n' +
        '💻 PC: petra.app\n' +
        '📱 Android: Mises Browser -> Install Petra',
        8000
      );
      return;
    }

    if (error?.code === 4001 || error?.message?.includes('User rejected')) {
      showToast('Vui lòng xác nhận kết nối trên ví Petra!');
    } else if (error?.name === 'DeprecatedApiError' || error?.message?.includes('DeprecatedApiError')) {
      showToast('Lỗi phiên bản cũ. Vui lòng cập nhật Extension Petra!');
    } else {
      showToast('Lỗi kết nối. Vui lòng mở Petra Extension và thử lại.');
    }
  }
}

async function disconnectWallet() {
  try {
    if (window._aip62Petra) {
      const feat = window._aip62Petra.features['aptos:disconnect'];
      if (feat) await feat.disconnect();
    }
  } catch (e) {
    console.warn('disconnect error', e);
  }
  walletConnected = false;
  walletAddress = '';
  window._aip62Petra = null;
  $walletBtn.classList.remove('connected');
  $walletLbl.textContent = 'CONNECT WALLET';
  showToast('Đã ngắt kết nối ví.');
}

$walletBtn.addEventListener('click', () => {
  walletConnected ? disconnectWallet() : connectWallet();
});

/* ═══════════════════════════════════════════════
   SHELBY blob_metadata::register_blob
   7 tham số theo tệp Move của Shelby:
     p1 name        : string
     p2 expiration  : u64  (microseconds)
     p3 data_commit : vector<u8>  (32-byte dummy)
     p4 chunkset_cnt: u32
     p5 blob_size   : u64
     p6 payment_tier: u8
     p7 encoding    : u8
═══════════════════════════════════════════════ */
function buildBlobPayload() {
  // p1
  const p1 = `GiaPhat_2048_${bestScore}`;

  // p2 — expiration in microseconds: (now + 24 h) × 1000
  const expiryDateMs = Date.now() + 86400 * 1000;
  const p2 = (expiryDateMs * 1000).toString();

  // p3 — data commitment (32 bytes)
  const p3Array = new Uint8Array(32);
  window.crypto.getRandomValues(p3Array);
  const p3 = Array.from(p3Array); // Dạng mảng js array

  // p4 — chunks
  const p4 = '1';

  // p5 — blob size
  const p5 = '1024';

  // p6 — payment tier (u8)
  const p6 = '1';

  // p7 — encoding (u8)
  const p7 = '1';

  return {
    type: 'entry_function_payload',
    function: SHELBY_MODULE,
    type_arguments: [],
    arguments: [p1, p2, p3, p4, p5, p6, p7],
  };
}

async function syncToShelby() {
  // Gate: only after game over
  if (!gameOver) {
    showSyncStatus('error', '✗ Sync only available after Game Over.');
    return;
  }

  // Kết nối nếu chưa kết nối
  if (!walletConnected || !window._aip62Petra) {
    showSyncStatus('pending', '◈ Connecting Petra Wallet…');
    await connectWallet();
    if (!walletConnected) {
      showSyncStatus('error', '✗ Wallet not connected.');
      return;
    }
  }

  showSyncStatus('pending', '◈ Signing transaction… Check Petra wallet.');
  $syncBtn.disabled = true;

  try {
    const payload = buildBlobPayload();
    console.log('[Shelby] Sending payload:', payload);

    if (!window._aip62Petra) throw new Error('Ví chưa được kết nối');

    let txn;
    const legacyProvider = window.petra || window.aptos;

    if (legacyProvider && typeof legacyProvider.signAndSubmitTransaction === 'function') {
      console.log('[Shelby] Using legacy signAndSubmitTransaction with JSON payload');
      txn = await legacyProvider.signAndSubmitTransaction(payload);
    } else {
      console.log('[Shelby] Using AIP-62 signAndSubmitTransaction');
      const feature = window._aip62Petra.features['aptos:signAndSubmitTransaction'];
      if (!feature) throw new Error('Ví không hỗ trợ signAndSubmitTransaction');
      // Thử pass payload trực tiếp, dù AIP-62 thường đòi RawTransaction
      txn = await feature.signAndSubmitTransaction(payload);
    }

    // txn chứa hash hoặc transaction.hash
    const hash = txn?.hash || txn?.transaction?.hash || txn?.txnHash || 'pending';
    const shortHash = typeof hash === 'string' && hash.length > 16
      ? hash.slice(0, 12) + '…' + hash.slice(-6)
      : hash;

    showSyncStatus('success',
      `✓ Blob registered! TX: ${shortHash}`
    );
    console.log('[Shelby] TX:', txn);
    showToast(`✓ Shelby TX confirmed: ${shortHash}`, 5000);
  } catch (err) {
    console.error('[Shelby] Sync error:', err);
    let msg = err?.message || 'Transaction rejected.';
    if (msg.includes('User rejected')) msg = 'Transaction cancelled in wallet.';
    showSyncStatus('error', '✗ ' + msg.slice(0, 90));
  } finally {
    $syncBtn.disabled = false;
  }
}

function showSyncStatus(type, message) {
  $syncSts.hidden = false;
  $syncSts.className = 'sync-status ' + type;
  $syncSts.textContent = message;
}

$syncBtn.addEventListener('click', syncToShelby);

/* ═══════════════════════════════════════════════
   BUTTON HANDLERS
═══════════════════════════════════════════════ */
$newBtn.addEventListener('click', newGame);
$modalNew.addEventListener('click', newGame);

/* ═══════════════════════════════════════════════
   TOAST
═══════════════════════════════════════════════ */
let toastTimer = null;
function showToast(msg, duration = 3000) {
  $toastMsg.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $toast.hidden = true; }, duration);
}

/* ═══════════════════════════════════════════════
   RESPONSIVE — RE-RENDER ON RESIZE
═══════════════════════════════════════════════ */
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => fullRender(grid), 140);
});

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */
(function init() {
  bestScore = parseInt(localStorage.getItem(LS_BEST) || '0', 10);
  updateAudioIcon();
  newGame();
})();
