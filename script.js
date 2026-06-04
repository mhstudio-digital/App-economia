/* ===== SaldoSmart ===== */
const STORE_KEY = 'saldosmart_v1';

const CAT_ICONS = {
  Comida: '🍽️', Transporte: '🚌', Estudio: '📚', Ropa: '👕',
  Salidas: '🎉', Ahorro: '🐷', Servicios: '💡', Otros: '📦'
};

let state = { initial: 0, movements: [] };

/* ---- Persistencia ---- */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) { state = { initial: 0, movements: [] }; }
  if (!Array.isArray(state.movements)) state.movements = [];
  if (typeof state.initial !== 'number') state.initial = 0;
}
function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

/* ---- Utilidades ---- */
function money(n) {
  const sign = n < 0 ? '-' : '';
  return sign + '₡' + Math.abs(n).toLocaleString('es-CR', { maximumFractionDigits: 2 });
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

/* ---- Elementos ---- */
const $ = id => document.getElementById(id);
const el = {
  balance: $('balance'), totalIncome: $('totalIncome'), totalExpense: $('totalExpense'),
  count: $('count'), progressFill: $('progressFill'), progressText: $('progressText'),
  alert: $('alertBox'), movements: $('movements'), empty: $('empty'),
  amount: $('amount'), category: $('category'), detail: $('detail'), date: $('date'),
  initial: $('initialBalance'),
  filterType: $('filterType'), filterCategory: $('filterCategory')
};

let currentType = 'ingreso';

/* ---- Cálculos + render ---- */
function compute() {
  let income = 0, expense = 0;
  for (const m of state.movements) {
    if (m.type === 'ingreso') income += m.amount;
    else expense += m.amount;
  }
  const available = state.initial + income;       // dinero total disponible
  const balance = available - expense;            // saldo actual
  const pct = available > 0 ? Math.min(100, (expense / available) * 100) : 0;
  return { income, expense, available, balance, pct };
}

function render() {
  const c = compute();

  el.balance.textContent = money(c.balance);
  el.totalIncome.textContent = money(c.income);
  el.totalExpense.textContent = money(c.expense);
  el.count.textContent = state.movements.length;

  // Barra de progreso
  const pct = Math.round(c.pct);
  el.progressFill.style.width = pct + '%';
  el.progressFill.classList.remove('warn', 'bad');
  if (c.pct > 80) el.progressFill.classList.add('bad');
  else if (c.pct > 50) el.progressFill.classList.add('warn');
  el.progressText.textContent = pct + '% gastado';

  renderAlert(c);
  renderList();
  save();
}

function renderAlert(c) {
  const box = el.alert;
  box.className = 'alert';
  if (c.available <= 0 && state.movements.length === 0) {
    box.classList.add('hidden'); return;
  }
  if (c.pct > 80) {
    box.classList.add('bad');
    box.textContent = `Cuidado: gastaste el ${Math.round(c.pct)}% de tu dinero. Tu saldo es de ${money(c.balance)}.`;
  } else if (c.pct > 50) {
    box.classList.add('warn');
    box.textContent = `Atención: ya gastaste el ${Math.round(c.pct)}% de tu dinero. Controla tus gastos.`;
  } else if (c.balance > 0) {
    box.classList.add('good');
    box.textContent = `¡Bien! Tu saldo es positivo: ${money(c.balance)}. Vas por buen camino.`;
  } else {
    box.classList.add('hidden');
  }
}

function renderList() {
  const ft = el.filterType.value;
  const fc = el.filterCategory.value;

  const list = state.movements
    .filter(m => ft === 'todos' || m.type === ft)
    .filter(m => fc === 'todas' || m.category === fc)
    .slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));

  el.movements.innerHTML = '';
  if (list.length === 0) { el.empty.classList.remove('hidden'); return; }
  el.empty.classList.add('hidden');

  for (const m of list) {
    const li = document.createElement('li');
    li.className = 'movement';
    li.innerHTML = `
      <div class="mv-icon ${m.type}">${CAT_ICONS[m.category] || '📦'}</div>
      <div class="mv-body">
        <div class="mv-detail">${escapeHtml(m.detail || m.category)}</div>
        <div class="mv-meta">
          <span class="mv-cat">${m.category}</span>
          <span>${fmtDate(m.date)}</span>
        </div>
      </div>
      <div class="mv-amount ${m.type}">${m.type === 'ingreso' ? '+' : '−'}${money(m.amount)}</div>
      <button class="mv-del" title="Eliminar" data-id="${m.id}">
        <svg viewBox="0 0 24 24" width="15" height="15"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>`;
    li.querySelector('.mv-del').addEventListener('click', () => removeMovement(m.id));
    el.movements.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---- Acciones ---- */
function addMovement() {
  const amount = parseFloat(el.amount.value);
  if (!amount || amount <= 0) { flashInvalid(el.amount); return; }

  state.movements.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type: currentType,
    amount: amount,
    category: el.category.value,
    detail: el.detail.value.trim(),
    date: el.date.value || todayISO()
  });
  clearForm();
  render();
}

function removeMovement(id) {
  state.movements = state.movements.filter(m => m.id !== id);
  render();
}

function setInitial() {
  const v = parseFloat(el.initial.value);
  state.initial = (!isNaN(v) && v >= 0) ? v : 0;
  render();
}

function clearForm() {
  el.amount.value = '';
  el.detail.value = '';
  el.date.value = todayISO();
  el.category.value = 'Comida';
}

function resetAll() {
  if (!confirm('¿Seguro que quieres reiniciar todo? Se borrarán el saldo inicial y todos los movimientos.')) return;
  state = { initial: 0, movements: [] };
  el.initial.value = '';
  clearForm();
  el.filterType.value = 'todos';
  el.filterCategory.value = 'todas';
  render();
}

function exportCSV() {
  if (state.movements.length === 0) { alert('No hay movimientos para exportar.'); return; }
  const headers = ['Tipo', 'Monto', 'Categoria', 'Detalle', 'Fecha'];
  const rows = state.movements
    .slice().sort((a, b) => a.date.localeCompare(b.date))
    .map(m => [m.type, m.amount, m.category, `"${(m.detail || '').replace(/"/g, '""')}"`, m.date]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saldosmart_${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function flashInvalid(node) {
  node.style.borderColor = 'var(--expense)';
  node.focus();
  setTimeout(() => { node.style.borderColor = ''; }, 1200);
}

/* ---- Eventos ---- */
document.getElementById('typeSeg').addEventListener('click', e => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  currentType = btn.dataset.type;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
});

$('btnAdd').addEventListener('click', addMovement);
$('btnClear').addEventListener('click', clearForm);
$('btnReset').addEventListener('click', resetAll);
$('btnExport').addEventListener('click', exportCSV);
$('btnSetInitial').addEventListener('click', setInitial);
el.filterType.addEventListener('change', renderList);
el.filterCategory.addEventListener('change', renderList);

[el.amount, el.detail].forEach(node =>
  node.addEventListener('keydown', e => { if (e.key === 'Enter') addMovement(); })
);
el.initial.addEventListener('keydown', e => { if (e.key === 'Enter') setInitial(); });

/* ---- Init ---- */
load();
el.date.value = todayISO();
if (state.initial) el.initial.value = state.initial;
render();
