// ═══════════════════════════════════════════════════════════════
// app.js — Phone auth, role-based access, routing
// JETS 2024-2026 | Lavushimanda District
// ═══════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYd7lQYJ8ylREFy7dLZRkMfT3BjN-_FX6cTdPg4OG-aDK2U-dCl0E5-Q8wNNGxQ0lurw/exec";

const SESSION_KEY = "jets_session";

// ── Submission Deadlines ──────────────────────────────────────
// Initialized to default values; refreshed from Settings tab on boot.
let _deadlineSchoolOpen  = new Date("2026-05-26T00:00:00");
let _deadlineSchoolClose = new Date("2026-05-30T23:59:00");
let _deadlineZoneOpen    = new Date("2026-06-01T00:00:00");
let _deadlineZoneClose   = new Date("2026-06-05T23:59:00");

function schoolClosed() { return new Date() > _deadlineSchoolClose; }
function zoneNotOpen()  { return new Date() < _deadlineZoneOpen; }
function zoneClosed()   { return new Date() > _deadlineZoneClose; }

let currentMode = null;
let authData    = null;

// ── Network Status ────────────────────────────────────────────
window.NetStatus = (() => {
  let _offline = !navigator.onLine;
  let _timer   = null;

  function dot()    { return document.getElementById('net-dot'); }
  function banner() { return document.getElementById('net-banner'); }

  function applyDot(isOffline) {
    const d = dot();
    if (d) d.className = 'net-dot ' + (isOffline ? 'net-offline' : 'net-online');
  }

  function update(isOffline) {
    _offline = isOffline;
    applyDot(isOffline);
    clearTimeout(_timer);

    const b = banner();
    if (!b) return;

    if (isOffline) {
      b.className  = 'net-banner net-banner-offline';
      b.textContent = 'You are offline. Do not submit until reconnected.';
      const sub = document.getElementById('sf-submit');
      if (sub) sub.disabled = true;
    } else {
      b.className  = 'net-banner net-banner-online';
      b.textContent = 'Connected. You can submit now.';
      if (typeof window._sfValidate === 'function') window._sfValidate();
      _timer = setTimeout(() => b.classList.add('hidden'), 3000);
    }
  }

  window.addEventListener('offline', () => update(true));
  window.addEventListener('online',  () => update(false));

  document.addEventListener('DOMContentLoaded', () => {
    applyDot(_offline);
    if (_offline) update(true);
  });

  return { get isOffline() { return _offline; } };
})();

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open-school').addEventListener('click',    () => App.startFlow('school'));
  document.getElementById('btn-open-zone').addEventListener('click',      () => App.startFlow('zone'));
  document.getElementById('btn-open-dashboard').addEventListener('click', () => App.startFlow('dashboard'));
  document.getElementById('btn-verify').addEventListener('click', App.verifyPhone);
  document.getElementById('landing-phone').addEventListener('keydown', e => {
    if (e.key === 'Enter') App.verifyPhone();
  });

  updateCountdowns();
  setInterval(updateCountdowns, 1000);

  // Fetch live deadlines from Settings tab (non-blocking)
  loadDeadlines();

  // Restore session if available using new keys
  const userPhone = sessionStorage.getItem('userPhone');
  const userRole  = sessionStorage.getItem('userRole');
  const schoolInfoStr = sessionStorage.getItem('schoolInfo');
  
  if (userPhone && userRole && schoolInfoStr) {
    try {
      const schoolInfo = JSON.parse(schoolInfoStr);
      authData = {
        phone: userPhone,
        role: userRole,
        zone: schoolInfo.zone,
        schoolName: schoolInfo.schoolName,
        schoolType: schoolInfo.schoolType,
        organiserName: schoolInfo.organiserName
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));
      applyRoleUI(userRole);
      if (typeof WelcomeStats !== 'undefined') WelcomeStats.show(authData);
    } catch (_) {
      sessionStorage.removeItem('userPhone');
      sessionStorage.removeItem('userRole');
      sessionStorage.removeItem('schoolInfo');
      sessionStorage.removeItem(SESSION_KEY);
    }
  } else {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        authData = JSON.parse(stored);
        if (authData && authData.phone && authData.role) {
          sessionStorage.setItem('userPhone', authData.phone);
          sessionStorage.setItem('userRole', authData.role);
          sessionStorage.setItem('schoolInfo', JSON.stringify({
            zone: authData.zone,
            schoolName: authData.schoolName,
            schoolType: authData.schoolType,
            organiserName: authData.organiserName
          }));
          applyRoleUI(authData.role);
          if (typeof WelcomeStats !== 'undefined') WelcomeStats.show(authData);
        }
      } catch (_) {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }
  }
});

// ── Load Live Deadlines ───────────────────────────────────────
// Reads deadlines from Firestore (fast, no cold start).
async function loadDeadlines() {
  const cached = sessionStorage.getItem(SESSION_KEY + '_dl');
  if (cached) {
    try { applyDeadlines(JSON.parse(cached)); return; } catch (_) {}
  }
  try {
    const data = await FirestoreDB.getDeadlines();
    if (data.status === 'ok' && data.deadlines && Object.keys(data.deadlines).length) {
      applyDeadlines(data.deadlines);
      sessionStorage.setItem(SESSION_KEY + '_dl', JSON.stringify(data.deadlines));
    }
  } catch (_) {}
}

function applyDeadlines(dl) {
  if (dl.School_Open)  _deadlineSchoolOpen  = new Date(dl.School_Open);
  if (dl.School_Close) _deadlineSchoolClose = new Date(dl.School_Close);
  if (dl.Zone_Open)    _deadlineZoneOpen    = new Date(dl.Zone_Open);
  if (dl.Zone_Close)   _deadlineZoneClose   = new Date(dl.Zone_Close);
  if (authData && authData.role) applyRoleUI(authData.role);
}

// ── Session clear helper ──────────────────────────────────────
function clearSession() {
  sessionStorage.removeItem('userPhone');
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('schoolInfo');
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY + '_dl');
}

// ── Phone Verification — queries Firestore registered_schools directly ──
async function verifyPhone() {
  const input = document.getElementById('landing-phone');
  const msgEl = document.getElementById('landing-auth-msg');
  const btn   = document.getElementById('btn-verify');
  const phone = input.value.trim();

  if (!phone) {
    msgEl.innerHTML = '<p class="auth-msg-error">Please enter your phone number.</p>';
    return;
  }

  // Return cached session immediately if same phone
  const cachedPhone = sessionStorage.getItem('userPhone');
  const cachedRole  = sessionStorage.getItem('userRole');
  const cachedInfo  = sessionStorage.getItem('schoolInfo');
  if (cachedPhone === phone && cachedRole && cachedInfo) {
    try {
      const info = JSON.parse(cachedInfo);
      authData = { phone, role: cachedRole, ...info };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));
      applyRoleUI(cachedRole);
      msgEl.innerHTML = `<p class="auth-msg-ok">&#10003; Verified: <strong>${info.organiserName}</strong> &mdash; ${roleLabel(cachedRole)}</p>`;
      if (typeof WelcomeStats !== 'undefined') WelcomeStats.show(authData);
      return;
    } catch (_) {}
  }

  btn.disabled    = true;
  btn.textContent = 'Checking…';
  msgEl.innerHTML = '';

  try {
    const snap = await db.collection('registered_schools')
      .where('phone', '==', phone)
      .limit(1)
      .get();

    if (snap.empty) {
      authData = null;
      clearSession();
      lockAllButtons();
      msgEl.innerHTML = '<p class="auth-msg-error">Not registered. Contact the District JETS Organiser: 0973375828</p>';
      return;
    }

    const d = snap.docs[0].data();
    const docStatus = (d.status || 'Active').trim().toLowerCase();

    if (docStatus === 'inactive') {
      authData = null;
      clearSession();
      lockAllButtons();
      msgEl.innerHTML = '<p class="auth-msg-error">Registration pending. Contact the District JETS Organiser: 0973375828</p>';
      return;
    }

    const schoolInfo = {
      zone:          d.zone          || '',
      schoolName:    d.schoolName    || d.name      || '',
      schoolType:    d.schoolType    || d.type      || '',
      organiserName: d.organiserName || d.organiser || '',
    };

    authData = { phone, role: d.role, ...schoolInfo };

    sessionStorage.setItem('userPhone',   phone);
    sessionStorage.setItem('userRole',    d.role);
    sessionStorage.setItem('schoolInfo',  JSON.stringify(schoolInfo));
    sessionStorage.setItem(SESSION_KEY,   JSON.stringify(authData));

    applyRoleUI(d.role);
    msgEl.innerHTML = `<p class="auth-msg-ok">&#10003; Verified: <strong>${schoolInfo.organiserName}</strong> &mdash; ${roleLabel(d.role)}</p>`;
    if (typeof WelcomeStats !== 'undefined') WelcomeStats.show(authData);

  } catch (err) {
    msgEl.innerHTML = '<p class="auth-msg-error">Connection failed. Check your internet and try again.</p>';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'PROCEED';
  }
}

// ── Role UI ───────────────────────────────────────────────────
function applyRoleUI(role) {
  const schoolBtn = document.getElementById('btn-open-school');
  const zoneBtn   = document.getElementById('btn-open-zone');
  const dashBtn   = document.getElementById('btn-open-dashboard');

  if (role === 'District') {
    enableBtn(schoolBtn);
    enableBtn(zoneBtn);
    dashBtn.classList.remove('hidden');
    enableBtn(dashBtn);
  } else if (role === 'School') {
    schoolClosed() ? disableBtn(schoolBtn) : enableBtn(schoolBtn);
    disableBtn(zoneBtn);
    dashBtn.classList.add('hidden');
    disableBtn(dashBtn);
  } else if (role === 'Zone') {
    disableBtn(schoolBtn);
    (zoneNotOpen() || zoneClosed()) ? disableBtn(zoneBtn) : enableBtn(zoneBtn);
    dashBtn.classList.add('hidden');
    disableBtn(dashBtn);
  } else {
    lockAllButtons();
  }
  applyDeadlineMsgs(role);
}

function enableBtn(btn) {
  btn.disabled = false;
  btn.classList.remove('btn-disabled');
}

function disableBtn(btn) {
  btn.disabled = true;
  btn.classList.add('btn-disabled');
}

function lockAllButtons() {
  const schoolBtn = document.getElementById('btn-open-school');
  const zoneBtn   = document.getElementById('btn-open-zone');
  const dashBtn   = document.getElementById('btn-open-dashboard');
  disableBtn(schoolBtn);
  disableBtn(zoneBtn);
  dashBtn.classList.add('hidden');
  disableBtn(dashBtn);
}

// ── Deadline UI ───────────────────────────────────────────────
function applyDeadlineMsgs(role) {
  const schoolMsg = document.getElementById('school-deadline-msg');
  const zoneMsg   = document.getElementById('zone-deadline-msg');
  if (!schoolMsg || !zoneMsg) return;

  if (role === 'District') {
    schoolMsg.innerHTML = '';
    zoneMsg.innerHTML   = '';
    return;
  }

  schoolMsg.innerHTML = schoolClosed()
    ? `<div class="deadline-closed-notice">School submissions are now closed.<br>
         Contact the District JETS Organiser: 0973375828</div>`
    : '';

  if (zoneNotOpen()) {
    zoneMsg.innerHTML = `<div class="deadline-warn-notice">Zone submissions open on<br>
       ${fmtDlFull(_deadlineZoneOpen)}. Check back then.</div>`;
  } else if (zoneClosed()) {
    zoneMsg.innerHTML = `<div class="deadline-closed-notice">Zone submissions are now closed.<br>
       Contact the District JETS Organiser: 0973375828</div>`;
  } else {
    zoneMsg.innerHTML = '';
  }
}

function showDeadlineClosed(mode) {
  const isSchool = mode === 'school';
  const pageId   = isSchool ? 'page-school' : 'page-zone';
  const label    = isSchool ? 'School Submission' : 'Zone Submission';
  const who      = isSchool ? 'School' : 'Zone';
  showPage(pageId);
  setPageHTML(pageId, `
    <div class="form-topbar">
      <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
      <span class="topbar-title">${label}</span>
    </div>
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <div class="alert alert-error">
          <strong>${who} submissions are now closed.</strong><br>
          Contact the District JETS Organiser: 0973375828
        </div>
        <button class="btn-auth-action btn-back-home" onclick="App.backToLanding()">Back to Home</button>
      </div>
    </div>`);
}

function showDeadlineNotOpen() {
  showPage('page-zone');
  setPageHTML('page-zone', `
    <div class="form-topbar">
      <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
      <span class="topbar-title">Zone Submission</span>
    </div>
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <div class="alert alert-info">
          Zone submissions open on<br>${fmtDlFull(_deadlineZoneOpen)}. Check back then.
        </div>
        <button class="btn-auth-action btn-back-home" onclick="App.backToLanding()">Back to Home</button>
      </div>
    </div>`);
}

// ── Countdown Timers ──────────────────────────────────────────
// Updates every second. Box-style display with days/hrs/mins/secs.
function updateCountdowns() {
  const el = document.getElementById('deadline-countdowns');
  if (!el) return;

  const now = new Date();

  // --- School card ---
  let schoolCard;
  if (now > _deadlineSchoolClose) {
    schoolCard = `
<div class="deadline-card deadline-card-closed">
  <div class="deadline-card-label">School Submissions</div>
  <span class="deadline-badge-closed">CLOSED</span>
  <div class="deadline-period">${fmtDl(_deadlineSchoolOpen)} &ndash; ${fmtDl(_deadlineSchoolClose)}</div>
</div>`;
  } else {
    const ms  = _deadlineSchoolClose - now;
    const cls = timerColorClass(ms);
    const p   = msToParts(ms);
    schoolCard = `
<div class="deadline-card ${cls}">
  <div class="deadline-card-label">School submissions close in:</div>
  ${timerBoxesHTML(p)}
</div>`;
  }

  // --- Zone card ---
  let zoneCard;
  if (now > _deadlineZoneClose) {
    zoneCard = `
<div class="deadline-card deadline-card-closed">
  <div class="deadline-card-label">Zone Submissions</div>
  <span class="deadline-badge-closed">CLOSED</span>
  <div class="deadline-period">${fmtDl(_deadlineZoneOpen)} &ndash; ${fmtDl(_deadlineZoneClose)}</div>
</div>`;
  } else if (now < _deadlineZoneOpen) {
    const ms  = _deadlineZoneOpen - now;
    const cls = timerColorClass(ms);
    const p   = msToParts(ms);
    zoneCard = `
<div class="deadline-card ${cls}">
  <div class="deadline-card-label">Zone submissions open in:</div>
  ${timerBoxesHTML(p)}
</div>`;
  } else {
    const ms  = _deadlineZoneClose - now;
    const cls = timerColorClass(ms);
    const p   = msToParts(ms);
    zoneCard = `
<div class="deadline-card ${cls}">
  <div class="deadline-card-label">Zone submissions close in:</div>
  ${timerBoxesHTML(p)}
</div>`;
  }

  el.innerHTML = schoolCard + zoneCard;
}

function timerBoxesHTML(p) {
  const box = (v, lbl) =>
    `<div class="deadline-box"><span class="deadline-num">${pad2(v)}</span><span class="deadline-unit">${lbl}</span></div>`;
  const sep = `<div class="deadline-sep">:</div>`;
  return `<div class="deadline-boxes">${box(p.d,'DAYS')}${sep}${box(p.h,'HRS')}${sep}${box(p.m,'MINS')}${sep}${box(p.s,'SECS')}</div>`;
}

function msToParts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(t / 86400),
    h: Math.floor((t % 86400) / 3600),
    m: Math.floor((t % 3600) / 60),
    s: t % 60,
  };
}

function timerColorClass(ms) {
  if (ms <= 24 * 3600 * 1000)      return 'timer-red';
  if (ms <= 3 * 24 * 3600 * 1000)  return 'timer-orange';
  return 'timer-green';
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function fmtDl(d) {
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + mo[d.getMonth()];
}

function fmtDlFull(d) {
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear();
}

function roleLabel(role) {
  if (role === 'District') return 'District (full access)';
  if (role === 'School')   return 'School JETS Organiser';
  if (role === 'Zone')     return 'Zonal JETS Coordinator';
  return role;
}

// ── Flow Start ────────────────────────────────────────────────
function startFlow(mode) {
  if (!authData || !authData.phone) {
    const msgEl = document.getElementById('landing-auth-msg');
    msgEl.innerHTML = '<p class="auth-msg-error">Please verify your phone number first.</p>';
    document.getElementById('landing-phone').focus();
    return;
  }

  const role = authData.role;

  if (mode === 'school' && role !== 'School' && role !== 'District') {
    showAccessDenied('school'); return;
  }
  if (mode === 'zone' && role !== 'Zone' && role !== 'District') {
    showAccessDenied('zone'); return;
  }
  if (mode === 'dashboard' && role !== 'District') {
    showAccessDenied('dashboard'); return;
  }

  if (role !== 'District') {
    if (mode === 'school' && schoolClosed()) {
      showDeadlineClosed('school'); return;
    }
    if (mode === 'zone' && zoneNotOpen()) {
      showDeadlineNotOpen(); return;
    }
    if (mode === 'zone' && zoneClosed()) {
      showDeadlineClosed('zone'); return;
    }
  }

  currentMode = mode;

  if (mode === 'school') {
    setThemeColor('#1a5c2a');
    showPage('page-school');
    SchoolForm.render('page-school', authData);
  } else if (mode === 'zone') {
    setThemeColor('#1a3c6e');
    showPage('page-zone');
    ZoneForm.render('page-zone', authData);
  } else if (mode === 'dashboard') {
    setThemeColor('#1a3c6e');
    showPage('page-dashboard');
    Dashboard.render('page-dashboard', authData);
  }
}

function showAccessDenied(attemptedMode) {
  const pageMap  = { school: 'page-school', zone: 'page-zone', dashboard: 'page-dashboard' };
  const labelMap = { school: 'School Submission', zone: 'Zone Submission', dashboard: 'District Dashboard' };
  const pageId   = pageMap[attemptedMode];
  const label    = labelMap[attemptedMode];
  const role     = authData ? authData.role : '';

  let msg;
  if (role === 'School') {
    msg = 'Unauthorized. You are registered as a School JETS Organiser and may only access the School Submission form.';
  } else if (role === 'Zone') {
    msg = 'Unauthorized. You are registered as a Zonal JETS Coordinator and may only access the Zone Submission form.';
  } else {
    msg = 'Unauthorized. Access denied.';
  }

  showPage(pageId);
  setPageHTML(pageId, `
    <div class="form-topbar">
      <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
      <span class="topbar-title">${label}</span>
    </div>
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <div class="alert alert-error">${msg}</div>
        <button class="btn-auth-action btn-back-home" onclick="App.backToLanding()">Back to Home</button>
      </div>
    </div>`);
}


// ── Navigation ────────────────────────────────────────────────
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  window.scrollTo(0, 0);
}

function setPageHTML(pageId, html) {
  document.getElementById(pageId).innerHTML = html;
}

function backToLanding() {
  if (typeof Dashboard !== 'undefined') Dashboard.destroy();
  currentMode = null;
  setThemeColor('#1a5c2a');
  showPage('page-landing');
}

function setThemeColor(color) {
  const meta = document.getElementById('meta-theme-color');
  if (meta) meta.setAttribute('content', color);
  
  // Dynamic browser title bar updates
  if (color === '#1a5c2a') {
    document.title = currentMode === 'school' ? 'School Submission | JETS 2026' : 'JETS 2026 | Lavushimanda District';
  } else if (color === '#1a3c6e') {
    document.title = currentMode === 'zone' ? 'Zone Submission | JETS 2026' : 'District Dashboard | JETS 2026';
  }
}

function signOut() {
  clearSession();
  authData = null;
  lockAllButtons();
  document.getElementById('landing-phone').value = '';
  document.getElementById('landing-auth-msg').innerHTML = '';
  if (typeof WelcomeStats !== 'undefined') WelcomeStats.hide();
  backToLanding();
}

function maskPhone(phone) {
  if (!phone) return phone;
  if (phone.length <= 4) return '****';
  return phone.slice(0, 3) + '****' + phone.slice(-2);
}

// ── Public API ────────────────────────────────────────────────
const App = {
  startFlow,
  verifyPhone,
  backToLanding,
  signOut,
  maskPhone,
  maskGmail: maskPhone,
  showPage,
  setPageHTML,
  loadDeadlines,
  setDeadlines(dl) {
    applyDeadlines(dl);
  },
  get deadlines() {
    return {
      School_Open:  _deadlineSchoolOpen.toISOString().slice(0, 19),
      School_Close: _deadlineSchoolClose.toISOString().slice(0, 19),
      Zone_Open:    _deadlineZoneOpen.toISOString().slice(0, 19),
      Zone_Close:   _deadlineZoneClose.toISOString().slice(0, 19),
    };
  },
  get authData()    { return authData; },
  get currentMode() { return currentMode; },
};
