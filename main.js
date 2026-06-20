const COLORS = [
  '#c47848', '#a86040', '#c49840', '#8a6ab8',
  '#7a9e6a', '#6a9ab8', '#b87060', '#9ab870',
  '#c4a840', '#6a8ab8', '#b89060', '#78a888',
];

// Copper-toned colors reserved for account slices in the donut
const ACCT_COLORS = [
  'rgba(196,120,72,.75)',
  'rgba(168,96,64,.75)',
  'rgba(196,152,64,.75)',
  'rgba(180,110,56,.75)',
  'rgba(210,140,80,.75)',
];

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(20,12,5,.94)',
  borderColor: 'rgba(190,135,70,.2)',
  borderWidth: 1,
  titleColor: '#ddd0bc',
  bodyColor: '#9e8464',
  padding: 12,
  cornerRadius: 10,
  displayColors: true,
};

// ── State ────────────────────────────────────────────────────────────────────

let expenses   = [];
let accounts   = [];
let listView   = 'monthly';
let chartView  = 'monthly';
let income     = {};
let donutChart = null;
let barChart   = null;

Chart.defaults.color       = '#70583e';
Chart.defaults.font.family = '"Inter", system-ui, sans-serif';

// ── Persistence ──────────────────────────────────────────────────────────────

function persist() {
  localStorage.setItem('flow_exp',      JSON.stringify(expenses));
  localStorage.setItem('flow_accounts', JSON.stringify(accounts));
  localStorage.setItem('flow_wage',     g('wage').value    || '');
  localStorage.setItem('flow_hrs',      g('hours').value   || '');
  localStorage.setItem('flow_tax',      g('taxRate').value || '22');
}

function restore() {
  const wage = localStorage.getItem('flow_wage');
  const hrs  = localStorage.getItem('flow_hrs');
  const tax  = localStorage.getItem('flow_tax');
  const exp  = localStorage.getItem('flow_exp');
  const acct = localStorage.getItem('flow_accounts');

  if (wage) g('wage').value    = wage;
  if (hrs)  g('hours').value   = hrs;
  g('taxRate').value = tax !== null ? tax : 22;
  if (exp)  { try { expenses = JSON.parse(exp);  } catch (_) {} }
  if (acct) { try { accounts = JSON.parse(acct); } catch (_) {} }
}

// ── Utilities ────────────────────────────────────────────────────────────────

const g   = id => document.getElementById(id);
const fmt = n  => '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s  => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function setText(id, value) {
  g(id).textContent = value;
}

function setColored(id, value, color) {
  const el = g(id);
  el.textContent = value;
  el.style.color = color;
}

function setProgressBar(barId, pctId, pct, color) {
  const bar = g(barId);
  bar.style.width = pct + '%';
  bar.style.background = pct > 90 ? 'var(--red)'
    : pct > 70 ? 'var(--amber)'
    : 'linear-gradient(90deg, var(--accent), var(--accent2))';

  const label = g(pctId);
  label.textContent = pct.toFixed(1) + '%';
  label.style.color = color;
}

function flashInvalid(id) {
  const el = g(id);
  el.style.borderColor = 'rgba(184,88,72,.7)';
  el.style.boxShadow   = '0 0 0 3px rgba(184,88,72,.14)';
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 1400);
}

// ── Income ───────────────────────────────────────────────────────────────────

function recalculate() {
  const wage    = parseFloat(g('wage').value)    || 0;
  const hours   = parseFloat(g('hours').value)   || 0;
  const taxRate = parseFloat(g('taxRate').value) / 100 || 0.22;

  const regularHours  = Math.min(hours, 40);
  const overtimeHours = Math.max(hours - 40, 0);
  const weeklyGross   = regularHours * wage + overtimeHours * wage * 1.5;
  const annualGross   = weeklyGross * 52;
  const annualTax     = annualGross * taxRate;
  const annualNet     = annualGross - annualTax;
  const weeklyNet     = annualNet / 52;
  const monthlyGross  = annualGross / 12;
  const monthlyNet    = annualNet   / 12;
  const monthlyTax    = annualTax   / 12;

  income = { weeklyGross, weeklyNet, monthlyGross, monthlyNet, annualGross, annualNet, annualTax, monthlyTax };

  const otNote = g('otNote');
  if (overtimeHours > 0) {
    otNote.style.display = 'block';
    otNote.textContent = `⚡ ${overtimeHours}h overtime @ $${(wage * 1.5).toFixed(2)}/h — adds ${fmt(overtimeHours * wage * 1.5 * 52)} gross/yr`;
  } else {
    otNote.style.display = 'none';
  }

  setText('wGross', fmt(weeklyGross));
  setText('wNet',   fmt(weeklyNet));
  setText('wOT', overtimeHours > 0
    ? `incl. ${overtimeHours}h @ 1.5× OT`
    : hours > 0 ? `${hours}h × $${wage.toFixed(2)}` : '—');
  setText('mNet',  fmt(monthlyNet));
  setText('yNet',  fmt(annualNet));
  setText('mGSub', monthlyGross > 0 ? `${fmt(monthlyGross)} gross` : '—');
  setText('yGSub', annualGross  > 0 ? `${fmt(annualGross)} gross`  : '—');

  persist();
  renderSummary();
  renderAccounts();
  updateCharts();
}

// ── Expenses ─────────────────────────────────────────────────────────────────

function addExpense() {
  const name   = g('expName').value.trim();
  const amount = parseFloat(g('expAmt').value);
  const freq   = g('expFreq').value;

  if (!name || isNaN(amount) || amount <= 0) {
    flashInvalid('expName');
    flashInvalid('expAmt');
    return;
  }

  expenses.push({ id: Date.now(), name, amount, freq });
  g('expName').value = '';
  g('expAmt').value  = '';

  persist();
  renderExpenses();
  renderSummary();
  updateCharts();
}

function removeExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  persist();
  renderExpenses();
  renderSummary();
  updateCharts();
}

function setView(v) {
  listView = v;
  g('vM').classList.toggle('active', v === 'monthly');
  g('vY').classList.toggle('active', v === 'yearly');
  renderExpenses();
}

function renderExpenses() {
  const list = g('eList');
  g('eCount').textContent = `${expenses.length} item${expenses.length !== 1 ? 's' : ''}`;

  if (!expenses.length) {
    list.innerHTML = '<div class="empty-msg">No expenses yet — add one on the left.</div>';
    return;
  }

  list.innerHTML = expenses.map((expense, i) => {
    const color     = COLORS[i % COLORS.length];
    const isMonthly = listView === 'monthly';

    const displayAmt = isMonthly
      ? (expense.freq === 'monthly' ? expense.amount : expense.amount / 12)
      : (expense.freq === 'yearly'  ? expense.amount : expense.amount * 12);

    const altAmt = isMonthly
      ? (expense.freq === 'monthly' ? expense.amount * 12 : expense.amount)
      : (expense.freq === 'yearly'  ? expense.amount / 12  : expense.amount);

    const unit    = isMonthly ? 'mo' : 'yr';
    const altUnit = isMonthly ? '/yr' : '/mo';

    return `
      <div class="eitem">
        <span class="edot" style="background:${color}"></span>
        <span class="ename">${esc(expense.name)}</span>
        <span class="ebadge">${expense.freq === 'monthly' ? 'mo' : 'yr'}</span>
        <div class="eamt-wrap">
          <div class="eamt">${fmt(displayAmt)}<span class="eamt-unit">/${unit}</span></div>
          <div class="esub">${fmt(altAmt)}${altUnit}</div>
        </div>
        <button class="btn btn-del" onclick="removeExpense(${expense.id})">✕</button>
      </div>`;
  }).join('');
}

// ── Accounts ─────────────────────────────────────────────────────────────────

function addAccount() {
  const name            = g('acctName').value.trim();
  const startingBalance = parseFloat(g('acctStart').value) || 0;
  const allocationPct   = parseFloat(g('acctPct').value);

  if (!name || isNaN(allocationPct) || allocationPct <= 0) {
    flashInvalid('acctName');
    flashInvalid('acctPct');
    return;
  }

  accounts.push({ id: Date.now(), name, startingBalance, allocationPct });
  g('acctName').value  = '';
  g('acctStart').value = '';
  g('acctPct').value   = '';

  persist();
  renderAccounts();
  renderSummary();
  updateCharts();
}

function removeAccount(id) {
  accounts = accounts.filter(a => a.id !== id);
  persist();
  renderAccounts();
  renderSummary();
  updateCharts();
}

function renderAccounts() {
  const list = g('acctList');
  g('acctCount').textContent = `${accounts.length} account${accounts.length !== 1 ? 's' : ''}`;

  if (!accounts.length) {
    list.innerHTML = '<div class="empty-msg">No accounts yet — add one on the left.</div>';
    return;
  }

  const monthlyNet = income.monthlyNet || 0;

  list.innerHTML = accounts.map((acct, i) => {
    const color        = ACCT_COLORS[i % ACCT_COLORS.length];
    const monthlyAlloc = monthlyNet * acct.allocationPct / 100;
    const balance1yr   = acct.startingBalance + monthlyAlloc * 12;
    const balance5yr   = acct.startingBalance + monthlyAlloc * 60;

    return `
      <div class="acct-item">
        <span class="edot" style="background:${color}"></span>
        <div class="acct-main">
          <div class="acct-name-row">
            <span class="ename">${esc(acct.name)}</span>
            <span class="ebadge">${acct.allocationPct}%</span>
          </div>
          <div class="acct-projections">
            <span class="acct-proj-mo">${fmt(monthlyAlloc)}/mo</span>
            <span class="acct-proj">1yr: <strong>${fmt(balance1yr)}</strong></span>
            <span class="acct-proj">5yr: <strong>${fmt(balance5yr)}</strong></span>
          </div>
        </div>
        <div class="acct-start">starts ${fmt(acct.startingBalance)}</div>
        <button class="btn btn-del" onclick="removeAccount(${acct.id})">✕</button>
      </div>`;
  }).join('');
}

// ── Summary ──────────────────────────────────────────────────────────────────

function renderSummary() {
  const monthlyExpenses    = expenses.reduce((sum, e) =>
    sum + (e.freq === 'monthly' ? e.amount : e.amount / 12), 0);
  const yearlyExpenses     = monthlyExpenses * 12;

  const monthlyAllocations = accounts.reduce((sum, a) =>
    sum + (income.monthlyNet || 0) * a.allocationPct / 100, 0);
  const yearlyAllocations  = monthlyAllocations * 12;

  const monthlySpent     = monthlyExpenses + monthlyAllocations;
  const yearlySpent      = yearlyExpenses  + yearlyAllocations;
  const monthlyRemaining = (income.monthlyNet || 0) - monthlySpent;
  const yearlyRemaining  = (income.annualNet  || 0) - yearlySpent;

  const monthlyPct = income.monthlyNet > 0 ? Math.min(monthlySpent / income.monthlyNet * 100, 100) : 0;
  const yearlyPct  = income.annualNet  > 0 ? Math.min(yearlySpent  / income.annualNet  * 100, 100) : 0;

  const progressColor  = p => p > 90 ? 'var(--red)' : p > 70 ? 'var(--amber)' : 'var(--accent)';
  const remainingColor = v => v >= 0 ? 'var(--green)' : 'var(--red)';

  setColored('smI', fmt(income.monthlyNet       || 0), 'var(--accent)');
  setColored('smT', fmt(income.monthlyTax       || 0), 'var(--red)');
  setColored('smE', fmt(monthlyExpenses),               'var(--red)');
  setColored('smA', fmt(monthlyAllocations),            'var(--amber)');
  setColored('smR', fmt(monthlyRemaining),              remainingColor(monthlyRemaining));

  setColored('syI', fmt(income.annualNet        || 0), 'var(--accent)');
  setColored('syT', fmt(income.annualTax        || 0), 'var(--red)');
  setColored('syE', fmt(yearlyExpenses),                'var(--red)');
  setColored('syA', fmt(yearlyAllocations),             'var(--amber)');
  setColored('syR', fmt(yearlyRemaining),               remainingColor(yearlyRemaining));

  setProgressBar('pmB', 'pmP', monthlyPct, progressColor(monthlyPct));
  setProgressBar('pyB', 'pyP', yearlyPct,  progressColor(yearlyPct));
}

// ── Charts ───────────────────────────────────────────────────────────────────

function updateCharts() {
  updateDonut();
  updateBarChart();
}

function updateDonut() {
  const yearlyExpenses    = expenses.reduce((sum, e) =>
    sum + (e.freq === 'yearly' ? e.amount : e.amount * 12), 0);
  const yearlyAllocations = accounts.reduce((sum, a) =>
    sum + (income.monthlyNet || 0) * a.allocationPct / 100 * 12, 0);

  const annualTax  = income.annualTax || 0;
  const annualNet  = income.annualNet || 0;
  const unallocated = Math.max(annualNet - yearlyExpenses - yearlyAllocations, 0);
  const hasData    = annualTax > 0 || yearlyExpenses > 0 || yearlyAllocations > 0;

  g('donutEmpty').style.display = hasData ? 'none' : 'flex';

  const labels = [
    'Taxes',
    ...expenses.map(e => e.name),
    ...accounts.map(a => a.name),
    unallocated > 0 ? 'Unallocated' : null,
  ].filter(Boolean);

  const data = [
    annualTax,
    ...expenses.map(e => e.freq === 'yearly' ? e.amount : e.amount * 12),
    ...accounts.map(a => (income.monthlyNet || 0) * a.allocationPct / 100 * 12),
    unallocated > 0 ? unallocated : null,
  ].filter(v => v !== null);

  const colors = [
    'rgba(184,88,72,.8)',
    ...expenses.map((_, i) => COLORS[(i + 2) % COLORS.length]),
    ...accounts.map((_, i) => ACCT_COLORS[i % ACCT_COLORS.length]),
    unallocated > 0 ? 'rgba(122,158,106,.75)' : null,
  ].filter(Boolean);

  if (donutChart) {
    donutChart.data.labels = labels;
    donutChart.data.datasets[0].data            = data;
    donutChart.data.datasets[0].backgroundColor = colors;
    donutChart.update();
    return;
  }

  donutChart = new Chart(g('donutChart'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'rgba(16,13,8,.7)',
        borderWidth: 2,
        hoverOffset: 10,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#70583e', boxWidth: 8, boxHeight: 8, padding: 12, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' },
        },
        tooltip: {
          ...TOOLTIP_STYLE,
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? (ctx.parsed / total * 100).toFixed(1) : 0;
              return `  ${fmt(ctx.parsed)}  (${pct}%)`;
            },
          },
        },
      },
      animation: { animateRotate: true, duration: 650 },
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { left, right, top, bottom } } = chart;
        const cx  = (left + right) / 2;
        const cy  = (top + bottom) / 2;

        const totalSaved = accounts.reduce((sum, a) =>
          sum + (income.monthlyNet || 0) * a.allocationPct / 100 * 12, 0);

        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = totalSaved > 0 ? '#7a9e6a' : '#70583e';
        ctx.font = '700 16px "Inter", sans-serif';
        ctx.fillText(fmt(totalSaved), cx, cy - 8);
        ctx.fillStyle = '#70583e';
        ctx.font = '500 10px "Inter", sans-serif';
        ctx.fillText('saved / yr', cx, cy + 10);
        ctx.restore();
      },
    }],
  });
}

function setChartView(v) {
  chartView = v;
  g('cvM').classList.toggle('active', v === 'monthly');
  g('cvY').classList.toggle('active', v === 'yearly');
  updateBarChart();
}

function updateBarChart() {
  const multiplier = chartView === 'monthly' ? 1 : 12;
  const unit       = chartView === 'monthly' ? '/mo' : '/yr';

  const expenseRows = expenses.map((e, i) => ({
    name:  e.name,
    amt:   (e.freq === 'monthly' ? e.amount : e.amount / 12) * multiplier,
    color: COLORS[(i + 2) % COLORS.length],
  }));

  const accountRows = accounts.map((a, i) => ({
    name:  a.name,
    amt:   (income.monthlyNet || 0) * a.allocationPct / 100 * multiplier,
    color: ACCT_COLORS[i % ACCT_COLORS.length],
  }));

  const sorted = [...expenseRows, ...accountRows].sort((a, b) => b.amt - a.amt);

  g('barEmpty').style.display = sorted.length ? 'none' : 'flex';

  const labels = sorted.map(r => r.name);
  const data   = sorted.map(r => r.amt);
  const colors = sorted.map(r => r.color);

  if (barChart) {
    barChart.data.labels = labels;
    barChart.data.datasets[0].data            = data;
    barChart.data.datasets[0].backgroundColor = colors;
    barChart.update();
    return;
  }

  barChart = new Chart(g('barChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Amount',
        data,
        backgroundColor: colors,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_STYLE,
          callbacks: { label: ctx => `  ${fmt(ctx.parsed.x)} ${unit}` },
        },
      },
      scales: {
        x: {
          grid:   { color: 'rgba(190,135,70,.07)' },
          ticks:  { color: '#70583e', font: { size: 10 }, callback: v => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) },
          border: { display: false },
        },
        y: {
          grid:   { display: false },
          ticks:  { color: '#9e8464', font: { size: 10 } },
          border: { display: false },
        },
      },
      animation: { duration: 500 },
    },
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

restore();
recalculate();
renderExpenses();
renderAccounts();
updateCharts();
