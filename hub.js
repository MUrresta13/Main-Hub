// State
const state={name:'',unlocked:new Set(),clues:[]};
const LS_KEY='hunt_progress_v1';

// ---------- Persistence ----------
function loadProgress(){
  try{
    const raw=localStorage.getItem(LS_KEY); if(!raw) return;
    const d=JSON.parse(raw);
    state.name=d.name||'';
    state.unlocked=new Set(d.unlocked||[]);
  }catch(_){}
}
function saveProgress(){
  const d={name:state.name,unlocked:Array.from(state.unlocked)};
  localStorage.setItem(LS_KEY,JSON.stringify(d));
}
function percent(){ return state.clues.length ? Math.round(100*state.unlocked.size/state.clues.length) : 0; }

// ---------- Unlock sound (plays on same user gesture) ----------
function playSpooky(){
  const el = document.getElementById('unlockSound');
  if (!el) return;
  try{
    el.muted = false;     // ensure unmuted for iOS PWA
    el.currentTime = 0;   // restart
    const p = el.play();  // play immediately on the gesture
    if (p && typeof p.then === 'function') p.catch(()=>{});
  }catch(_){}
}

// ---------- Modal (custom) ----------
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

// ---------- UI behaviors ----------
async function init(){
  loadProgress();
  const res=await fetch('./clues.json?'+Date.now());
  state.clues=await res.json();
  render();
  // bind buttons
  document.getElementById('btnName').onclick = ensureName;
  document.getElementById('btnReset').onclick = resetProgress;
}

function ensureName(){
  showModal({
    title: 'Set Player Name',
    label: 'Enter your player name:',
    placeholder: 'e.g., Michael',
    confirmText:'Save',
    defaultValue: state.name || '',
    onConfirm: (v)=>{
      const name=(v||'').trim().slice(0,32);
      if(!name) return;
      state.name=name; saveProgress(); renderHeader();
    }
  });
}

function enterCode(id){
  const clue=state.clues.find(c=>c.id===id);
  showModal({
    title: 'Enter Passcode',
    label: `Passcode for ${clue.title}:`,
    placeholder: 'Type code (not case-sensitive)',
    confirmText: 'Unlock',
    onConfirm: (code)=>{
      if(!code) return;
      const norm=code.trim().toUpperCase();
      const ok=clue.codes.some(c=>c.toUpperCase()===norm);
      if(ok){
        // SUCCESS path runs on same tap => allowed to play audio in iOS PWA
        state.unlocked.add(id); saveProgress(); render();
        try{ navigator.vibrate && navigator.vibrate([30,40,20]); }catch(_){}
        playSpooky(); // <-- primer + playback exactly on this gesture
        alert('Unlocked!');
      }else{
        alert('Not quite—try again!');
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
      }
    }
  });
}

function renderHeader(){
  const nameEl=document.querySelector('#playerName');
  const pct=percent();
  nameEl.textContent=state.name?state.name:'Player';
  document.querySelector('#pct').textContent=pct+'%';
  document.querySelector('#bar').style.width=pct+'%';
}

function render(){
  renderHeader();
  const list=document.querySelector('#list'); list.innerHTML='';
  for(const clue of state.clues){
    const unlocked=state.unlocked.has(clue.id);
    const card=document.createElement('div');
    card.className='card'+(unlocked?'':' locked');

    const title=document.createElement('div');
    title.className='title';
    title.textContent=`${clue.title} ${unlocked?'🟢':'🔒'}`;

    const meta=document.createElement('div');
    meta.className='meta';
    meta.textContent = unlocked ? 'Unlocked' : 'Locked • Enter passcode to unlock';

    const body=document.createElement('div');
    if(unlocked){
      body.innerHTML = `<div class="small">Clue:</div>
                        <div class="code">${escapeHtml(clue.text)}</div>`;
    }else{
      const btn=document.createElement('button');
      btn.className='btn'; btn.textContent='Enter Passcode';
      btn.onclick=()=>enterCode(clue.id);
      body.appendChild(btn);
    }

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(body);
    list.appendChild(card);
  }
}

function escapeHtml(s){return (s??'').toString().replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));}

window.addEventListener('load',init);
