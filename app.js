// PWA registration (optional in browser)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}
let deferredInstall = null;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); deferredInstall = e; if (installBtn) installBtn.style.display = 'inline-block';
});
installBtn?.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice;
  deferredInstall = null; installBtn.style.display = 'none';
});

// App state
const LS_KEY = 'selfcare_tombola_v3';
const titleEl = document.getElementById('title');
const catEl = document.getElementById('category');
const addBtn = document.getElementById('addBtn');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const countInfo = document.getElementById('countInfo');
const drawBtn = document.getElementById('drawBtn');
const skipBtn = document.getElementById('skipBtn');
const doneBtn = document.getElementById('doneBtn');
const resultEl = document.getElementById('result');
const noDataEl = document.getElementById('noData');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const resetBtn = document.getElementById('resetBtn');
const togglePoolBtn = document.getElementById('togglePoolBtn');
const poolWrap = document.getElementById('poolWrap');
const modeSelfBtn = document.getElementById('modeSelfcare');
const modeTodoBtn = document.getElementById('modeTodo');
const appTitle = document.getElementById('appTitle');
const categories = ['<10','10-20','20-30','>30'];

function load(){ try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } }
function save(d){ localStorage.setItem(LS_KEY, JSON.stringify(d)); }

let currentMode = localStorage.getItem('tombola_mode') || 'selfcare';
function setMode(m){
  currentMode = m; localStorage.setItem('tombola_mode', m);
  modeSelfBtn.classList.toggle('active', m==='selfcare');
  modeTodoBtn.classList.toggle('active', m==='todo');
  modeSelfBtn.setAttribute('aria-selected', m==='selfcare');
  modeTodoBtn.setAttribute('aria-selected', m==='todo');
  appTitle.textContent = m==='selfcare' ? 'Selfcare‑Tombola' : 'To‑Do‑Tombola';
  document.title = appTitle.textContent;
  render(); updateDoneBtn();
}
function updateDoneBtn(){ doneBtn.style.display = currentMode==='todo' ? 'inline-block' : 'none'; }

let poolVisible = false;
function setPoolVisibility(v){
  poolVisible = v;
  poolWrap.style.display = v ? 'block' : 'none';
  togglePoolBtn.textContent = v ? 'Ideenpool verbergen' : 'Ideenpool zeigen';
}

function render(){
  const data = load().filter(x=>x.type===currentMode);
  listEl.innerHTML = '';
  const total = data.length;
  countInfo.textContent = total ? `${total} gespeichert` : '';
  emptyEl.style.display = total ? 'none' : 'block';
  if(!total) return;
  data.sort((a,b)=> categories.indexOf(a.cat)-categories.indexOf(b.cat) || a.title.localeCompare(b.title,'de'));
  for(const item of data){
    const row = document.createElement('div'); row.className = 'item';
    const status = currentMode==='todo' && item.done ? ' · ✅ erledigt' : '';
    row.innerHTML = `
      <div>
        <div style="font-weight:700;line-height:1.1">${escapeHtml(item.title)}</div>
        <small class="muted">${labelFor(item.cat)}${status}</small>
      </div>
      <div class="row">
        ${currentMode==='todo' ? '<button class="btn" data-action="toggle">Erledigt</button>' : ''}
        <button class="btn" data-action="edit">Bearb.</button>
        <button class="btn warn" data-action="del">Löschen</button>
      </div>`;
    if(currentMode==='todo'){
      row.querySelector('[data-action="toggle"]').addEventListener('click', ()=>{
        const next = load().map(x=> x.id===item.id ? {...x, done:!x.done} : x);
        save(next); render();
      });
    }
    row.querySelector('[data-action="del"]').addEventListener('click', ()=>{
      const next = load().filter(x=>x.id!==item.id);
      save(next); render();
    });
    row.querySelector('[data-action="edit"]').addEventListener('click', ()=>{
      const name = prompt('Neuer Titel:', item.title); if(name===null) return;
      const cat = prompt('Neue Kategorie: <10 | 10-20 | 20-30 | >30', item.cat); if(cat===null) return;
      const valid = ['<10','10-20','20-30','>30']; if(!valid.includes(cat.trim())){ alert('Ungültige Kategorie.'); return; }
      const next = load().map(x=> x.id===item.id ? {...x, title:name.trim(), cat:cat.trim()} : x);
      save(next); render();
    });
    listEl.appendChild(row);
  }
}

function labelFor(cat){
  switch(cat){
    case '<10': return '< 10 Minuten';
    case '10-20': return '10–20 Minuten';
    case '20-30': return '20–30 Minuten';
    case '>30': return '> 30 Minuten';
    default: return cat;
  }
}

function addEntry(){
  const title = titleEl.value.trim(); const cat = catEl.value;
  if(!title){ titleEl.focus(); return; }
  const data = load();
  if(data.some(x=>x.title.toLowerCase()===title.toLowerCase() && x.cat===cat && x.type===currentMode)){
    alert('Dieser Eintrag existiert bereits in dieser Kategorie.'); return;
  }
  data.push({ id: crypto.randomUUID(), title, cat, type: currentMode, done:false });
  save(data); titleEl.value=''; titleEl.focus(); render();
}

function currentPickCategory(){
  const checked = document.querySelector('input[name="pickCat"]:checked');
  return checked ? checked.value : 'any';
}

let lastId = null, animating = false;
function draw(){
  if(animating) return;
  const cat = currentPickCategory();
  let pool = load().filter(x=>x.type===currentMode);
  if(cat!=='any') pool = pool.filter(x=>x.cat===cat);
  if(currentMode==='todo'){
    const open = pool.filter(x=>!x.done);
    if(open.length) pool = open;
  }
  if(pool.length===0){
    resultEl.style.display='none'; noDataEl.style.display='block'; return;
  }
  noDataEl.style.display='none';
  let candidates = pool;
  if(pool.length>1 && lastId){
    const alt = pool.filter(x=>x.id!==lastId);
    if(alt.length) candidates = alt;
  }
  animateRoll(candidates, 1200).then(pick=>{
    lastId = pick.id;
    const status = currentMode==='todo' && pick.done ? ' · ✅ erledigt' : '';
    resultEl.innerHTML = `<strong>${escapeHtml(pick.title)}</strong><br><small class="muted">${labelFor(pick.cat)}${status}</small>`;
    resultEl.style.display='block';
    microCelebrate();
    resultEl.dataset.lastId = pick.id;
  });
}

function animateRoll(pool, durationMs){
  animating = true;
  drawBtn.classList.add('disabled'); skipBtn.classList.add('disabled'); doneBtn.classList.add('disabled');
  resultEl.style.display='block';
  const start = performance.now(); let lastText = '';
  return new Promise(resolve=>{
    function frame(now){
      const t = now - start; const progress = Math.min(t/durationMs, 1);
      const interval = 60 + 240*progress;
      resultEl.classList.add('rolling');
      const nextTime = (+resultEl.dataset._nextTime || 0);
      if(now >= nextTime){
        const pick = pool[Math.floor(Math.random()*pool.length)];
        const text = `${pick.title} · ${labelFor(pick.cat)}`;
        if(text !== lastText){ resultEl.textContent = text; lastText = text; }
        resultEl.dataset._nextTime = String(now + interval);
        resultEl.dataset._lastId = pick.id;
      }
      if(progress < 1){
        requestAnimationFrame(frame);
      }else{
        const id = resultEl.dataset._lastId;
        const final = pool.find(x=>x.id===id) || pool[0];
        resultEl.classList.remove('rolling');
        delete resultEl.dataset._nextTime; delete resultEl.dataset._lastId;
        animating = false;
        drawBtn.classList.remove('disabled'); skipBtn.classList.remove('disabled'); doneBtn.classList.remove('disabled');
        resolve(final);
      }
    }
    requestAnimationFrame(frame);
  });
}

function markDoneFromResult(){
  if(currentMode!=='todo') return;
  const id = resultEl.dataset.lastId; if(!id) return;
  const next = load().map(x=> x.id===id ? {...x, done:true} : x);
  save(next); render(); draw();
}

function microCelebrate(){
  const e = document.createElement('div');
  e.style.position='fixed'; e.style.left='50%'; e.style.top='14px'; e.style.transform='translateX(-50%)';
  e.style.pointerEvents='none'; e.style.fontSize='24px'; e.style.opacity='0.95';
  e.textContent='🎉'; document.body.appendChild(e);
  setTimeout(()=>{ e.style.transition='all .8s ease'; e.style.top='-50px'; e.style.opacity='0'; },30);
  setTimeout(()=> e.remove(), 1000);
}

function exportJson(){
  const blob = new Blob([JSON.stringify(load(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'tombola-data.json'; a.click();
  URL.revokeObjectURL(url);
}

function importJson(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!Array.isArray(parsed)) throw new Error('Struktur ungültig');
      const valid = ['<10','10-20','20-30','>30'];
      const clean = parsed
        .filter(x=>x && typeof x.title==='string' && valid.includes(x.cat))
        .map(x=>({ id: x.id || crypto.randomUUID(), title: x.title.trim(), cat: x.cat, type: (x.type==='todo'?'todo':'selfcare'), done: !!x.done }));
      const existing = load(); const merged = existing.slice();
      for(const n of clean){
        if(!merged.some(x=>x.title.toLowerCase()===n.title.toLowerCase() && x.cat===n.cat && x.type===n.type)) merged.push(n);
      }
      save(merged); render();
    }catch(err){ alert('Import fehlgeschlagen: '+err.message); }
  };
  reader.readAsText(file);
}

function resetAll(){
  if(confirm('Wirklich alle Einträge (Selfcare & To‑Do) löschen?')){
    localStorage.removeItem(LS_KEY);
    render(); resultEl.style.display='none'; noDataEl.style.display='none';
  }
}

function escapeHtml(s){
  return s.replace(/[&<>\"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// events
addBtn.addEventListener('click', addEntry);
titleEl.addEventListener('keydown', e=>{ if(e.key==='Enter') addEntry(); });
drawBtn.addEventListener('click', draw);
skipBtn.addEventListener('click', draw);
doneBtn.addEventListener('click', markDoneFromResult);
exportBtn?.addEventListener('click', exportJson);
importFile?.addEventListener('change', e=>{ if(e.target.files?.[0]) importJson(e.target.files[0]); e.target.value=''; });
resetBtn.addEventListener('click', resetAll);
togglePoolBtn.addEventListener('click', ()=> setPoolVisibility(!poolVisible));
document.addEventListener('keydown', e=>{ if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); draw(); } });
modeSelfBtn.addEventListener('click', ()=> setMode('selfcare'));
modeTodoBtn.addEventListener('click', ()=> setMode('todo'));
setMode(currentMode);
setPoolVisibility(false);
