// script.js
(() => {
  'use strict';

  /* -------------------
     Storage keys & helpers
  -------------------*/
  const LS_KEY = 'spf_users_v_final';
  const LS_ACTIVE = 'spf_active';
  const RECENT_PREFIX = 'spf_recent_';

  function loadUsers() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } }
  function saveUsers(u) { localStorage.setItem(LS_KEY, JSON.stringify(u)); }
  function getActive() { return localStorage.getItem(LS_ACTIVE); }
  function setActive(email) { if (!email) return; localStorage.setItem(LS_ACTIVE, email); }
  function clearActive() { localStorage.removeItem(LS_ACTIVE); }
  function ensureMonthObj(userObj, month) {
    if (!userObj.months) userObj.months = {};
    if (!userObj.months[month]) userObj.months[month] = { income: [], expenses: [], events: [], goals: [] };
    return userObj.months[month];
  }
  function nowMonth() { return new Date().toISOString().slice(0,7); }
  function friendlyMonthYear(m) { try { const [y,mm]=m.split('-').map(Number); return new Date(y,mm-1,1).toLocaleString(undefined,{month:'long',year:'numeric'});}catch{ return m; } }

  /* -------------------
     DOM refs (match index.html)
  -------------------*/
  const loginSection = document.getElementById('loginSection');
  const monthSelectSection = document.getElementById('monthSelectSection');
  const dashboardSection = document.getElementById('dashboardSection');

  const usernameInput = document.getElementById('usernameInput');
  const emailInput = document.getElementById('emailInput');
  const passwordInput = document.getElementById('passwordInput');
  const registerBtn = document.getElementById('registerBtn');
  const loginBtn = document.getElementById('loginBtn');
  const authMsg = document.getElementById('authMsg');

  const userNameDisplay = document.getElementById('userNameDisplay');
  const recentMonths = document.getElementById('recentMonths');
  const monthInput = document.getElementById('monthInput');
  const openMonthBtn = document.getElementById('openMonthBtn');
  const openCurrentBtn = document.getElementById('openCurrentBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  const dashboardTitle = document.getElementById('dashboardTitle');
  const dashboardMonthLabel = document.getElementById('dashboardMonthLabel');
  const dashboardUsername = document.getElementById('dashboardUsername');
  const headerUsername = document.getElementById('headerUsername');

  const backToMonthSelection = document.getElementById('backToMonthSelection');
  const getAnalysisBtn = document.getElementById('getAnalysisBtn');

  const remainingIncomeEl = document.getElementById('remainingIncome');

  // income
  const incomeTitle = document.getElementById('incomeTitle');
  const incomeAmount = document.getElementById('incomeAmount');
  const addIncomeBtn = document.getElementById('addIncomeBtn');
  const incomeList = document.getElementById('incomeList');
  const incomeTotal = document.getElementById('incomeTotal');

  // expense
  const expenseTitle = document.getElementById('expenseTitle');
  const expenseAmount = document.getElementById('expenseAmount');
  const expensePriority = document.getElementById('expensePriority');
  const expenseRecurring = document.getElementById('expenseRecurring');
  const addExpenseBtn = document.getElementById('addExpenseBtn');
  const expenseList = document.getElementById('expenseList');
  const expenseTotal = document.getElementById('expenseTotal');
  const expenseAlert = document.getElementById('expenseAlert');

  // events
  const eventName = document.getElementById('eventName');
  const eventDate = document.getElementById('eventDate');
  const eventBudget = document.getElementById('eventBudget');
  const eventPriority = document.getElementById('eventPriority');
  const addEventBtn = document.getElementById('addEventBtn');
  const eventList = document.getElementById('eventList');
  const eventTotal = document.getElementById('eventTotal');

  // goals
  const goalName = document.getElementById('goalName');
  const goalTarget = document.getElementById('goalTarget');
  const goalDeadline = document.getElementById('goalDeadline');
  const goalPriority = document.getElementById('goalPriority');
  const addGoalBtn = document.getElementById('addGoalBtn');
  const goalList = document.getElementById('goalList');
  const goalTotal = document.getElementById('goalTotal');
  const goalAlert = document.getElementById('goalAlert');

  // charts & analysis
  const financeChartCtx = document.getElementById('financeChart').getContext('2d');
  const chartSelect = document.getElementById('chartSelect');
  const chartsMonthLabel = document.getElementById('chartsMonthLabel');

  const combinedChartCtx = document.getElementById('combinedChart').getContext('2d');
  const analysisBlock = document.getElementById('analysisBlock');

  // exports & share
  const exportExcelBtn = document.getElementById('exportExcel');
  const exportPDFBtn = document.getElementById('exportPDF');
  const shareReportBtn = document.getElementById('shareReport');

  // theme
  const themeToggle = document.getElementById('themeToggle');

  /* -------------------
     Charts states
  -------------------*/
  let financeChart = null;
  let combinedChart = null;

  function destroyCharts() {
    try { if (financeChart) financeChart.destroy(); } catch {}
    try { if (combinedChart) combinedChart.destroy(); } catch {}
  }

  /* -------------------
     Utilities
  -------------------*/
  function safeNum(v){ return Number(v || 0); }
  function escapeHtml(s){ if(s===undefined||s===null) return ''; return String(s).replace(/[&<>"'`=\/]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c])); }

  function usersObj(){ return loadUsers(); }
  function curUserObj(){ const email = getActive(); if(!email) return null; const u = loadUsers()[email]; return u || null; }

  /* -------------------
     Password rules (simple offline)
  -------------------*/
  function validPassword(p){
    if(!p) return false;
    if(p.length < 8) return false;
    if(!/[a-z]/.test(p)) return false;
    if(!/[A-Z]/.test(p)) return false;
    if(!/[0-9]/.test(p)) return false;
    if(!/[!@#\$%\^&\*(),.?":{}|<>]/.test(p)) return false;
    return true;
  }

  /* -------------------
     Navigation & UI flow
  -------------------*/
  function showLogin() {
    loginSection.classList.remove('hidden');
    monthSelectSection.classList.add('hidden');
    dashboardSection.classList.add('hidden');
  }
  function showMonthSelect() {
    loginSection.classList.add('hidden');
    monthSelectSection.classList.remove('hidden');
    dashboardSection.classList.add('hidden');
    populateRecentMonths();
    const email = getActive();
    userNameDisplay.textContent = (email && loadUsers()[email] && loadUsers()[email].username) ? loadUsers()[email].username : email || '';
    headerUsername.textContent = userNameDisplay.textContent || 'Guest';
    logoutBtn.classList.remove('hidden');
  }
  function showDashboardFor(month) {
    loginSection.classList.add('hidden');
    monthSelectSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    dashboardMonthLabel.textContent = friendlyMonthYear(month);
    chartsMonthLabel.textContent = friendlyMonthYear(month);
    dashboardUsername.textContent = (curUserObj() && curUserObj().username) ? curUserObj().username : getActive();
    headerUsername.textContent = dashboardUsername.textContent;
    // save recents and maybe import previous
    saveRecentMonth(month);
    // offer import from previous month
    maybeOfferImportFromPreviousMonth(month);
    // load all
    loadAllForMonth(month);
    // render charts
    setTimeout(()=> { renderMainChart(); renderCombinedChart(); }, 120);
  }

  // recent months
  function saveRecentMonth(m){
    const email = getActive(); if(!email) return;
    const k = RECENT_PREFIX + email;
    try {
      const arr = JSON.parse(localStorage.getItem(k) || '[]');
      if(!arr.includes(m)) arr.push(m);
      if(arr.length > 18) arr.splice(0, arr.length - 18);
      localStorage.setItem(k, JSON.stringify(arr));
    } catch {}
  }
  function populateRecentMonths(){
    recentMonths.innerHTML = '';
    const email = getActive();
    if(!email) return;
    const k = RECENT_PREFIX + email;
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem(k) || '[]'); } catch {}
    if(!arr || arr.length === 0) {
      const d = new Date();
      for(let i=0;i<6;i++){
        const mm = new Date(d.getFullYear(), d.getMonth()-i,1).toISOString().slice(0,7);
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1 border rounded text-sm';
        btn.textContent = mm;
        btn.onclick = ()=> showDashboardFor(mm);
        recentMonths.appendChild(btn);
      }
    } else {
      arr.slice().reverse().forEach(m=>{
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1 border rounded text-sm';
        btn.textContent = m;
        btn.onclick = ()=> showDashboardFor(m);
        recentMonths.appendChild(btn);
      });
    }
  }

  /* -------------------
     Auth handlers
  -------------------*/
  registerBtn.addEventListener('click', ()=>{
    authMsg.textContent = '';
    const email = (emailInput.value||'').trim().toLowerCase();
    const username = (usernameInput.value||'').trim();
    const password = passwordInput.value || '';
    if(!email||!username||!password){ authMsg.textContent = 'Fill all fields'; return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ authMsg.textContent='Invalid email'; return; }
    if(username.length > 25){ authMsg.textContent='Username too long'; return; }
    if(!validPassword(password)){ authMsg.textContent='Password must be 8+ chars with upper,lower,digit & special'; return; }
    const users = loadUsers();
    if(users[email]){ authMsg.textContent='Account exists. Use login.'; return; }
    users[email] = { username, password, months: {} };
    saveUsers(users);
    setActive(email);
    authMsg.textContent = 'Registered & logged in';
    showMonthSelect();
  });

  loginBtn.addEventListener('click', ()=>{
    authMsg.textContent = '';
    const email = (emailInput.value||'').trim().toLowerCase();
    const username = (usernameInput.value||'').trim();
    const password = passwordInput.value || '';
    if(!email||!username||!password){ authMsg.textContent='Fill all fields'; return; }
    const users = loadUsers();
    const u = users[email];
    if(!u){ authMsg.textContent='No account. Register first.'; return; }
    if(u.password !== password){ authMsg.textContent='Password incorrect'; return; }
    if(u.username !== username){ authMsg.textContent='Username does not match'; return; }
    setActive(email);
    authMsg.textContent = 'Logged in';
    showMonthSelect();
  });

  logoutBtn.addEventListener('click', ()=>{
    clearActive();
    location.reload();
  });

  openMonthBtn.addEventListener('click', ()=> {
    const m = monthInput.value; if(!m) return alert('Pick a month'); showDashboardFor(m);
  });
  openCurrentBtn.addEventListener('click', ()=> showDashboardFor(nowMonth()));
  backToMonthSelection.addEventListener('click', ()=> showMonthSelect());

  // theme
  themeToggle.addEventListener('click', ()=>{
    document.body.classList.toggle('dark');
    themeToggle.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
  });

  /* -------------------
     Import previous month (events+goals) prompt
  -------------------*/
  function maybeOfferImportFromPreviousMonth(currentMonth){
    const email = getActive(); if(!email) return;
    const users = loadUsers(); const user = users[email]; if(!user) return;
    const [y,mm] = currentMonth.split('-').map(Number);
    const prev = new Date(y, mm-2, 1).toISOString().slice(0,7);
    const prevData = (user.months && user.months[prev]) ? user.months[prev] : null;
    if(!prevData) return;
    const totalItems = (prevData.events||[]).length + (prevData.goals||[]).length;
    if(totalItems === 0) return;
    // Ask once per open
    if(!confirm(`Previous month (${prev}) has ${prevData.events.length} event(s) and ${prevData.goals.length} goal(s). Import their amounts to ${currentMonth}?`)) return;
    // Show choose dialog using prompt listing items & indices; user can leave blank to import all
    const lines = []; let idx=0;
    if(prevData.events.length){ lines.push('Events:'); prevData.events.forEach(ev=>{ lines.push(`${idx}: [E] ${ev.name} — ${ev.date} — ₹${ev.budget}`); idx++; }); }
    if(prevData.goals.length){ lines.push('Goals:'); prevData.goals.forEach(g=>{ lines.push(`${idx}: [G] ${g.name} — ${g.deadline||'N/A'} — ₹${g.target}`); idx++; }); }
    lines.push(''); lines.push('Enter comma-separated indices to SKIP (e.g. 0,3). Leave blank to import all.');
    const txt = prompt(lines.join('\n'));
    const skipSet = new Set();
    if(txt && txt.trim()){
      txt.split(',').map(x=>Number(x.trim())).forEach(n=>{ if(!isNaN(n)) skipSet.add(n); });
    }
    // import
    const cur = ensureMonthObj(user, currentMonth);
    idx = 0;
    prevData.events.forEach(ev=>{
      if(!skipSet.has(idx)){
        cur.events.push({ name: ev.name, date: ev.date, budget: Number(ev.budget||0), priority: ev.priority || 'Medium', createdAt: new Date().toISOString(), _importedFromPrev: prev });
      }
      idx++;
    });
    prevData.goals.forEach(g=>{
      if(!skipSet.has(idx)){
        cur.goals.push({ name: g.name, deadline: g.deadline || null, target: Number(g.target||0), priority: g.priority || 'Medium', progress: g.progress || 0, createdAt: new Date().toISOString(), _importedFromPrev: prev });
      }
      idx++;
    });
    // Reserve funds: add an expense "Imported prev-month commitments" to subtract from remaining
    const importedTotal = (prevData.events||[]).reduce((s,e)=>s+Number(e.budget||0),0) + (prevData.goals||[]).reduce((s,g)=>s+Number(g.target||0),0);
    if(importedTotal > 0){
      cur.expenses.push({ title: 'Imported prev-month commitments', amount: importedTotal, priority: 'High', recurring: false, createdAt: new Date().toISOString(), _imported:true });
      alert(`Imported and reserved ₹${importedTotal.toFixed(2)} from this month's income (recorded as an expense).`);
    } else {
      alert('Imported items added.');
    }
    users[email] = user; saveUsers(users);
  }

  /* -------------------
     CRUD & Renderers
  -------------------*/
  function getMonthObj(month){
    const u = curUserObj(); if(!u) return null;
    return ensureMonthObj(u, month);
  }

  function loadAllForMonth(month){
    populateRecentMonths();
    renderIncomeList(month);
    renderExpenseList(month);
    renderEventList(month);
    renderGoalList(month);
    refreshTotalsAndAlerts(month);
  }

  /* Income */
  addIncomeBtn.addEventListener('click', ()=>{
    const t = (incomeTitle.value||'').trim();
    const a = Number(incomeAmount.value||0);
    if(!t || !a || isNaN(a) || a<=0) return alert('Fill title and positive amount');
    const email = getActive(); if(!email) return alert('Login first');
    const users = loadUsers(); const user = users[email];
    const month = dashboardMonthLabel.textContent ? (()=>{ // convert friendly back to YYYY-MM if possible
      const m = monthInput.value; // not reliable; use saved current month stored in dataset
      return dashboardSection.dataset.currentMonth || nowMonth();
    })() : nowMonth();
    const curMonthKey = dashboardSection.dataset.currentMonth || nowMonth();
    const mobj = ensureMonthObj(user, curMonthKey);
    mobj.income.push({ title: t, amount: Number(a), category: '', createdAt: new Date().toISOString() });
    users[email] = user; saveUsers(users);
    incomeTitle.value = incomeAmount.value = '';
    renderIncomeList(curMonthKey); refreshTotalsAndAlerts(curMonthKey);
  });

  function renderIncomeList(monthKey){
    const mKey = monthKey || dashboardSection.dataset.currentMonth;
    incomeList.innerHTML = '';
    const u = curUserObj(); if(!u) return;
    const m = ensureMonthObj(u, mKey);
    const arr = (m.income||[]).slice().sort((a,b)=>b.amount - a.amount);
    arr.forEach((inc, idx)=>{
      const li = document.createElement('li');
      li.innerHTML = `${escapeHtml(inc.title)} — ₹${Number(inc.amount).toFixed(2)}
        <button class="ml-3 text-xs px-2 py-1 bg-yellow-300 rounded" onclick="spf_editIncome(${idx})">Edit</button>
        <button class="ml-1 text-xs px-2 py-1 bg-red-400 text-white rounded" onclick="spf_deleteIncome(${idx})">Del</button>`;
      incomeList.appendChild(li);
    });
    incomeTotal.textContent = 'Income total: ₹' + arr.reduce((s,i)=>s+Number(i.amount||0),0).toFixed(2);
  }

  window.spf_editIncome = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth;
    const m = ensureMonthObj(u, mKey);
    const item = m.income[i];
    if(!item) return alert('Invalid index');
    const nt = prompt('Title', item.title);
    const na = parseFloat(prompt('Amount', item.amount));
    if(!nt || isNaN(na)) return;
    item.title = nt; item.amount = Number(na);
    saveUsers(loadUsers()); renderIncomeList(mKey); refreshTotalsAndAlerts(mKey);
  };

  window.spf_deleteIncome = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth;
    const m = ensureMonthObj(u, mKey);
    if(!m.income[i]) return;
    if(!confirm('Delete income?')) return;
    m.income.splice(i,1);
    saveUsers(loadUsers()); renderIncomeList(mKey); refreshTotalsAndAlerts(mKey);
  };

  /* Expenses */
  addExpenseBtn.addEventListener('click', ()=>{
    const t = (expenseTitle.value||'').trim();
    const a = Number(expenseAmount.value||0);
    const pr = expensePriority.value || 'Medium';
    const rec = !!expenseRecurring.checked;
    if(!t || !a || isNaN(a) || a<=0) return alert('Fill title and positive amount');
    const email = getActive(); if(!email) return alert('Login first');
    const users = loadUsers(); const user = users[email];
    const mKey = dashboardSection.dataset.currentMonth || nowMonth();
    const m = ensureMonthObj(user, mKey);
    m.expenses.push({ title: t, amount: Number(a), priority: pr, recurring: rec, createdAt: new Date().toISOString() });
    users[email] = user; saveUsers(users);
    expenseTitle.value = expenseAmount.value = ''; expenseRecurring.checked = false;
    renderExpenseList(mKey); refreshTotalsAndAlerts(mKey);
  });

  function renderExpenseList(monthKey){
    const mKey = monthKey || dashboardSection.dataset.currentMonth;
    expenseList.innerHTML = '';
    const u = curUserObj(); if(!u) return;
    const m = ensureMonthObj(u, mKey);
    const arr = (m.expenses||[]).slice().sort((a,b)=>b.amount - a.amount);
    arr.forEach((e, idx)=>{
      const imported = e._imported ? ' (imported)' : '';
      const li = document.createElement('li');
      li.innerHTML = `${escapeHtml(e.title)} — ₹${Number(e.amount).toFixed(2)} [${e.priority}]${imported}
        <button class="ml-3 text-xs px-2 py-1 bg-yellow-300 rounded" onclick="spf_editExpense(${idx})">Edit</button>
        <button class="ml-1 text-xs px-2 py-1 bg-red-400 text-white rounded" onclick="spf_deleteExpense(${idx})">Del</button>`;
      expenseList.appendChild(li);
    });
    expenseTotal.textContent = 'Expenses total: ₹' + arr.reduce((s,x)=>s+Number(x.amount||0),0).toFixed(2);
  }

  window.spf_editExpense = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth;
    const m = ensureMonthObj(u, mKey);
    const item = m.expenses[i];
    if(!item) return alert('Invalid index');
    const nt = prompt('Title', item.title);
    const na = parseFloat(prompt('Amount', item.amount));
    const np = prompt('Priority (High/Medium/Low)', item.priority || 'Medium');
    const nr = confirm('Recurring? OK=Yes');
    if(!nt || isNaN(na)) return;
    item.title = nt; item.amount = Number(na); item.priority = np; item.recurring = nr;
    saveUsers(loadUsers()); renderExpenseList(mKey); refreshTotalsAndAlerts(mKey);
  };

  window.spf_deleteExpense = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth;
    const m = ensureMonthObj(u, mKey);
    if(!m.expenses[i]) return;
    if(!confirm('Delete expense?')) return;
    m.expenses.splice(i,1);
    saveUsers(loadUsers()); renderExpenseList(mKey); refreshTotalsAndAlerts(mKey);
  };

  /* Events */
  addEventBtn.addEventListener('click', ()=>{
    const name = (eventName.value||'').trim();
    const dateStr = eventDate.value;
    const budget = Number(eventBudget.value||0);
    const pr = eventPriority.value || 'Medium';
    if(!name || !dateStr || !budget || isNaN(budget) || budget<=0) return alert('Fill event name, date and positive budget');
    const curMonthKey = dashboardSection.dataset.currentMonth || nowMonth();
    const allowed = checkDateAllowedForEntry(dateStr, curMonthKey);
    if(!allowed.ok) return alert(allowed.msg);
    if(allowed.nextMonthPrompt){
      if(!confirm('Date is in next month. Add to next month? OK=Yes')) return;
      const [y,mm] = curMonthKey.split('-').map(Number);
      const nextMonth = new Date(y, mm, 1).toISOString().slice(0,7);
      saveEventForMonth(getActive(), nextMonth, { name, date: dateStr, budget: Number(budget), priority: pr });
      eventName.value = eventDate.value = eventBudget.value = '';
      if(dashboardSection.dataset.currentMonth === nextMonth) { renderEventList(nextMonth); refreshTotalsAndAlerts(nextMonth); }
      else alert('Event added to next month. Switch to that month to view.');
      return;
    }
    saveEventForMonth(getActive(), curMonthKey, { name, date: dateStr, budget: Number(budget), priority: pr });
    eventName.value = eventDate.value = eventBudget.value = '';
    renderEventList(curMonthKey); refreshTotalsAndAlerts(curMonthKey);
  });

  function saveEventForMonth(email, month, ev){
    const users = loadUsers(); const user = users[email]; if(!user) return;
    const mobj = ensureMonthObj(user, month);
    mobj.events.push(Object.assign({ createdAt: new Date().toISOString() }, ev));
    users[email] = user; saveUsers(users);
  }

  function renderEventList(monthKey){
    const mKey = monthKey || dashboardSection.dataset.currentMonth;
    eventList.innerHTML = '';
    const u = curUserObj(); if(!u) return;
    const m = ensureMonthObj(u, mKey);
    const arr = (m.events||[]).slice().sort((a,b)=> new Date(a.date) - new Date(b.date));
    arr.forEach((e, idx)=>{
      const li = document.createElement('li');
      li.innerHTML = `${escapeHtml(e.name)} — ${escapeHtml(e.date)} — ₹${Number(e.budget).toFixed(2)} [${e.priority}]
        <button class="ml-3 text-xs px-2 py-1 bg-yellow-300 rounded" onclick="spf_editEvent(${idx})">Edit</button>
        <button class="ml-1 text-xs px-2 py-1 bg-red-400 text-white rounded" onclick="spf_deleteEvent(${idx})">Del</button>`;
      eventList.appendChild(li);
    });
    eventTotal.textContent = 'Events total: ₹' + arr.reduce((s,x)=>s+Number(x.budget||0),0).toFixed(2);
  }

  window.spf_editEvent = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth;
    const m = ensureMonthObj(u, mKey); const item = m.events[i];
    if(!item) return alert('Invalid index');
    const nn = prompt('Event name', item.name);
    const nd = prompt('Date (YYYY-MM-DD)', item.date);
    const nb = parseFloat(prompt('Budget', item.budget));
    const np = prompt('Priority (High/Medium/Low)', item.priority);
    if(!nn || !nd || isNaN(nb)) return;
    const allowed = checkDateAllowedForEntry(nd, mKey);
    if(!allowed.ok) return alert(allowed.msg);
    if(allowed.nextMonthPrompt && !confirm('Edited date in next month — move? OK=Yes')) return;
    item.name = nn; item.date = nd; item.budget = Number(nb); item.priority = np;
    saveUsers(loadUsers()); renderEventList(mKey); refreshTotalsAndAlerts(mKey);
  };

  window.spf_deleteEvent = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth;
    const m = ensureMonthObj(u, mKey);
    if(!m.events[i]) return;
    if(!confirm('Delete event?')) return;
    m.events.splice(i,1);
    saveUsers(loadUsers()); renderEventList(mKey); refreshTotalsAndAlerts(mKey);
  };

  /* Goals */
  addGoalBtn.addEventListener('click', ()=>{
    const name = (goalName.value||'').trim();
    const deadline = goalDeadline.value || null;
    const target = Number(goalTarget.value||0);
    const pr = goalPriority.value || 'Medium';
    if(!name || !target || isNaN(target) || target<=0) return alert('Fill goal name and positive target');
    const curMonthKey = dashboardSection.dataset.currentMonth || nowMonth();
    if(deadline){
      const allowed = checkDateAllowedForEntry(deadline, curMonthKey);
      if(!allowed.ok) return alert(allowed.msg);
      if(allowed.nextMonthPrompt){
        if(!confirm('Goal deadline in next month. Add to next month? OK=Yes')) return;
        const [y,mm] = curMonthKey.split('-').map(Number);
        const nextM = new Date(y,mm,1).toISOString().slice(0,7);
        saveGoalForMonth(getActive(), nextM, { name, deadline, target: Number(target), priority: pr });
        goalName.value = goalDeadline.value = goalTarget.value = '';
        if(dashboardSection.dataset.currentMonth === nextM){ renderGoalList(nextM); refreshTotalsAndAlerts(nextM); }
        else alert('Goal added to next month. Switch to that month to view.');
        return;
      }
    }
    saveGoalForMonth(getActive(), curMonthKey, { name, deadline: deadline || null, target: Number(target), priority: pr });
    goalName.value = goalDeadline.value = goalTarget.value = '';
    renderGoalList(curMonthKey); refreshTotalsAndAlerts(curMonthKey);
  });

  function saveGoalForMonth(email, month, g){
    const users = loadUsers(); const user = users[email]; if(!user) return;
    const mobj = ensureMonthObj(user, month);
    mobj.goals.push(Object.assign({ progress: 0, createdAt: new Date().toISOString() }, g));
    users[email] = user; saveUsers(users);
  }

  function renderGoalList(monthKey){
    const mKey = monthKey || dashboardSection.dataset.currentMonth;
    goalList.innerHTML = '';
    const u = curUserObj(); if(!u) return;
    const m = ensureMonthObj(u, mKey);
    const arr = (m.goals||[]).slice().sort((a,b)=>b.target - a.target);
    arr.forEach((g, idx)=>{
      const li = document.createElement('li');
      li.innerHTML = `${escapeHtml(g.name)} — ₹${Number(g.target).toFixed(2)} ${g.deadline? ' - ' + escapeHtml(g.deadline):''} [${g.priority}]
        <button class="ml-3 text-xs px-2 py-1 bg-yellow-300 rounded" onclick="spf_editGoal(${idx})">Edit</button>
        <button class="ml-1 text-xs px-2 py-1 bg-red-400 text-white rounded" onclick="spf_deleteGoal(${idx})">Del</button>`;
      goalList.appendChild(li);
    });
    goalTotal.textContent = 'Goals total: ₹' + arr.reduce((s,x)=>s+Number(x.target||0),0).toFixed(2);
  }

  window.spf_editGoal = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth; const m = ensureMonthObj(u,mKey); const item = m.goals[i];
    if(!item) return alert('Invalid index');
    const nn = prompt('Goal name', item.name);
    const nd = prompt('Deadline (YYYY-MM-DD)', item.deadline||'');
    const nt = parseFloat(prompt('Target', item.target));
    const np = prompt('Priority (High/Medium/Low)', item.priority||'Medium');
    if(!nn || isNaN(nt)) return;
    if(nd){
      const allowed = checkDateAllowedForEntry(nd, mKey); if(!allowed.ok) return alert(allowed.msg);
    }
    item.name = nn; item.deadline = nd || null; item.target = Number(nt); item.priority = np;
    saveUsers(loadUsers()); renderGoalList(mKey); refreshTotalsAndAlerts(mKey);
  };

  window.spf_deleteGoal = function(i){
    const u = curUserObj(); if(!u) return;
    const mKey = dashboardSection.dataset.currentMonth; const m = ensureMonthObj(u,mKey);
    if(!m.goals[i]) return;
    if(!confirm('Delete goal?')) return;
    m.goals.splice(i,1); saveUsers(loadUsers()); renderGoalList(mKey); refreshTotalsAndAlerts(mKey);
  };

  /* -------------------
     Date helper (only this month or next month allowed; no past)
  -------------------*/
  function checkDateAllowedForEntry(dateStr, selectedMonth){
    if(!dateStr || !selectedMonth) return { ok:false, msg:'Invalid date or month' };
    const d = new Date(dateStr + 'T00:00:00'); if(isNaN(d.getTime())) return { ok:false, msg:'Invalid date format' };
    const today = new Date(); today.setHours(0,0,0,0);
    if(d < today) return { ok:false, msg:'Cannot add to past dates' };
    const [sy,sm] = selectedMonth.split('-').map(Number);
    const firstSelected = new Date(sy,sm-1,1);
    const lastSelected = new Date(sy,sm,0);
    const nextFirst = new Date(sy,sm,1);
    const nextLast = new Date(sy,sm+1,0);
    if(d >= firstSelected && d <= lastSelected) return { ok:true, msg:'ok', nextMonthPrompt:false };
    if(d >= nextFirst && d <= nextLast) return { ok:true, msg:'ok', nextMonthPrompt:true };
    return { ok:false, msg:'You can add only for this month or next month' };
  }

  /* -------------------
     Totals, alerts & analysis rules
  -------------------*/
  function calcTotals(m){
    const incomes = m.income||[]; const expenses = m.expenses||[]; const events = m.events||[]; const goals = m.goals||[];
    const totalIncome = incomes.reduce((s,i)=>s+Number(i.amount||0),0);
    const totalExpenses = expenses.reduce((s,e)=>s+Number(e.amount||0),0);
    const totalEvents = events.reduce((s,ev)=>s+Number(ev.budget||0),0);
    const totalGoals = goals.reduce((s,g)=>s+Number(g.target||0),0);
    const remaining = totalIncome - (totalExpenses + totalEvents + totalGoals);
    return { totalIncome, totalExpenses, totalEvents, totalGoals, remaining };
  }

  function generateAlerts(m){
    const alerts = [];
    const t = calcTotals(m);
    if(t.totalIncome === 0) alerts.push('No income recorded for this month — consider adding income.');
    if(t.remaining < 0) alerts.push('Budget exceeded by ₹' + Math.abs(t.remaining).toFixed(2));
    const recurring = (m.expenses||[]).filter(e=>e.recurring).reduce((s,e)=>s+Number(e.amount||0),0);
    if(recurring > 0) alerts.push('Recurring expenses total ₹' + recurring.toFixed(2) + ' predicted next month.');
    const high = (m.expenses||[]).filter(e=>e.priority==='High').reduce((s,e)=>s+Number(e.amount||0),0);
    const low = (m.expenses||[]).filter(e=>e.priority==='Low').reduce((s,e)=>s+Number(e.amount||0),0);
    if(low > high && high > 0) alerts.push('Low-priority expenses exceed high-priority spending — consider reducing low-priority costs.');
    if((m.goals||[]).length === 0) alerts.push('No savings goals set for this month — consider adding goals.');
    return alerts;
  }

  function refreshTotalsAndAlerts(monthKey){
    const mKey = monthKey || dashboardSection.dataset.currentMonth;
    const u = curUserObj(); if(!u) return;
    const m = ensureMonthObj(u, mKey);
    const totals = calcTotals(m);
    incomeTotal.textContent = 'Income total: ₹' + (totals.totalIncome||0).toFixed(2);
    expenseTotal.textContent = 'Expenses total: ₹' + (totals.totalExpenses||0).toFixed(2);
    eventTotal.textContent = 'Events total: ₹' + (totals.totalEvents||0).toFixed(2);
    goalTotal.textContent = 'Goals total: ₹' + (totals.totalGoals||0).toFixed(2);
    remainingIncomeEl.textContent = '₹' + (totals.remaining||0).toFixed(2);

    const alerts = generateAlerts(m);
    if(alerts.length){
      expenseAlert.classList.remove('hidden'); expenseAlert.textContent = alerts.join(' | ');
      goalAlert.classList.remove('hidden'); goalAlert.textContent = alerts.join(' | ');
    } else {
      expenseAlert.classList.add('hidden'); expenseAlert.textContent = '';
      goalAlert.classList.add('hidden'); goalAlert.textContent = '';
    }
  }

  /* -------------------
     Charts: per-month & combined
  -------------------*/
  function renderMainChart(){
    const sel = chartSelect.value || 'expenses';
    const mKey = dashboardSection.dataset.currentMonth;
    const u = curUserObj(); if(!u) return;
    const m = ensureMonthObj(u, mKey);
    destroyCharts();
    let labels=[], data=[], title='';
    if(sel === 'expenses'){ labels = (m.expenses||[]).map(x=>x.title||'Expense'); data = (m.expenses||[]).map(x=>Number(x.amount||0)); title = `Expenses — ${friendlyMonthYear(mKey)}`; }
    else if(sel === 'events'){ labels = (m.events||[]).map(x=>x.name||'Event'); data = (m.events||[]).map(x=>Number(x.budget||0)); title = `Events — ${friendlyMonthYear(mKey)}`; }
    else if(sel === 'goals'){ labels = (m.goals||[]).map(x=>x.name||'Goal'); data = (m.goals||[]).map(x=>Number(x.target||0)); title = `Goals — ${friendlyMonthYear(mKey)}`; }
    else { labels = (m.income||[]).map(x=>x.title||'Income'); data = (m.income||[]).map(x=>Number(x.amount||0)); title = `Income — ${friendlyMonthYear(mKey)}`; }
    if(data.length === 0){ labels = ['No data']; data = [1]; }
    try {
      financeChart = new Chart(financeChartCtx, { type:'pie', data:{ labels, datasets:[{ data }] }, options:{ plugins:{ title:{ display:true, text:title } } } });
    } catch(e){ console.error('Chart error',e); }
  }

  function renderCombinedChart(){
    const u = curUserObj(); if(!u) return;
    const months = Object.keys(u.months || {}).sort();
    if(months.length === 0){
      // render placeholder
      try { combinedChart = new Chart(combinedChartCtx, { type:'doughnut', data:{ labels:['No data'], datasets:[{ data:[1] }] }, options:{ plugins:{ title:{ display:true, text:'No combined data' } } } }); } catch(e){}
      return;
    }
    const labels = []; const exp=[]; const evs=[]; const gl=[]; const inc=[];
    months.forEach(k=>{
      labels.push(k);
      const m = u.months[k] || { income:[], expenses:[], events:[], goals:[] };
      exp.push((m.expenses||[]).reduce((s,x)=>s+Number(x.amount||0),0));
      evs.push((m.events||[]).reduce((s,x)=>s+Number(x.budget||0),0));
      gl.push((m.goals||[]).reduce((s,x)=>s+Number(x.target||0),0));
      inc.push((m.income||[]).reduce((s,x)=>s+Number(x.amount||0),0));
    });
    try {
      combinedChart = new Chart(combinedChartCtx, {
        type:'bar',
        data:{ labels, datasets:[
          { label:'Expenses', data: exp },
          { label:'Events', data: evs },
          { label:'Goals', data: gl },
          { label:'Income', data: inc }
        ]},
        options:{ plugins:{ title:{ display:true, text:'Combined across months (previous + present)' } }, responsive:true }
      });
    } catch(e){ console.error('Combined chart error', e); }
  }

  chartSelect.addEventListener('change', ()=> renderMainChart());

  /* -------------------
     Analysis generation (per your rules)
  -------------------*/
  getAnalysisBtn.addEventListener('click', ()=>{
    const u = curUserObj(); if(!u) return alert('Open a month first');
    const months = Object.keys(u.months||{}).sort();
    const current = dashboardSection.dataset.currentMonth;
    if(!current) return alert('No month selected');
    // Build analysis object
    const analysis = {};
    // Current totals + alerts
    const curObj = u.months[current] || { income:[], expenses:[], events:[], goals:[] };
    analysis.currentMonth = { month: current, totals: calcTotals(curObj), alerts: generateAlerts(curObj) };

    // Combined charts: handled by renderCombinedChart()

    // Priority checks
    const curHigh = (curObj.expenses||[]).filter(x=>x.priority==='High').reduce((s,x)=>s+Number(x.amount||0),0);
    const curLow = (curObj.expenses||[]).filter(x=>x.priority==='Low').reduce((s,x)=>s+Number(x.amount||0),0);
    if(curLow > curHigh && curHigh > 0) analysis.priority = 'Low-priority expenses exceed high-priority spend — consider trimming low-priority items.';
    else analysis.priority = 'Priority distribution OK.';

    // low priority increase vs previous month
    const idx = months.indexOf(current);
    if(idx > 0){
      const prev = months[idx-1];
      const prevObj = u.months[prev] || { expenses:[] };
      const prevLow = (prevObj.expenses||[]).filter(x=>x.priority==='Low').reduce((s,x)=>s+Number(x.amount||0),0);
      if(curLow > prevLow) analysis.lowIncrease = `Low-priority spending increased from ₹${prevLow.toFixed(2)} (${prev}) to ₹${curLow.toFixed(2)} (${current}).`;
      else analysis.lowIncrease = `Low-priority spending stable or decreased vs ${prev}.`;
    } else analysis.lowIncrease = 'No previous month to compare low-priority spending.';

    // low-priority vs savings
    const goalsTotal = (curObj.goals||[]).reduce((s,g)=>s+Number(g.target||0),0);
    if(goalsTotal === 0) analysis.lowVsSavings = 'No savings goals set.';
    else if(curLow > goalsTotal) analysis.lowVsSavings = `Low-priority spending (₹${curLow.toFixed(2)}) exceeds savings targets total (₹${goalsTotal.toFixed(2)}). Consider reallocating.`;
    else analysis.lowVsSavings = 'Low-priority spending does not exceed goals total.';

    // savings decreasing trend
    const savingsByMonth = months.map(k=>({ month:k, remaining: calcTotals(u.months[k]||{income:[],expenses:[],events:[],goals:[]}).remaining }));
    let savingsTrend = 'No clear decreasing trend.';
    if(months.length >= 2){
      const curRem = savingsByMonth[savingsByMonth.length-1].remaining;
      const prevRem = savingsByMonth[savingsByMonth.length-2].remaining;
      if(curRem < prevRem) savingsTrend = `Savings decreased vs previous month (₹${prevRem.toFixed(2)} → ₹${curRem.toFixed(2)}).`;
      else savingsTrend = `Savings stable/increased vs previous month (₹${prevRem.toFixed(2)} → ₹${curRem.toFixed(2)}).`;
    }
    analysis.savingsTrend = savingsTrend;

    // future commitments (events & goals)
    const futureNotes = [];
    (curObj.events||[]).forEach(ev=>{ const dt = new Date(ev.date+'T00:00:00'); if(dt > new Date()) futureNotes.push(`Event ${ev.name} on ${ev.date} — ₹${ev.budget}`); });
    (curObj.goals||[]).forEach(g=>{ if(g.deadline){ const dt = new Date(g.deadline + 'T00:00:00'); if(dt > new Date()) futureNotes.push(`Goal ${g.name} by ${g.deadline} — ₹${g.target}`); } });
    analysis.futureCommitments = futureNotes.length ? futureNotes : ['No future events/goals'];

    // month-over-month increases per section
    const upward = [];
    ['income','expenses','events','goals'].forEach(sec=>{
      const vals = months.map(k=> {
        const m = u.months[k] || {};
        if(sec==='income') return (m.income||[]).reduce((s,i)=>s+Number(i.amount||0),0);
        if(sec==='expenses') return (m.expenses||[]).reduce((s,e)=>s+Number(e.amount||0),0);
        if(sec==='events') return (m.events||[]).reduce((s,e)=>s+Number(e.budget||0),0);
        if(sec==='goals') return (m.goals||[]).reduce((s,g)=>s+Number(g.target||0),0);
        return 0;
      });
      if(vals.length >= 2){
        const last = vals[vals.length-1], prev = vals[vals.length-2];
        if(last > prev) upward.push({ section:sec, prev, now:last });
      }
    });
    analysis.upwardSections = upward;

    // previous-month commitments not funded
    const unfunded = [];
    if(idx > 0){
      const prev = months[idx-1], prevObj = u.months[prev] || {};
      const prevTotal = (prevObj.events||[]).reduce((s,e)=>s+Number(e.budget||0),0) + (prevObj.goals||[]).reduce((s,g)=>s+Number(g.target||0),0);
      const currReserve = (curObj.expenses||[]).filter(x=>x._imported).reduce((s,x)=>s+Number(x.amount||0),0);
      if(prevTotal > currReserve) unfunded.push(`Previous month commitments ₹${prevTotal.toFixed(2)} vs reserved ₹${currReserve.toFixed(2)} — consider keeping funds.`);
    }
    analysis.unfunded = unfunded;

    // single large items (>40% income)
    const bigItems = [];
    const totalInc = calcTotals(curObj).totalIncome || 0;
    (curObj.expenses||[]).concat(curObj.events||[]).concat(curObj.goals||[]).forEach(it=>{
      const val = Number(it.amount||it.budget||it.target||0);
      if(totalInc > 0 && val > totalInc*0.4) bigItems.push({ label: it.title||it.name, amount: val });
    });
    analysis.bigItems = bigItems.length ? bigItems : ['No single item >40% of income'];

    analysisBlock.textContent = JSON.stringify(analysis, null, 2);
    // Also render combined chart
    renderCombinedChart();
  });

  /* -------------------
     Exports & Web Share
  -------------------*/
  async function createPdfBlob(email, month){
    const users = loadUsers(); const user = users[email]; const m = (user.months && user.months[month]) || { income:[], expenses:[], events:[], goals:[] };
    if(window.jspdf && window.jspdf.jsPDF){
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit:'pt', format:'a4' });
      doc.setFontSize(16); doc.text(`Smart Personal Finance — ${friendlyMonthYear(month)}`, 40, 50);
      doc.setFontSize(11); doc.text(`User: ${user.username} (${email})`, 40, 72); doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 90);
      let y = 120;
      function writeSection(title, rows){
        doc.setFontSize(13); doc.text(title, 40, y); y+=18;
        doc.setFontSize(10);
        if(rows.length === 0){ doc.text('- None', 60, y); y+=14; return; }
        rows.forEach(r=>{
          const lines = doc.splitTextToSize(r,480);
          lines.forEach(ln=>{ doc.text('• ' + ln, 60, y); y+=12; });
          y+=4; if(y>740){ doc.addPage(); y=40; }
        });
        y+=8;
      }
      writeSection('Income', m.income.map(i=>`${i.title} — ₹${Number(i.amount).toFixed(2)} ${i.category||''}`));
      writeSection('Expenses', m.expenses.map(e=>`${e.title} — ₹${Number(e.amount).toFixed(2)} [${e.priority}] ${e.recurring? '(recurring)':''}`));
      writeSection('Events', m.events.map(ev=>`${ev.name} (${ev.date}) — ₹${Number(ev.budget).toFixed(2)} [${ev.priority}]`));
      writeSection('Goals', m.goals.map(g=>`${g.name} — ₹${Number(g.target).toFixed(2)} ${g.deadline?('by '+g.deadline):''}`));
      const alerts = generateAlerts(m);
      writeSection('Alerts / Suggestions', alerts.length?alerts:['All good']);
      const blob = doc.output('blob'); return blob;
    } else {
      // fallback to text blob
      const txt = [`Report — ${friendlyMonthYear(month)}`, `User: ${user.username} (${email})`, `Generated: ${new Date().toLocaleString()}`, '--- Income ---',
        ...m.income.map(i=>`${i.title} — ₹${i.amount}`), '--- Expenses ---', ...m.expenses.map(e=>`${e.title} — ₹${e.amount}`),
        '--- Events ---', ...m.events.map(ev=>`${ev.name} (${ev.date}) — ₹${ev.budget}`), '--- Goals ---', ...m.goals.map(g=>`${g.name} — ₹${g.target}`)];
      return new Blob([txt.join('\n')], { type: 'text/plain' });
    }
  }

  exportPDFBtn.addEventListener('click', async ()=>{
    const email = getActive(); const month = dashboardSection.dataset.currentMonth;
    if(!email || !month) return alert('Open a month first');
    exportPDFBtn.disabled = true;
    try {
      const blob = await createPdfBlob(email, month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `report_${email}_${month}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch(e){ alert('PDF error: ' + (e.message || e)); }
    exportPDFBtn.disabled = false;
  });

  exportExcelBtn.addEventListener('click', ()=>{
    const email = getActive(); const month = dashboardSection.dataset.currentMonth;
    if(!email || !month) return alert('Open a month first');
    if(!window.XLSX) { alert('SheetJS not loaded'); return; }
    const users = loadUsers(); const user = users[email]; const m = (user.months && user.months[month]) || { income:[], expenses:[], events:[], goals:[] };
    const rows = [['Section','Title/Name','Amount','Priority/Date']];
    (m.income||[]).forEach(i=> rows.push(['Income', i.title, i.amount, i.category||'']));
    (m.expenses||[]).forEach(e=> rows.push(['Expense', e.title, e.amount, e.priority||'']));
    (m.events||[]).forEach(ev=> rows.push(['Event', ev.name, ev.budget, ev.date]));
    (m.goals||[]).forEach(g=> rows.push(['Goal', g.name, g.target, g.deadline||'']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `report_${email}_${month}.xlsx`);
  });

  shareReportBtn.addEventListener('click', async ()=>{
    const email = getActive(); const month = dashboardSection.dataset.currentMonth;
    if(!email||!month) return alert('Open a month first');
    try {
      const blob = await createPdfBlob(email, month);
      const file = new File([blob], `report_${email}_${month}.pdf`, { type: 'application/pdf' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){ await navigator.share({ files: [file], title:`Finance report ${month}`, text:`Report for ${email} - ${month}` }); }
      else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `report_${email}_${month}.pdf`; a.click();
        URL.revokeObjectURL(url);
        alert('Share not supported — downloaded instead.');
      }
    } catch(e){ alert('Share failed: ' + (e.message||e)); }
  });

  /* -------------------
     Helpers: loadUsers wrapper & initial state
  -------------------*/
  function loadUsers(){ return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); }
  function saveUsersObj(u){ localStorage.setItem(LS_KEY, JSON.stringify(u)); }

  // Ensure dataset.currentMonth on dashboard when opening
  function openDashboardAndSetMonth(m){
    dashboardSection.dataset.currentMonth = m;
    showDashboardFor(m);
  }

  /* -------------------
     Entry flow: when page loads
  -------------------*/
  (function init(){
    const active = getActive();
    // if active user exists show month select
    if(active){
      showMonthSelect();
    } else {
      showLogin();
    }

    // On page load, attach some functions to window for edit/delete (they call window.spf_* above)
    // But we already attached via window.spf_* in many places

    // When dashboard opened, set dataset.currentMonth using last recent or now
    // For safety attach listener to showDashboardFor via saveRecentMonth
  })();

  /* -------------------
     Convenience: when a month is opened externally call openDashboardAndSetMonth
     We need to set dataset.currentMonth to correct "YYYY-MM" (we store when calling showDashboardFor)
  -------------------*/
  // modify showDashboardFor to set dataset and call load
  const originalShowDashboardFor = showDashboardFor;
  showDashboardFor = function(month){
    dashboardSection.dataset.currentMonth = month;
    dashboardMonthLabel.textContent = friendlyMonthYear(month);
    chartsMonthLabel.textContent = friendlyMonthYear(month);
    dashboardUsername.textContent = (curUserObj() && curUserObj().username) ? curUserObj().username : getActive();
    headerUsername.textContent = dashboardUsername.textContent;
    saveRecentMonth(month);
    maybeOfferImportFromPreviousMonth(month);
    loadAllForMonth(month);
    dashboardSection.classList.remove('hidden');
    monthSelectSection.classList.add('hidden');
    loginSection.classList.add('hidden');
    // render charts
    setTimeout(()=> { renderMainChart(); renderCombinedChart(); }, 120);
  };

  // small tweak: when opening month via showDashboardFor before redefinition, ensure we use new
  // Update some global UI initial wiring:
  // Expose edit/delete handlers globally (they were defined on window earlier)
 // ---------- Robust global edit/delete handlers (REPLACE the old no-op block) ----------
(function attachGlobalHandlers(){
  // helper to persist a user object back to LS
  function persistUser(email, userObj){
    if(!email || !userObj) return;
    const users = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    users[email] = userObj;
    localStorage.setItem(LS_KEY, JSON.stringify(users));
  }

  // common guard & helpers
  function getCurrentMonthKey(){
    return (dashboardSection && dashboardSection.dataset && dashboardSection.dataset.currentMonth) ? dashboardSection.dataset.currentMonth : nowMonth();
  }
  function getCurrentUserObjAndEmail(){
    const email = getActive();
    if(!email) return { email: null, user: null };
    const users = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return { email, user: users[email] || null };
  }

  window.spf_editIncome = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    const item = m.income && m.income[index];
    if(!item) return alert('Invalid income index');
    const newTitle = prompt('Edit income title', item.title);
    const newAmountRaw = prompt('Edit income amount', item.amount);
    const newAmount = parseFloat(newAmountRaw);
    if(!newTitle || isNaN(newAmount)) return alert('Invalid input');
    item.title = newTitle;
    item.amount = Number(newAmount);
    persistUser(email, user);
    renderIncomeList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_deleteIncome = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    if(!m.income || !m.income[index]) return alert('Invalid income index');
    if(!confirm('Delete this income?')) return;
    m.income.splice(index, 1);
    persistUser(email, user);
    renderIncomeList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_editExpense = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    const item = m.expenses && m.expenses[index];
    if(!item) return alert('Invalid expense index');
    const newTitle = prompt('Edit expense title', item.title);
    const newAmountRaw = prompt('Edit amount', item.amount);
    const newAmount = parseFloat(newAmountRaw);
    const newPriority = prompt('Priority (High/Medium/Low)', item.priority || 'Medium');
    const newRecurring = confirm('Recurring? OK = Yes, Cancel = No');
    if(!newTitle || isNaN(newAmount)) return alert('Invalid input');
    item.title = newTitle;
    item.amount = Number(newAmount);
    item.priority = newPriority || item.priority;
    item.recurring = !!newRecurring;
    persistUser(email, user);
    renderExpenseList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_deleteExpense = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    if(!m.expenses || !m.expenses[index]) return alert('Invalid expense index');
    if(!confirm('Delete this expense?')) return;
    m.expenses.splice(index, 1);
    persistUser(email, user);
    renderExpenseList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_editEvent = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    const item = m.events && m.events[index];
    if(!item) return alert('Invalid event index');
    const newName = prompt('Event name', item.name);
    const newDate = prompt('Date (YYYY-MM-DD)', item.date);
    const newBudgetRaw = prompt('Budget', item.budget);
    const newBudget = parseFloat(newBudgetRaw);
    const newPriority = prompt('Priority (High/Medium/Low)', item.priority || 'Medium');
    if(!newName || !newDate || isNaN(newBudget)) return alert('Invalid input');
    const allowed = checkDateAllowedForEntry(newDate, monthKey);
    if(!allowed.ok) return alert(allowed.msg);
    if(allowed.nextMonthPrompt && !confirm('New date is in next month — move event? OK=Yes')) return;
    item.name = newName;
    item.date = newDate;
    item.budget = Number(newBudget);
    item.priority = newPriority || item.priority;
    persistUser(email, user);
    renderEventList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_deleteEvent = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    if(!m.events || !m.events[index]) return alert('Invalid event index');
    if(!confirm('Delete this event?')) return;
    m.events.splice(index, 1);
    persistUser(email, user);
    renderEventList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_editGoal = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    const item = m.goals && m.goals[index];
    if(!item) return alert('Invalid goal index');
    const newName = prompt('Goal name', item.name);
    const newDeadline = prompt('Deadline (YYYY-MM-DD)', item.deadline || '');
    const newTargetRaw = prompt('Target amount', item.target);
    const newTarget = parseFloat(newTargetRaw);
    const newPriority = prompt('Priority (High/Medium/Low)', item.priority || 'Medium');
    if(!newName || isNaN(newTarget)) return alert('Invalid input');
    if(newDeadline){
      const allowed = checkDateAllowedForEntry(newDeadline, monthKey);
      if(!allowed.ok) return alert(allowed.msg);
    }
    item.name = newName;
    item.deadline = newDeadline || null;
    item.target = Number(newTarget);
    item.priority = newPriority || item.priority;
    persistUser(email, user);
    renderGoalList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

  window.spf_deleteGoal = function(index){
    const { email, user } = getCurrentUserObjAndEmail();
    if(!email || !user) return alert('Login first');
    const monthKey = getCurrentMonthKey();
    const m = ensureMonthObj(user, monthKey);
    if(!m.goals || !m.goals[index]) return alert('Invalid goal index');
    if(!confirm('Delete this goal?')) return;
    m.goals.splice(index, 1);
    persistUser(email, user);
    renderGoalList(monthKey);
    refreshTotalsAndAlerts(monthKey);
  };

})();



  // Re-render charts on resize
  window.addEventListener('resize', ()=> { try { if(financeChart) financeChart.resize(); if(combinedChart) combinedChart.resize(); } catch{} });

})();
