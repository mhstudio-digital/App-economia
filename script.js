/* ===== SaldoSmart Premium ===== */
'use strict';

const STORE = 'saldosmart_v2';

/* ---- Default data ---- */
const DEFAULT_CATEGORIES = [
  { id: 'comida',      name: 'Comida',       icon: 'tool-kitchen-2', color: '#F59E0B' },
  { id: 'transporte',  name: 'Transporte',   icon: 'car',            color: '#3B82F6' },
  { id: 'estudio',     name: 'Estudio',      icon: 'school',         color: '#8B5CF6' },
  { id: 'ropa',        name: 'Ropa',         icon: 'hanger',         color: '#EC4899' },
  { id: 'salidas',     name: 'Salidas',      icon: 'confetti',       color: '#10B981' },
  { id: 'ahorro',      name: 'Ahorro',       icon: 'piggy-bank',     color: '#C9A96E' },
  { id: 'servicios',   name: 'Servicios',    icon: 'bolt',           color: '#06B6D4' },
  { id: 'salario',     name: 'Salario',      icon: 'briefcase',      color: '#4ADE80' },
  { id: 'otros',       name: 'Otros',        icon: 'dots-circle-horizontal', color: '#94A3B8' },
];

const DEFAULT_ACCOUNTS = [
  { id: 'cash',   name: 'Efectivo', type: 'cash',  balance: 0, icon: 'wallet',        color: '#4ADE80' },
  { id: 'bank',   name: 'Banco',    type: 'bank',  balance: 0, icon: 'building-bank', color: '#3B82F6' },
  { id: 'sinpe',  name: 'Sinpe',    type: 'sinpe', balance: 0, icon: 'device-mobile', color: '#C9A96E' },
  { id: 'card',   name: 'Tarjeta',  type: 'card',  balance: 0, icon: 'credit-card',   color: '#8B5CF6' },
];

const ACCOUNT_TYPE_ICONS = { cash: 'wallet', bank: 'building-bank', sinpe: 'device-mobile', card: 'credit-card' };
const ACCOUNT_TYPE_COLORS = { cash: '#4ADE80', bank: '#3B82F6', sinpe: '#C9A96E', card: '#8B5CF6' };

const COLORS = ['#C9A96E','#4ADE80','#F87171','#3B82F6','#8B5CF6','#EC4899','#F59E0B','#06B6D4','#10B981','#94A3B8'];

/* ---- State ---- */
let state = {
  movements: [],
  accounts: [],
  categories: [],
  budget: 0,
  currency: '₡',
  profileName: 'Usuario',
  theme: 'dark',
  balanceVisible: true,
};

/* ---- Persistence ---- */
function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
    }
  } catch(e) {}
  if (!Array.isArray(state.movements)) state.movements = [];
  if (!Array.isArray(state.accounts) || state.accounts.length === 0) state.accounts = JSON.parse(JSON.stringify(DEFAULT_ACCOUNTS));
  if (!Array.isArray(state.categories) || state.categories.length === 0) state.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
  if (typeof state.budget !== 'number') state.budget = 0;
  if (typeof state.currency !== 'string') state.currency = '₡';
  if (typeof state.profileName !== 'string') state.profileName = 'Usuario';
  if (typeof state.theme !== 'string') state.theme = 'dark';
  if (typeof state.balanceVisible !== 'boolean') state.balanceVisible = true;
}
function save() {
  localStorage.setItem(STORE, JSON.stringify(state));
}

/* ---- Utils ---- */
function money(n) {
  const sym = state.currency || '₡';
  const sign = n < 0 ? '-' : '';
  return sign + sym + Math.abs(n).toLocaleString('es-CR', { maximumFractionDigits: 2 });
}
function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function todayISO() {
  const t = new Date();
  const off = t.getTimezoneOffset() * 60000;
  return new Date(t - off).toISOString().slice(0, 10);
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function getCat(id) {
  return state.categories.find(c => c.id === id) || state.categories.find(c => c.name === id) || { name: id, icon: 'dots-circle-horizontal', color: '#94A3B8' };
}
function getAccount(id) {
  return state.accounts.find(a => a.id === id);
}

/* ---- Greeting ---- */
function updateGreeting() {
  const h = new Date().getHours();
  let greet = h < 12 ? 'Buenos dias' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('greetingTime').textContent = greet;
  document.getElementById('greetingName').textContent = state.profileName;
}

/* ---- Compute ---- */
function computeTotals() {
  let income = 0, expense = 0;
  for (const m of state.movements) {
    if (m.type === 'ingreso') income += m.amount;
    else expense += m.amount;
  }
  const accountBase = state.accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const balance = accountBase + income - expense;
  return { income, expense, balance, accountBase };
}
function computeBudget() {
  const month = todayISO().slice(0, 7);
  let spent = 0;
  for (const m of state.movements) {
    if (m.type === 'gasto' && m.date.slice(0, 7) === month) spent += m.amount;
  }
  return { spent, left: state.budget - spent, pct: state.budget > 0 ? Math.min(100, spent / state.budget * 100) : 0 };
}
function computeWeek(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  const days = Array.from({length: 7}, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const off2 = d.getTimezoneOffset() * 60000;
    return new Date(d - off2).toISOString().slice(0, 10);
  });
  return days;
}

/* ===== RENDER HOME ===== */
function renderHome() {
  const { income, expense, balance } = computeTotals();
  const balEl = document.getElementById('balanceDisplay');
  if (state.balanceVisible) {
    balEl.textContent = money(balance);
    balEl.style.filter = '';
  } else {
    balEl.textContent = money(balance).replace(/[0-9]/g, '•');
    balEl.style.filter = 'blur(6px)';
  }
  const eyeIcon = document.getElementById('eyeIcon');
  eyeIcon.className = state.balanceVisible ? 'ti ti-eye' : 'ti ti-eye-off';

  document.getElementById('homeIncome').textContent = money(income);
  document.getElementById('homeExpense').textContent = money(expense);

  // Budget bar
  if (state.budget > 0) {
    const bd = computeBudget();
    document.getElementById('budgetBarWrap').classList.remove('hidden');
    document.getElementById('budgetBarPct').textContent = Math.round(bd.pct) + '%';
    const fill = document.getElementById('budgetBarFill');
    fill.style.width = bd.pct + '%';
    fill.className = 'progress-fill' + (bd.pct > 80 ? ' bad' : bd.pct > 50 ? ' warn' : '');
  } else {
    document.getElementById('budgetBarWrap').classList.add('hidden');
  }

  renderWeekChart();
  renderHomeMovements();
  renderNotifications(computeTotals(), computeBudget());
}

/* ---- Weekly SVG chart ---- */
function renderWeekChart() {
  const days = computeWeek(0);
  const today = todayISO();
  const dayNames = ['Lu','Ma','Mi','Ju','Vi','Sa','Do'];

  const totals = days.map(d => {
    let sum = 0;
    for (const m of state.movements) {
      if (m.date === d && m.type === 'gasto') sum += m.amount;
    }
    return sum;
  });

  const weekTotal = totals.reduce((a, b) => a + b, 0);
  document.getElementById('weekTotal').textContent = money(weekTotal);

  const svg = document.getElementById('weekSvg');
  const max = Math.max(...totals, 1);
  const W = 320, H = 80, PAD = 20;
  const pts = totals.map((v, i) => {
    const x = PAD + (i / 6) * (W - PAD * 2);
    const y = PAD + (1 - v / max) * (H - PAD * 2);
    return [x, y];
  });

  // area path
  let area = `M ${pts[0][0]} ${H}`;
  pts.forEach(p => { area += ` L ${p[0]} ${p[1]}`; });
  area += ` L ${pts[pts.length-1][0]} ${H} Z`;

  // line path
  let line = `M ${pts[0][0]} ${pts[0][1]}`;
  pts.slice(1).forEach(p => { line += ` L ${p[0]} ${p[1]}`; });

  svg.innerHTML = `
    <defs>
      <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#C9A96E" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#C9A96E" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#wg)"/>
    <path d="${line}" fill="none" stroke="#C9A96E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${days[i] === today ? 4 : 2.5}" fill="${days[i] === today ? '#C9A96E' : '#8B7452'}" />`).join('')}
  `;

  const wd = document.getElementById('weekDays');
  wd.innerHTML = days.map((d, i) => `<span class="week-day${d === today ? ' today' : ''}">${dayNames[i]}</span>`).join('');
}

/* ---- Home movements ---- */
function renderHomeMovements() {
  const list = [...state.movements]
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id))
    .slice(0, 5);

  const ul = document.getElementById('homeMovements');
  const empty = document.getElementById('homeEmpty');

  ul.innerHTML = '';
  if (list.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  for (const m of list) {
    ul.appendChild(buildMovItem(m));
  }
}

/* ---- Build movement item ---- */
function buildMovItem(m) {
  const cat = getCat(m.category);
  const li = document.createElement('li');
  li.className = 'movement-item';
  li.innerHTML = `
    <div class="mov-icon ${m.type}" style="background:${m.type==='ingreso' ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)'}; color:${m.type==='ingreso' ? '#4ADE80' : '#F87171'}">
      <i class="ti ti-${escHtml(cat.icon)}"></i>
    </div>
    <div class="mov-body">
      <div class="mov-title">${escHtml(m.detail || cat.name)}</div>
      <div class="mov-sub">
        <span class="mov-cat-chip">${escHtml(cat.name)}</span>
        <span>${fmtDate(m.date)}</span>
      </div>
    </div>
    <div class="mov-amount ${m.type}">${m.type === 'ingreso' ? '+' : '−'}${money(m.amount)}</div>
  `;
  li.addEventListener('click', () => openMovDetail(m));
  return li;
}

/* ===== NOTIFICATIONS ===== */
function renderNotifications(totals, budget) {
  const list = document.getElementById('notifList');
  const dot = document.getElementById('notifDot');
  const alerts = [];

  if (budget.pct > 100) {
    alerts.push({ msg: `Presupuesto superado — gastaste ${Math.round(budget.pct)}%`, bad: true });
  } else if (budget.pct > 80) {
    alerts.push({ msg: `Alcanzaste el ${Math.round(budget.pct)}% de tu presupuesto`, bad: false });
  }
  if (totals.balance < 0) {
    alerts.push({ msg: `Saldo negativo: ${money(totals.balance)}`, bad: true });
  }

  if (alerts.length === 0) {
    list.innerHTML = '<div class="notif-empty">Sin alertas activas</div>';
    dot.classList.add('hidden');
  } else {
    list.innerHTML = alerts.map(a => `<div class="notif-item${a.bad ? ' bad' : ''}">${escHtml(a.msg)}</div>`).join('');
    dot.classList.remove('hidden');
  }
}

/* ===== RENDER INSIGHTS ===== */
function renderInsights() {
  renderCatBars();
  renderWeekCompare();
  renderMonthlyChart();
}

function renderCatBars() {
  const container = document.getElementById('catBars');
  const expByCategory = {};
  let total = 0;
  for (const m of state.movements) {
    if (m.type !== 'gasto') continue;
    expByCategory[m.category] = (expByCategory[m.category] || 0) + m.amount;
    total += m.amount;
  }
  if (total === 0) {
    container.innerHTML = '<div class="empty-state"><i class="ti ti-chart-pie"></i><p>Sin datos aún</p></div>';
    return;
  }
  const sorted = Object.entries(expByCategory).sort((a, b) => b[1] - a[1]);
  container.innerHTML = sorted.map(([catId, amt]) => {
    const cat = getCat(catId);
    const pct = Math.round((amt / total) * 100);
    return `
      <div class="cat-bar-item">
        <div class="cat-bar-header">
          <span class="cat-bar-label" style="color:${cat.color}">
            <i class="ti ti-${escHtml(cat.icon)}"></i> ${escHtml(cat.name)}
          </span>
          <div style="display:flex;gap:10px;align-items:center">
            <span class="cat-bar-pct">${pct}%</span>
            <span class="cat-bar-amount" style="color:${cat.color}">${money(amt)}</span>
          </div>
        </div>
        <div class="cat-progress">
          <div class="cat-fill" style="width:${pct}%;background:${cat.color}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderWeekCompare() {
  const thisWeek = computeWeek(0);
  const lastWeek = computeWeek(-1);
  const sum = days => days.reduce((acc, d) => {
    return acc + state.movements.filter(m => m.date === d && m.type === 'gasto').reduce((s, m) => s + m.amount, 0);
  }, 0);
  const tw = sum(thisWeek);
  const lw = sum(lastWeek);
  const diff = tw - lw;
  document.getElementById('cmpThisWeek').textContent = money(tw);
  document.getElementById('cmpLastWeek').textContent = money(lw);
  const diffEl = document.getElementById('cmpDiff');
  diffEl.textContent = (diff >= 0 ? '+' : '') + money(diff);
  diffEl.className = 'compare-value ' + (diff > 0 ? 'negative' : diff < 0 ? 'positive' : '');
}

function renderMonthlyChart() {
  const svg = document.getElementById('monthlySvg');
  const byMonth = {};
  for (const m of state.movements) {
    if (m.type !== 'gasto') continue;
    const key = m.date.slice(0, 7);
    byMonth[key] = (byMonth[key] || 0) + m.amount;
  }
  const keys = Object.keys(byMonth).sort().slice(-6);
  if (keys.length === 0) {
    svg.innerHTML = '<text x="50%" y="80" text-anchor="middle" font-size="14" fill="#5C5850">Sin datos</text>';
    return;
  }
  const vals = keys.map(k => byMonth[k]);
  const max = Math.max(...vals, 1);
  const W = 320, H = 160, PAD_L = 10, PAD_R = 10, PAD_T = 16, PAD_B = 28;
  const barW = Math.floor((W - PAD_L - PAD_R) / keys.length * 0.55);
  const gap = (W - PAD_L - PAD_R - barW * keys.length) / (keys.length + 1);
  const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  const bars = keys.map((k, i) => {
    const x = PAD_L + gap + i * (barW + gap);
    const barH = Math.max(4, ((vals[i] / max) * (H - PAD_T - PAD_B)));
    const y = H - PAD_B - barH;
    const [, mn] = k.split('-');
    const label = MONTHS[+mn - 1];
    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="#C9A96E" opacity="0.85"/>
      <text x="${x + barW/2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#9C9589" font-family="DM Sans">${label}</text>
    `;
  }).join('');

  svg.innerHTML = bars;
}

/* ===== RENDER ACCOUNTS ===== */
function renderAccounts() {
  const ul = document.getElementById('accountList');
  ul.innerHTML = '';
  for (const a of state.accounts) {
    const li = document.createElement('li');
    li.className = 'account-item';
    li.innerHTML = `
      <div class="account-icon" style="background:${a.color}22;color:${a.color}">
        <i class="ti ti-${escHtml(a.icon || ACCOUNT_TYPE_ICONS[a.type] || 'wallet')}"></i>
      </div>
      <div class="account-info">
        <div class="account-name">${escHtml(a.name)}</div>
        <div class="account-type-label">${escHtml(typeLabel(a.type))}</div>
      </div>
      <div class="account-balance">${money(accountBalance(a.id))}</div>
    `;
    li.querySelector('.account-balance').addEventListener('click', (e) => { e.stopPropagation(); openAccountModal(a); });
    li.addEventListener('click', () => showAccountMovements(a));
    ul.appendChild(li);
  }
  const net = state.accounts.reduce((s, a) => s + accountBalance(a.id), 0);
  document.getElementById('accountNetTotal').textContent = money(net);
}

function accountBalance(accountId) {
  const acct = state.accounts.find(a => a.id === accountId);
  const base = acct ? (acct.balance || 0) : 0;
  let income = 0, expense = 0;
  for (const m of state.movements) {
    if (m.account !== accountId) continue;
    if (m.type === 'ingreso') income += m.amount;
    else expense += m.amount;
  }
  return base + income - expense;
}

function typeLabel(t) {
  return { cash: 'Efectivo', bank: 'Banco', sinpe: 'Sinpe', card: 'Tarjeta' }[t] || t;
}

function showAccountMovements(account) {
  const panel = document.getElementById('accountMovsPanel');
  panel.classList.remove('hidden');
  document.getElementById('accountMovsTitle').textContent = account.name;
  const ul = document.getElementById('accountMovsList');
  const empty = document.getElementById('accountMovsEmpty');
  const movs = state.movements.filter(m => m.account === account.id)
    .sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  ul.innerHTML = '';
  if (movs.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  movs.forEach(m => ul.appendChild(buildMovItem(m)));
}

/* ===== RENDER PROFILE ===== */
function renderProfile() {
  document.getElementById('profileName').value = state.profileName;
  document.getElementById('avatarDisplay').textContent = (state.profileName[0] || 'U').toUpperCase();
  document.getElementById('profileBudget').value = state.budget || '';
  document.getElementById('currencySelect').value = state.currency;
  document.getElementById('currencySymbol').textContent = state.currency;
  renderCategoryList();
}

function renderCategoryList() {
  const ul = document.getElementById('categoryList');
  ul.innerHTML = '';
  for (const cat of state.categories) {
    const li = document.createElement('li');
    li.className = 'cat-item';
    li.innerHTML = `
      <div class="cat-item-icon" style="background:${cat.color}22;color:${cat.color}">
        <i class="ti ti-${escHtml(cat.icon)}"></i>
      </div>
      <span class="cat-item-name">${escHtml(cat.name)}</span>
      <button class="cat-item-edit" title="Editar"><i class="ti ti-pencil"></i></button>
    `;
    li.querySelector('.cat-item-edit').addEventListener('click', () => openCatModal(cat));
    ul.appendChild(li);
  }
}

/* ===== NAVIGATION ===== */
let currentPage = 'home';

function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('page-' + page).classList.add('active');
  currentPage = page;
  if (page === 'home') renderHome();
  else if (page === 'insights') renderInsights();
  else if (page === 'accounts') renderAccounts();
  else if (page === 'profile') renderProfile();
}

/* ===== MODAL HELPERS ===== */
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function confirm(title, body, cb) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  openModal('modalConfirm');
  const ok = document.getElementById('btnConfirmOk');
  const cancel = document.getElementById('btnConfirmCancel');
  const cleanup = () => { closeModal('modalConfirm'); ok.replaceWith(ok.cloneNode(true)); cancel.replaceWith(cancel.cloneNode(true)); };
  document.getElementById('btnConfirmOk').addEventListener('click', () => { cleanup(); cb(); }, { once: true });
  document.getElementById('btnConfirmCancel').addEventListener('click', cleanup, { once: true });
}

/* ===== MOVEMENT MODAL ===== */
let _movType = 'ingreso';

function openMovementModal(type = 'ingreso') {
  _movType = type;
  document.querySelectorAll('#movTypeSeg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  document.getElementById('movAmount').value = '';
  document.getElementById('amountPreview').textContent = '0';
  document.getElementById('movDetail').value = '';
  document.getElementById('movDate').value = todayISO();
  document.getElementById('currencyPreview').textContent = state.currency;
  document.getElementById('currSymMov').textContent = state.currency;
  populateCategorySelect();
  populateAccountSelect();
  openModal('modalMovement');
}

function populateCategorySelect() {
  const sel = document.getElementById('movCategory');
  sel.innerHTML = state.categories.map(c => `<option value="${escHtml(c.id)}">${escHtml(c.name)}</option>`).join('');
}

function populateAccountSelect() {
  const sel = document.getElementById('movAccount');
  sel.innerHTML = state.accounts.map(a => `<option value="${escHtml(a.id)}">${escHtml(a.name)}</option>`).join('');
}

function saveMovement() {
  const amtRaw = parseFloat(document.getElementById('movAmount').value);
  if (!amtRaw || amtRaw <= 0) {
    document.getElementById('movAmount').style.borderColor = 'var(--expense)';
    setTimeout(() => { document.getElementById('movAmount').style.borderColor = ''; }, 1200);
    return;
  }
  state.movements.push({
    id: uid(),
    type: _movType,
    amount: amtRaw,
    category: document.getElementById('movCategory').value,
    account: document.getElementById('movAccount').value,
    detail: document.getElementById('movDetail').value.trim(),
    date: document.getElementById('movDate').value || todayISO(),
  });
  save();
  closeModal('modalMovement');
  if (currentPage === 'home') renderHome();
  else if (currentPage === 'insights') renderInsights();
  else if (currentPage === 'accounts') renderAccounts();
}

/* ===== MOV DETAIL MODAL ===== */
let _detailMovId = null;

function openMovDetail(m) {
  _detailMovId = m.id;
  const cat = getCat(m.category);
  const acct = getAccount(m.account);
  document.getElementById('movDetailBody').innerHTML = `
    <div class="mov-detail-amount ${m.type}">${m.type === 'ingreso' ? '+' : '−'}${money(m.amount)}</div>
    <div class="mov-detail-rows">
      <div class="mov-detail-row"><span>Tipo</span><span>${m.type === 'ingreso' ? 'Ingreso' : 'Gasto'}</span></div>
      <div class="mov-detail-row"><span>Categoría</span><span>${escHtml(cat.name)}</span></div>
      <div class="mov-detail-row"><span>Cuenta</span><span>${acct ? escHtml(acct.name) : 'N/A'}</span></div>
      ${m.detail ? `<div class="mov-detail-row"><span>Detalle</span><span>${escHtml(m.detail)}</span></div>` : ''}
      <div class="mov-detail-row"><span>Fecha</span><span>${fmtDate(m.date)}</span></div>
    </div>
  `;
  openModal('modalMovDetail');
}

function deleteCurrentMov() {
  if (!_detailMovId) return;
  state.movements = state.movements.filter(m => m.id !== _detailMovId);
  save();
  closeModal('modalMovDetail');
  if (currentPage === 'home') renderHome();
  else if (currentPage === 'insights') renderInsights();
  else if (currentPage === 'accounts') renderAccounts();
}

/* ===== ACCOUNT MODAL ===== */
let _editAccountId = null;

function openAccountModal(account = null) {
  _editAccountId = account ? account.id : null;
  document.getElementById('accountModalTitle').textContent = account ? 'Editar cuenta' : 'Nueva cuenta';
  document.getElementById('accountName').value = account ? account.name : '';
  document.getElementById('accountType').value = account ? account.type : 'cash';
  document.getElementById('accountBalance').value = account ? (account.balance || 0) : '';
  document.getElementById('currSymAcct').textContent = state.currency;
  const delBtn = document.getElementById('btnDeleteAccount');
  if (account && !['cash','bank','sinpe','card'].includes(account.id)) {
    delBtn.classList.remove('hidden');
  } else {
    delBtn.classList.add('hidden');
  }
  openModal('modalAccount');
}

function saveAccount() {
  const name = document.getElementById('accountName').value.trim();
  if (!name) return;
  const type = document.getElementById('accountType').value;
  const bal = parseFloat(document.getElementById('accountBalance').value) || 0;
  if (_editAccountId) {
    const acct = state.accounts.find(a => a.id === _editAccountId);
    if (acct) {
      acct.name = name;
      acct.type = type;
      acct.balance = bal;
      acct.icon = ACCOUNT_TYPE_ICONS[type] || 'wallet';
      acct.color = ACCOUNT_TYPE_COLORS[type] || '#C9A96E';
    }
  } else {
    state.accounts.push({
      id: uid(),
      name, type, balance: bal,
      icon: ACCOUNT_TYPE_ICONS[type] || 'wallet',
      color: ACCOUNT_TYPE_COLORS[type] || '#C9A96E',
    });
  }
  save();
  closeModal('modalAccount');
  renderAccounts();
}

function deleteAccount() {
  confirm('Eliminar cuenta', '¿Seguro que deseas eliminar esta cuenta? Los movimientos asociados no se borrarán.', () => {
    state.accounts = state.accounts.filter(a => a.id !== _editAccountId);
    save();
    closeModal('modalAccount');
    renderAccounts();
  });
}

/* ===== CATEGORY MODAL ===== */
let _editCatId = null;
let _selectedColor = COLORS[0];

function openCatModal(cat = null) {
  _editCatId = cat ? cat.id : null;
  _selectedColor = cat ? cat.color : COLORS[0];
  document.getElementById('catModalTitle').textContent = cat ? 'Editar categoría' : 'Nueva categoría';
  document.getElementById('catName').value = cat ? cat.name : '';
  document.getElementById('catIcon').value = cat ? cat.icon : '';
  buildColorPicker();
  const delBtn = document.getElementById('btnDeleteCategory');
  if (cat && !DEFAULT_CATEGORIES.find(d => d.id === cat.id)) {
    delBtn.classList.remove('hidden');
  } else {
    delBtn.classList.add('hidden');
  }
  openModal('modalCategory');
}

function buildColorPicker() {
  const picker = document.getElementById('colorPicker');
  picker.innerHTML = COLORS.map(c => `
    <div class="color-dot${c === _selectedColor ? ' selected' : ''}" style="background:${c}" data-color="${c}"></div>
  `).join('');
  picker.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      _selectedColor = dot.dataset.color;
      picker.querySelectorAll('.color-dot').forEach(d => d.classList.toggle('selected', d === dot));
    });
  });
}

function saveCategory() {
  const name = document.getElementById('catName').value.trim();
  if (!name) return;
  const icon = document.getElementById('catIcon').value.trim() || 'tag';
  if (_editCatId) {
    const cat = state.categories.find(c => c.id === _editCatId);
    if (cat) { cat.name = name; cat.icon = icon; cat.color = _selectedColor; }
  } else {
    state.categories.push({ id: uid(), name, icon, color: _selectedColor });
  }
  save();
  closeModal('modalCategory');
  renderCategoryList();
  if (currentPage === 'home') { populateCategorySelect && null; }
}

function deleteCategory() {
  confirm('Eliminar categoría', '¿Eliminar esta categoría? Los movimientos con esta categoría quedarán sin categoría definida.', () => {
    state.categories = state.categories.filter(c => c.id !== _editCatId);
    save();
    closeModal('modalCategory');
    renderCategoryList();
  });
}

/* ===== EXPORTS ===== */
function exportCSV() {
  if (state.movements.length === 0) { alert('No hay movimientos para exportar.'); return; }
  const rows = [['Tipo','Monto','Categoria','Cuenta','Detalle','Fecha']];
  for (const m of [...state.movements].sort((a, b) => a.date.localeCompare(b.date))) {
    const acct = getAccount(m.account);
    rows.push([m.type, m.amount, m.category, acct ? acct.name : '', `"${(m.detail||'').replace(/"/g,'""')}"`, m.date]);
  }
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `saldosmart_${todayISO()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportPDF() {
  if (state.movements.length === 0) { alert('No hay movimientos para exportar.'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { income, expense, balance } = computeTotals();
  const now = todayISO();

  doc.setFillColor(20, 18, 16);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(201, 169, 110);
  doc.rect(0, 28, 210, 2, 'F');
  doc.setTextColor(201, 169, 110);
  doc.setFontSize(22); doc.setFont('helvetica', 'bold');
  doc.text('SaldoSmart', 14, 19);
  doc.setTextColor(180, 160, 120); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
  doc.text('Reporte generado el ' + fmtDate(now), 14, 26);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('Resumen financiero', 14, 46);

  doc.autoTable({
    body: [
      ['Saldo actual', money(balance)],
      ['Total ingresos', money(income)],
      ['Total gastos', money(expense)],
      ['Movimientos totales', String(state.movements.length)],
    ],
    startY: 52, theme: 'plain',
    styles: { fontSize: 11 },
    columnStyles: { 0: { fontStyle: 'bold', textColor: [80, 80, 100], cellWidth: 80 }, 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  const tY = doc.lastAutoTable.finalY + 16;
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 30);
  doc.text('Historial de movimientos', 14, tY);

  doc.autoTable({
    head: [['Tipo','Monto','Categoría','Detalle','Fecha']],
    body: [...state.movements].sort((a, b) => a.date.localeCompare(b.date)).map(m => {
      const cat = getCat(m.category);
      return [m.type === 'ingreso' ? 'Ingreso' : 'Gasto', money(m.amount), cat.name, (m.detail||'').slice(0,35), fmtDate(m.date)];
    }),
    startY: tY + 6, theme: 'grid',
    headStyles: { fillColor: [20, 18, 16], textColor: [201, 169, 110], fontStyle: 'bold', fontSize: 10 },
    alternateRowStyles: { fillColor: [248, 246, 243] },
    styles: { fontSize: 9.5 },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } },
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === 0) {
        data.cell.styles.textColor = data.row.raw[0] === 'Ingreso' ? [10, 120, 80] : [200, 50, 55];
      }
    },
    margin: { left: 14, right: 14 },
  });

  doc.save('saldosmart_' + now + '.pdf');
}

/* ===== THEME ===== */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeIcon').className = theme === 'dark' ? 'ti ti-moon' : 'ti ti-sun';
}

/* ===== INIT EVENTS ===== */
function initEvents() {
  // Nav
  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  // Center + button
  document.getElementById('btnAddMovement').addEventListener('click', () => openMovementModal('gasto'));

  // Quick actions
  document.getElementById('qaIngreso').addEventListener('click', () => openMovementModal('ingreso'));
  document.getElementById('qaGasto').addEventListener('click', () => openMovementModal('gasto'));
  document.getElementById('qaInsights').addEventListener('click', () => navigate('insights'));
  document.getElementById('qaExport').addEventListener('click', () => openModal('modalExport'));

  // Notifications
  document.getElementById('btnNotif').addEventListener('click', () => {
    document.getElementById('notifPanel').classList.toggle('hidden');
  });
  document.getElementById('btnNotifClose').addEventListener('click', () => {
    document.getElementById('notifPanel').classList.add('hidden');
  });

  // Balance toggle
  document.getElementById('btnToggleBalance').addEventListener('click', () => {
    state.balanceVisible = !state.balanceVisible;
    save();
    renderHome();
  });

  // Ver todos movimientos
  document.getElementById('btnVerTodos').addEventListener('click', () => {
    navigate('accounts');
  });

  // Movement modal
  document.getElementById('btnCloseMovement').addEventListener('click', () => closeModal('modalMovement'));
  document.getElementById('modalMovement').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modalMovement'); });
  document.getElementById('movTypeSeg').addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    _movType = btn.dataset.type;
    document.querySelectorAll('#movTypeSeg .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
  });
  document.getElementById('movAmount').addEventListener('input', e => {
    const v = parseFloat(e.target.value) || 0;
    document.getElementById('amountPreview').textContent = v.toLocaleString('es-CR', { maximumFractionDigits: 2 });
  });
  document.getElementById('btnSaveMovement').addEventListener('click', saveMovement);

  // Mov detail modal
  document.getElementById('btnCloseMovDetail').addEventListener('click', () => closeModal('modalMovDetail'));
  document.getElementById('modalMovDetail').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modalMovDetail'); });
  document.getElementById('btnDeleteMovDetail').addEventListener('click', () => {
    confirm('Eliminar movimiento', '¿Seguro que deseas eliminar este movimiento?', deleteCurrentMov);
  });

  // Account modal
  document.getElementById('btnAddAccount').addEventListener('click', () => openAccountModal());
  document.getElementById('btnCloseAccount').addEventListener('click', () => closeModal('modalAccount'));
  document.getElementById('modalAccount').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modalAccount'); });
  document.getElementById('btnSaveAccount').addEventListener('click', saveAccount);
  document.getElementById('btnDeleteAccount').addEventListener('click', deleteAccount);
  document.getElementById('btnCloseAcctMovs').addEventListener('click', () => {
    document.getElementById('accountMovsPanel').classList.add('hidden');
  });

  // Category modal
  document.getElementById('btnAddCategory').addEventListener('click', () => openCatModal());
  document.getElementById('btnCloseCat').addEventListener('click', () => closeModal('modalCategory'));
  document.getElementById('modalCategory').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modalCategory'); });
  document.getElementById('btnSaveCategory').addEventListener('click', saveCategory);
  document.getElementById('btnDeleteCategory').addEventListener('click', deleteCategory);

  // Export modal
  document.getElementById('btnCloseExport').addEventListener('click', () => closeModal('modalExport'));
  document.getElementById('modalExport').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal('modalExport'); });
  document.getElementById('btnDlCSV').addEventListener('click', () => { closeModal('modalExport'); exportCSV(); });
  document.getElementById('btnDlPDF').addEventListener('click', () => { closeModal('modalExport'); exportPDF(); });
  document.getElementById('btnExportCSV').addEventListener('click', exportCSV);
  document.getElementById('btnExportPDF').addEventListener('click', exportPDF);

  // Profile
  document.getElementById('profileName').addEventListener('input', e => {
    state.profileName = e.target.value || 'Usuario';
    document.getElementById('avatarDisplay').textContent = (state.profileName[0] || 'U').toUpperCase();
    document.getElementById('greetingName').textContent = state.profileName;
    save();
  });
  document.getElementById('btnSaveBudget').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('profileBudget').value);
    state.budget = (!isNaN(v) && v > 0) ? v : 0;
    save();
    renderHome();
  });
  document.getElementById('currencySelect').addEventListener('change', e => {
    state.currency = e.target.value;
    document.getElementById('currencySymbol').textContent = state.currency;
    save();
    if (currentPage === 'home') renderHome();
  });
  document.getElementById('themeToggle').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    save();
  });
  document.getElementById('btnClearHistory').addEventListener('click', () => {
    confirm('Borrar historial', 'Se eliminarán todos los movimientos registrados. Esta acción no se puede deshacer.', () => {
      state.movements = [];
      save();
      renderHome();
      if (currentPage === 'insights') renderInsights();
    });
  });

  // Confirm modal overlay
  document.getElementById('modalConfirm').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modalConfirm');
  });
}

/* ===== BOOT ===== */
load();
applyTheme(state.theme);
updateGreeting();
initEvents();
navigate('home');
