/* ================= storage ================= */

const STORE_KEYS = { checkins: 'd2d_checkins', journal: 'd2d_journal', expenses: 'd2d_expenses' };

function loadStore(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(e){ console.error('load failed', key, e); return fallback; }
}
function saveStore(key, value){
  try{ localStorage.setItem(key, JSON.stringify(value)); }
  catch(e){ console.error('save failed', key, e); alert('Could not save — your browser storage might be full or blocked.'); }
}

let checkins = loadStore(STORE_KEYS.checkins, {});   // { 'YYYY-MM-DD': {...} }
let journal  = loadStore(STORE_KEYS.journal, []);    // [ {id, date, category, text} ]
let expenses = loadStore(STORE_KEYS.expenses, []);   // [ {id, ...} ]

/* ================= helpers ================= */

function fmtDate(d){
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayStr(){ return fmtDate(new Date()); }
function addDays(dateStr, delta){
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  dt.setDate(dt.getDate()+delta);
  return fmtDate(dt);
}
function prettyDate(dateStr){
  const [y,m,d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m-1, d);
  return dt.toLocaleDateString(undefined, { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function escapeHtml(str){
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function inr(n){ return '₹' + Number(n||0).toLocaleString('en-IN'); }

/* ================= tabs ================= */

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if(!btn) return;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t === btn));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('is-active', p.id === 'panel-' + btn.dataset.tab));
  if(btn.dataset.tab === 'dashboard') renderDashboard();
});

/* ================= check-in form ================= */

const ciForm = document.getElementById('checkinForm');
const ciDateInput = document.getElementById('ciDate');
ciDateInput.value = todayStr();
ciDateInput.max = todayStr();

// yes/no button groups
function wireYn(container){
  container.querySelectorAll('.yn-field').forEach(field => {
    field.querySelectorAll('.yn button').forEach(btn => {
      btn.addEventListener('click', () => {
        field.querySelectorAll('.yn button').forEach(b => b.classList.remove('is-picked'));
        btn.classList.add('is-picked');
      });
    });
  });
}
wireYn(ciForm);

function wireChips(container){
  container.querySelectorAll('.chip-group').forEach(group => {
    group.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('is-picked'));
    });
  });
}
wireChips(ciForm);

const ciUrge = document.getElementById('ciUrge');
const ciUrgeVal = document.getElementById('ciUrgeVal');
ciUrge.addEventListener('input', () => ciUrgeVal.textContent = ciUrge.value);

function getYnValue(field){
  const picked = field.querySelector('.yn button.is-picked');
  return picked ? picked.dataset.val : null;
}
function getChipValues(group){
  return [...group.querySelectorAll('.chip.is-picked')].map(c => c.dataset.val);
}

function loadCheckinIntoForm(dateStr){
  const data = checkins[dateStr];
  ciForm.querySelectorAll('.yn-field .yn button').forEach(b => b.classList.remove('is-picked'));
  ciForm.querySelectorAll('.chip').forEach(c => c.classList.remove('is-picked'));
  document.getElementById('ciAmount').value = '';
  document.getElementById('ciStruggle').value = '';
  document.getElementById('ciImprove').value = '';
  ciUrge.value = 1; ciUrgeVal.textContent = '1';
  if(!data) return;
  ciForm.querySelectorAll('.yn-field').forEach(field => {
    const key = field.dataset.field;
    if(data[key]){
      const btn = field.querySelector(`.yn button[data-val="${data[key]}"]`);
      if(btn) btn.classList.add('is-picked');
    }
  });
  document.getElementById('ciAmount').value = data.amountSpent ?? '';
  (data.spentOn || []).forEach(v => {
    const chip = document.getElementById('ciSpentOn').querySelector(`.chip[data-val="${CSS.escape(v)}"]`);
    if(chip) chip.classList.add('is-picked');
  });
  (data.triggers || []).forEach(v => {
    const chip = document.getElementById('ciTriggers').querySelector(`.chip[data-val="${CSS.escape(v)}"]`);
    if(chip) chip.classList.add('is-picked');
  });
  ciUrge.value = data.urge ?? 1; ciUrgeVal.textContent = ciUrge.value;
  document.getElementById('ciStruggle').value = data.struggle || '';
  document.getElementById('ciImprove').value = data.improve || '';
}
ciDateInput.addEventListener('change', () => loadCheckinIntoForm(ciDateInput.value));
loadCheckinIntoForm(ciDateInput.value);

ciForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const date = ciDateInput.value;
  if(!date) return;
  const entry = { date };
  ['alcohol','cigarette','porn','masturbate','impulsiveSex','soughtContent','chasingAttention','workout','workStudy','avoidedScrolling','sleepRoutine','spentMoney','choseDiscipline']
    .forEach(key => {
      const field = ciForm.querySelector(`.yn-field[data-field="${key}"]`);
      entry[key] = getYnValue(field);
    });
  entry.amountSpent = Number(document.getElementById('ciAmount').value || 0);
  entry.spentOn = getChipValues(document.getElementById('ciSpentOn'));
  entry.urge = Number(ciUrge.value);
  entry.triggers = getChipValues(document.getElementById('ciTriggers'));
  entry.struggle = document.getElementById('ciStruggle').value.trim();
  entry.improve = document.getElementById('ciImprove').value.trim();

  checkins[date] = entry;
  saveStore(STORE_KEYS.checkins, checkins);
  flashMsg('ciSaveMsg', 'Saved for ' + prettyDate(date));
  renderCheckinHistory();
  renderRailStreak();
});

function flashMsg(id, text){
  const el = document.getElementById(id);
  el.textContent = text;
  el.classList.add('is-shown');
  setTimeout(() => el.classList.remove('is-shown'), 2200);
}

function isCleanDay(entry){
  if(!entry) return null;
  const watch = ['alcohol','cigarette','porn','masturbate','impulsiveSex','soughtContent','chasingAttention'];
  return watch.every(k => entry[k] === 'no');
}

function renderCheckinHistory(){
  const box = document.getElementById('ciHistory');
  const dates = Object.keys(checkins).sort().reverse().slice(0, 20);
  if(dates.length === 0){ box.innerHTML = '<p class="empty-note">No check-ins yet. Today\'s entry will show up here.</p>'; return; }
  box.innerHTML = dates.map(date => {
    const e = checkins[date];
    const clean = isCleanDay(e);
    const spentBit = e.amountSpent > 0 ? `<span class="tag tag-slip">${inr(e.amountSpent)} spent</span>` : '';
    const noteBits = [e.struggle, e.improve].filter(Boolean);
    return `<div class="entry-card">
      <div class="entry-head">
        <span class="entry-date">${prettyDate(date)}</span>
        <div class="entry-tags">
          <span class="tag ${clean ? 'tag-good' : 'tag-slip'}">${clean ? 'clean day' : 'slip logged'}</span>
          ${spentBit}
          <button class="entry-del" data-del-checkin="${date}" title="Delete">delete</button>
        </div>
      </div>
      <div class="entry-body">Urge ${e.urge}/10${e.triggers?.length ? ' · triggers: ' + escapeHtml(e.triggers.join(', ')) : ''}</div>
      ${noteBits.length ? `<div class="entry-note">${escapeHtml(noteBits.join(' — '))}</div>` : ''}
    </div>`;
  }).join('');
}
document.getElementById('ciHistory').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-del-checkin]');
  if(!btn) return;
  const date = btn.dataset.delCheckin;
  if(!confirm('Delete the check-in for ' + prettyDate(date) + '?')) return;
  delete checkins[date];
  saveStore(STORE_KEYS.checkins, checkins);
  renderCheckinHistory();
  renderRailStreak();
});

/* ================= journal form ================= */

const jForm = document.getElementById('journalForm');
const jCategory = document.getElementById('jCategory');
const jCategoryOther = document.getElementById('jCategoryOther');
jCategory.addEventListener('change', () => {
  jCategoryOther.hidden = jCategory.value !== '__other';
});

jForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = document.getElementById('jText').value.trim();
  if(!text) return;
  const category = jCategory.value === '__other' ? (jCategoryOther.value.trim() || 'Other') : jCategory.value;
  journal.unshift({ id: uid(), date: todayStr(), timestamp: Date.now(), category, text });
  saveStore(STORE_KEYS.journal, journal);
  jForm.reset();
  jCategoryOther.hidden = true;
  flashMsg('jSaveMsg', 'Added to your journal');
  renderJournal();
});

function renderJournalFilterOptions(){
  const sel = document.getElementById('jFilter');
  const cats = [...new Set(journal.map(j => j.category))];
  const current = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  sel.value = cats.includes(current) ? current : '';
}

function renderJournal(){
  renderJournalFilterOptions();
  const q = document.getElementById('jSearch').value.trim().toLowerCase();
  const filterCat = document.getElementById('jFilter').value;
  const box = document.getElementById('jHistory');
  let list = journal.slice();
  if(filterCat) list = list.filter(j => j.category === filterCat);
  if(q) list = list.filter(j => j.text.toLowerCase().includes(q) || j.category.toLowerCase().includes(q));
  if(list.length === 0){ box.innerHTML = '<p class="empty-note">Nothing here yet.</p>'; return; }
  box.innerHTML = list.map(j => `
    <div class="entry-card">
      <div class="entry-head">
        <span class="entry-date">${prettyDate(j.date)}</span>
        <div class="entry-tags">
          <span class="tag">${escapeHtml(j.category)}</span>
          <button class="entry-del" data-del-journal="${j.id}" title="Delete">delete</button>
        </div>
      </div>
      <div class="entry-body">${escapeHtml(j.text)}</div>
    </div>`).join('');
}
document.getElementById('jSearch').addEventListener('input', renderJournal);
document.getElementById('jFilter').addEventListener('change', renderJournal);
document.getElementById('jHistory').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-del-journal]');
  if(!btn) return;
  if(!confirm('Delete this journal entry?')) return;
  journal = journal.filter(j => j.id !== btn.dataset.delJournal);
  saveStore(STORE_KEYS.journal, journal);
  renderJournal();
});

/* ================= expenses form ================= */

const eForm = document.getElementById('expenseForm');
const eType = document.getElementById('eType');
const eTypeOther = document.getElementById('eTypeOther');
eType.addEventListener('change', () => { eTypeOther.hidden = eType.value !== '__other'; });

eForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const desc = document.getElementById('eDesc').value.trim();
  if(!desc) return;
  const type = eType.value === '__other' ? (eTypeOther.value.trim() || 'Other') : eType.value;
  expenses.unshift({
    id: uid(),
    type,
    description: desc,
    amount: Number(document.getElementById('eAmount').value || 0),
    targetDate: document.getElementById('eDate').value || null,
    priority: document.getElementById('ePriority').value,
    category: document.getElementById('eCategory').value.trim() || 'Uncategorised',
    link: document.getElementById('eLink').value.trim() || null,
    done: false,
    createdAt: Date.now()
  });
  saveStore(STORE_KEYS.expenses, expenses);
  eForm.reset();
  eTypeOther.hidden = true;
  flashMsg('eSaveMsg', 'Added to your list');
  renderExpenses();
});

function renderExpenses(){
  const sortBy = document.getElementById('eSort').value;
  const hideDone = document.getElementById('eHideDone').checked;
  const box = document.getElementById('eHistory');
  let list = expenses.slice();
  if(hideDone) list = list.filter(x => !x.done);

  const prOrder = { High:0, Medium:1, Low:2 };
  if(sortBy === 'date') list.sort((a,b) => (a.targetDate||'9999') > (b.targetDate||'9999') ? 1 : -1);
  else if(sortBy === 'priority') list.sort((a,b) => (prOrder[a.priority]??3) - (prOrder[b.priority]??3));
  else if(sortBy === 'amount') list.sort((a,b) => b.amount - a.amount);

  // summary (not-done items only)
  const active = expenses.filter(x => !x.done);
  const totalPlanned = active.reduce((s,x) => s + (x.amount||0), 0);
  const highTotal = active.filter(x => x.priority === 'High').reduce((s,x) => s + (x.amount||0), 0);
  document.getElementById('eSummary').innerHTML = `
    <div><b>${inr(totalPlanned)}</b>total planned</div>
    <div><b>${inr(highTotal)}</b>high priority</div>
    <div><b>${active.length}</b>open items</div>
    <div><b>${expenses.filter(x=>x.done).length}</b>purchased</div>`;

  if(list.length === 0){ box.innerHTML = '<p class="empty-note">Nothing planned yet.</p>'; return; }
  box.innerHTML = list.map(x => `
    <div class="entry-card${x.done ? ' is-done' : ''}" style="${x.done ? 'opacity:.55' : ''}">
      <div class="entry-head">
        <span class="entry-date">${escapeHtml(x.description)}</span>
        <div class="entry-tags">
          <span class="priority-pill priority-${x.priority}">${x.priority}</span>
          <button class="entry-del" data-del-expense="${x.id}" title="Delete">delete</button>
        </div>
      </div>
      <div class="entry-body">
        ${inr(x.amount)} · ${escapeHtml(x.category)} · ${escapeHtml(x.type)}${x.targetDate ? ' · by ' + prettyDate(x.targetDate) : ''}
        ${x.link ? ` · <a href="${escapeHtml(x.link)}" target="_blank" rel="noopener">link</a>` : ''}
      </div>
      <label class="check-inline" style="margin-top:8px;">
        <input type="checkbox" data-done-expense="${x.id}" ${x.done ? 'checked' : ''}> Purchased / done
      </label>
    </div>`).join('');
}
['eSort','eHideDone'].forEach(id => document.getElementById(id).addEventListener('change', renderExpenses));
document.getElementById('eHistory').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del-expense]');
  if(del){
    if(!confirm('Delete this item?')) return;
    expenses = expenses.filter(x => x.id !== del.dataset.delExpense);
    saveStore(STORE_KEYS.expenses, expenses);
    renderExpenses();
    return;
  }
});
document.getElementById('eHistory').addEventListener('change', (e) => {
  const chk = e.target.closest('[data-done-expense]');
  if(!chk) return;
  const item = expenses.find(x => x.id === chk.dataset.doneExpense);
  if(item){ item.done = chk.checked; saveStore(STORE_KEYS.expenses, expenses); renderExpenses(); }
});

/* ================= streak / rail ================= */

function computeStreaks(){
  const dates = Object.keys(checkins).sort();
  if(dates.length === 0) return { current: 0, best: 0 };

  // current: walk back from today (or yesterday if today not logged yet)
  let anchor = checkins[todayStr()] ? todayStr() : addDays(todayStr(), -1);
  let current = 0;
  while(checkins[anchor] && isCleanDay(checkins[anchor])){
    current++;
    anchor = addDays(anchor, -1);
  }

  // best: longest run of consecutive calendar days that are clean
  let best = 0, run = 0, prev = null;
  dates.forEach(d => {
    const clean = isCleanDay(checkins[d]);
    if(clean && prev === addDays(d, -1)){ run++; }
    else if(clean){ run = 1; }
    else{ run = 0; }
    best = Math.max(best, run);
    prev = d;
  });
  return { current, best: Math.max(best, current) };
}

function renderRailStreak(){
  document.getElementById('railStreak').textContent = computeStreaks().current;
}

/* ================= dashboard ================= */

let charts = {};
function killChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }

function renderDashboard(){
  const { current, best } = computeStreaks();
  document.getElementById('dCurrentStreak').textContent = current;
  document.getElementById('dBestStreak').textContent = best;

  const monthPrefix = todayStr().slice(0,7);
  let monthTotal = 0, allTotal = 0;
  Object.values(checkins).forEach(e => {
    allTotal += (e.amountSpent||0);
    if(e.date.startsWith(monthPrefix)) monthTotal += (e.amountSpent||0);
  });
  document.getElementById('dMoneyMonth').textContent = inr(monthTotal);
  document.getElementById('dMoneyTotal').textContent = inr(allTotal);

  renderHeatmap();
  renderUrgeChart();
  renderTriggerChart();
  renderMoneyChart();
  renderExpenseChart();
  renderJournalStats();
}

function renderHeatmap(){
  const box = document.getElementById('heatmap');
  const days = 84;
  let html = '';
  const end = todayStr();
  for(let i = days-1; i >= 0; i--){
    const d = addDays(end, -i);
    const e = checkins[d];
    let cls = '';
    if(e) cls = isCleanDay(e) ? 'hm-good' : 'hm-slip';
    html += `<div class="hm-cell ${cls}" title="${d}"></div>`;
  }
  box.innerHTML = html;
}

function lastNCheckinDates(n){
  return Object.keys(checkins).sort().slice(-n);
}

function renderUrgeChart(){
  const dates = lastNCheckinDates(30);
  killChart('urge');
  const ctx = document.getElementById('urgeChart');
  if(dates.length === 0){ ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }
  charts.urge = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => d.slice(5)),
      datasets: [{
        label: 'Urge (1-10)',
        data: dates.map(d => checkins[d].urge ?? null),
        borderColor: '#c9a24a',
        backgroundColor: 'rgba(201,162,74,0.15)',
        tension: 0.3,
        fill: true,
        pointRadius: 2
      }]
    },
    options: baseChartOpts({ yMax: 10 })
  });
}

function renderTriggerChart(){
  const counts = {};
  Object.values(checkins).forEach(e => (e.triggers||[]).forEach(t => counts[t] = (counts[t]||0)+1));
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8);
  killChart('trigger');
  const ctx = document.getElementById('triggerChart');
  if(entries.length === 0){ ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }
  charts.trigger = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(e => e[0]),
      datasets: [{ label: 'Times logged', data: entries.map(e => e[1]), backgroundColor: '#b0614a' }]
    },
    options: { ...baseChartOpts({}), indexAxis: 'y' }
  });
}

function renderMoneyChart(){
  const dates = lastNCheckinDates(30);
  killChart('money');
  const ctx = document.getElementById('moneyChart');
  if(dates.length === 0){ ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }
  charts.money = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(d => d.slice(5)),
      datasets: [{ label: 'Spent (₹)', data: dates.map(d => checkins[d].amountSpent||0), backgroundColor: '#8a9a6e' }]
    },
    options: baseChartOpts({})
  });
}

function renderExpenseChart(){
  const active = expenses.filter(x => !x.done);
  const byPriority = { High:0, Medium:0, Low:0 };
  active.forEach(x => byPriority[x.priority] = (byPriority[x.priority]||0) + (x.amount||0));
  killChart('expense');
  const ctx = document.getElementById('expenseChart');
  if(active.length === 0){ ctx.getContext('2d').clearRect(0,0,ctx.width,ctx.height); return; }
  charts.expense = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(byPriority),
      datasets: [{ data: Object.values(byPriority), backgroundColor: ['#b0614a','#c9a24a','#5c5a4e'] }]
    },
    options: { plugins: { legend: { labels: { color: '#a29b8a' } } } }
  });
}

function renderJournalStats(){
  const weekAgo = addDays(todayStr(), -7);
  const thisWeek = journal.filter(j => j.date >= weekAgo).length;
  const counts = {};
  journal.forEach(j => counts[j.category] = (counts[j.category]||0)+1);
  const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('journalStats').innerHTML = `
    <div><b>${journal.length}</b>total entries</div>
    <div><b>${thisWeek}</b>this week</div>
    <div><b>${top ? escapeHtml(top[0]) : '—'}</b>most-used category</div>`;
}

function baseChartOpts({ yMax } = {}){
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#a29b8a', font: { size: 11 } }, grid: { color: '#2a2822' } },
      y: { ticks: { color: '#a29b8a', font: { size: 11 } }, grid: { color: '#2a2822' }, max: yMax, beginAtZero: true }
    }
  };
}

/* ================= export / import ================= */

document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = { checkins, journal, expenses, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `d2d-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!confirm('This will merge the imported data with what you already have here. Continue?')) return;
      if(data.checkins) checkins = { ...checkins, ...data.checkins };
      if(Array.isArray(data.journal)) journal = mergeById(journal, data.journal);
      if(Array.isArray(data.expenses)) expenses = mergeById(expenses, data.expenses);
      saveStore(STORE_KEYS.checkins, checkins);
      saveStore(STORE_KEYS.journal, journal);
      saveStore(STORE_KEYS.expenses, expenses);
      renderAll();
      alert('Import complete.');
    }catch(err){
      alert('That file could not be read as a D2D backup.');
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});
function mergeById(existing, incoming){
  const map = new Map(existing.map(x => [x.id, x]));
  incoming.forEach(x => map.set(x.id, x));
  return [...map.values()].sort((a,b) => (b.timestamp||b.createdAt||0) - (a.timestamp||a.createdAt||0));
}

/* ================= init ================= */

function renderAll(){
  renderCheckinHistory();
  renderJournal();
  renderExpenses();
  renderRailStreak();
  if(document.getElementById('panel-dashboard').classList.contains('is-active')) renderDashboard();
}
renderAll();
