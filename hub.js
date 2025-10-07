// ===== State & persistence =====
const state = { name:'', unlocked:new Set(), clues:[] };
const LS_KEY = 'hunt_progress_v1';

function loadProgress(){
  try{
    const raw = localStorage.getItem(LS_KEY); if(!raw) return;
    const d = JSON.parse(raw);
    state.name = d.name || '';
    state.unlocked = new Set(d.unlocked || []);
  }catch(_){}
}
function saveProgress(){
  const d = { name: state.name, unlocked: Array.from(state.unlocked) };
  localStorage.setItem(LS_KEY, JSON.stringify(d));
}
function percent(){ return state.clues.length ? Math.round(100*state.unlocked.size/state.clues.length) : 0; }

// ===== Unlock sound (plays on the same user gesture) =====
function playSpooky(){
  const el = document.getElementById('unlockSound');
  if(!el) return;
  try{
    el.muted = false;
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.then === 'function') p.catch(()=>{});
  }catch(_){}
}

// ===== Toast =====
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=> t.classList.remove('show'), 1600);
}

// ===== Modal (non-blocking) =====
function showModal({title,label,placeholder='',confirmText='OK',cancelText='Cancel',type='text',defaultValue='',onConfirm}){
  const root=document.getElementById('modalRoot');
  root.setAttribute('aria-hidden','false');
  root.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
      <h3 id="mTitle">${escapeHtml(title)}</h3>
      <label>${escapeHtml(label)}</label>
      <input id="mInput" type="${type}" autocomplete="off" autocapitalize="characters" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue)}" />
      <div class="row">
        <button class="btn secondary" id="mCancel">${escapeHtml(cancelText)}</button>
        <button class="btn" id="mOk">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;
  const input=root.querySelector('#mInput');
  const ok=root.querySelector('#mOk');
  const cancel=root.querySelector('#mCancel');
  function close(){ root.setAttribute('aria-hidden','true'); root.innerHTML=''; }
  cancel.onclick = ()=> close();
  ok.onclick = ()=>{ const v=input.value; close(); onConfirm && onConfirm(v); };
  input.addEventListener('keydown', e=>{ if(e.key==='Enter'){ ok.click(); } if(e.key==='Escape'){ cancel.click(); } });
  setTimeout(()=> input.focus(), 0);
}

// ===== Init & UI wiring =====
async function init(){
  loadProgress();
  const res = await fetch('./clues.json?'+Date.now());
  state.clues = await res.json();
  render();
  document.getElementById('btnName').onclick = ensureName;
  document.getElementById('btnReset').onclick = resetProgress;
  setInterval(updateAllCountdowns, 1000);
}

function ensureName(){
  showModal({
    title:'Set Player Name',
    label:'Enter your player name:',
    placeholder:'e.g., Michael',
    confirmText:'Save',
    defaultValue: state.name || '',
    onConfirm:(v)=>{
      const name=(v||'').trim().slice(0,32);
      if(!name) return;
      state.name=name; saveProgress(); renderHeader();
    }
  });
}

function enterCode(id){
  const clue = state.clues.find(c=>c.id===id);
  showModal({
    title:'Enter Passcode',
    label:`Passcode for ${clue.title}:`,
    placeholder:'Type code (not case-sensitive)',
    confirmText:'Unlock',
    onConfirm:(code)=>{
      if(!code) return;
      const norm = code.trim().toUpperCase();
      const ok = clue.codes.some(c=>c.toUpperCase()===norm);
      if(ok){
        state.unlocked.add(id); saveProgress(); render();
        try{ navigator.vibrate && navigator.vibrate([30,40,20]); }catch(_){}
        playSpooky();
        showToast('🎃 Unlocked!');
      }else{
        showToast('❌ Incorrect code');
      }
    }
  });
}

function resetProgress(){
  showModal({
    title:'Reset Progress',
    label:'Type RESET to confirm:',
    placeholder:'RESET',
    confirmText:'Confirm',
    onConfirm:(txt)=>{
      if((txt||'').trim().toUpperCase()==='RESET'){
        state.unlocked.clear(); saveProgress(); render();
        showToast('Progress reset');
      }
    }
  });
}

function renderHeader(){
  const pct = percent();
  document.querySelector('#playerName').textContent = state.name?state.name:'Player';
  document.querySelector('#pct').textContent = pct+'%';
  document.querySelector('#bar').style.width = pct+'%';
}

// ===== Countdown helpers for Reveal Answer =====
function parseRevealAt(iso){
  if(!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}
function formatCountdown(ms){
  if(ms <= 0) return 'Ready';
  const s = Math.ceil(ms/1000);
  const d = Math.floor(s/86400);
  const h = Math.floor((s%86400)/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  if(d>0) return `${d}d ${h}h ${m}m`;
  if(h>0) return `${h}h ${m}m ${sec}s`;
  if(m>0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function localTimeCaption(msEpoch){
  try{
    const d = new Date(msEpoch);
    return d.toLocaleString(undefined, { dateStyle:'medium', timeStyle:'short' });
  }catch(_){ return ''; }
}
function updateAllCountdowns(){
  const now = Date.now();
  document.querySelectorAll('[data-reveal-at]')
    .forEach(btn=>{
      const at = Number(btn.getAttribute('data-reveal-at')) || 0;
      const ms = at - now;
      if(ms <= 0){
        btn.disabled = false;
        btn.textContent = 'Reveal Answer';
        btn.removeAttribute('aria-disabled');
        btn.removeAttribute('data-reveal-at');
      }else{
        btn.disabled = true;
        btn.setAttribute('aria-disabled','true');
        btn.textContent = 'Reveal in ' + formatCountdown(ms);
      }
    });
}

// ===== Main render =====
function render(){
  renderHeader();
  const list = document.querySelector('#list'); list.innerHTML = '';

  for(const clue of state.clues){
    const unlocked = state.unlocked.has(clue.id);
    const card = document.createElement('div');
    card.className = 'card' + (unlocked ? '' : ' locked');

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = `${clue.title} ${unlocked?'🟢':'🔒'}`;

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = unlocked ? 'Unlocked' : 'Locked • Enter passcode to unlock';

    const body = document.createElement('div');

    if(unlocked){
      // Show the clue text
      body.innerHTML = `
        <div class="small">Clue:</div>
        <div class="code">${escapeHtml(clue.text||'')}</div>
      `;

      // Optional Reveal Answer button (time-gated + caption)
      const revealAt = parseRevealAt(clue.reveal_at);
      if (clue.answer && revealAt){
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.style.marginTop = '10px';
        btn.setAttribute('data-reveal-at', String(revealAt));

        const cap = document.createElement('div');
        cap.className = 'reveal-caption';
        cap.textContent = 'Reveals at ' + localTimeCaption(revealAt);

        btn.onclick = ()=>{
          const now = Date.now();
          if(now < revealAt){
            updateAllCountdowns();
            return;
          }
          btn.remove(); cap.remove();
          const ans = document.createElement('div');
          ans.className = 'code';
          ans.style.marginTop = '10px';
          ans.textContent = clue.answer;
          body.appendChild(ans);
          showToast('🗝️ Answer revealed');
        };

        body.appendChild(btn);
        body.appendChild(cap);
      }

    }else{
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = 'Enter Passcode';
      btn.onclick = ()=>enterCode(clue.id);
      body.appendChild(btn);
    }

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(body);
    list.appendChild(card);
  }

  updateAllCountdowns();
}

function escapeHtml(s){return (s??'').toString().replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}

window.addEventListener('load', init);
