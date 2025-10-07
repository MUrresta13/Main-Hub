const state = { name: '', unlocked: new Set(), clues: [] };
const LS_KEY = 'hunt_progress_v1';

function loadProgress() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    state.name = d.name || '';
    state.unlocked = new Set(d.unlocked || []);
  } catch {}
}
function saveProgress() {
  const d = { name: state.name, unlocked: Array.from(state.unlocked) };
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}
function percent() {
  return state.clues.length ? Math.round((100 * state.unlocked.size) / state.clues.length) : 0;
}

// Spooky sound (Web Audio API)
let audioCtx;
function playSpooky() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioCtx = audioCtx || new AudioCtx();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 200;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

function showModal({ title, label, placeholder = '', confirmText = 'OK', cancelText = 'Cancel', type = 'text', defaultValue = '', onConfirm }) {
  const root = document.getElementById('modalRoot');
  root.setAttribute('aria-hidden', 'false');
  root.innerHTML = `
    <div class="modal">
      <h3>${title}</h3>
      <label>${label}</label>
      <input id="mInput" type="${type}" value="${defaultValue}" placeholder="${placeholder}" />
      <div style="text-align:right; margin-top:10px;">
        <button id="mCancel">${cancelText}</button>
        <button id="mOk">${confirmText}</button>
      </div>
    </div>
  `;
  const input = root.querySelector('#mInput');
  const ok = root.querySelector('#mOk');
  const cancel = root.querySelector('#mCancel');
  function close() { root.setAttribute('aria-hidden', 'true'); root.innerHTML = ''; }
  cancel.onclick = () => close();
  ok.onclick = () => { const v = input.value; close(); onConfirm && onConfirm(v); };
  setTimeout(() => input.focus(), 0);
}

async function init() {
  loadProgress();
  const res = await fetch('./clues.json?' + Date.now());
  state.clues = await res.json();
  render();
  document.getElementById('btnName').onclick = ensureName;
  document.getElementById('btnReset').onclick = resetProgress;
}

function ensureName() {
  showModal({
    title: 'Set Player Name',
    label: 'Enter your player name:',
    placeholder: 'e.g., Michael',
    confirmText: 'Save',
    defaultValue: state.name || '',
    onConfirm: (v) => {
      const name = (v || '').trim().slice(0, 32);
      if (!name) return;
      state.name = name;
      saveProgress();
      renderHeader();
    }
  });
}

function enterCode(id) {
  const clue = state.clues.find(c => c.id === id);
  showModal({
    title: 'Enter Passcode',
    label: `Passcode for ${clue.title}:`,
    placeholder: 'Type code',
    confirmText: 'Unlock',
    onConfirm: (code) => {
      if (!code) return;
      const norm = code.trim().toUpperCase();
      const ok = clue.codes.some(c => c.toUpperCase() === norm);
      if (ok) {
        state.unlocked.add(id);
        saveProgress();
        render();
        playSpooky();
        alert('Unlocked!');
      } else {
        alert('Incorrect code!');
      }
    }
  });
}

function resetProgress() {
  showModal({
    title: 'Reset Progress',
    label: 'Type RESET to confirm:',
    placeholder: 'RESET',
    confirmText: 'Confirm',
    onConfirm: (txt) => {
      if ((txt || '').trim().toUpperCase() === 'RESET') {
        state.unlocked.clear();
        saveProgress();
        render();
      }
    }
  });
}

function renderHeader() {
  const pct = percent();
  document.getElementById('playerName').textContent = state.name || 'Player';
  document.getElementById('pct').textContent = pct + '%';
  document.getElementById('bar').style.width = pct + '%';
}

function render() {
  renderHeader();
  const list = document.getElementById('list');
  list.innerHTML = '';
  for (const clue of state.clues) {
    const unlocked = state.unlocked.has(clue.id);
    const div = document.createElement('div');
    div.className = 'card' + (unlocked ? '' : ' locked');
    div.innerHTML = `
      <div class="title">${clue.title} ${unlocked ? '🟢' : '🔒'}</div>
      <div class="meta">${unlocked ? 'Unlocked' : 'Locked – Enter passcode'}</div>
    `;
    if (unlocked) {
      div.innerHTML += `<div><strong>Clue:</strong> ${clue.text}</div>`;
    } else {
      const btn = document.createElement('button');
      btn.textContent = 'Enter Passcode';
      btn.onclick = () => enterCode(clue.id);
      div.appendChild(btn);
    }
    list.appendChild(div);
  }
}

window.addEventListener('load', init);
