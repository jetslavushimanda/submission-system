// ═══════════════════════════════════════════════════════════════
// app.js — Phone auth, role-based access, routing
// JETS 2024-2026 | Lavushimanda District
// ═══════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYd7lQYJ8ylREFy7dLZRkMfT3BjN-_FX6cTdPg4OG-aDK2U-dCl0E5-Q8wNNGxQ0lurw/exec";

const SESSION_KEY = "jets_session";

// ── Submission Deadlines ──────────────────────────────────────
const SCHOOL_DEADLINE = "2026-05-30T23:59:00";
const ZONE_OPEN       = "2026-06-01T00:00:00";
const ZONE_DEADLINE   = "2026-06-05T23:59:00";

function schoolClosed() { return new Date() > new Date(SCHOOL_DEADLINE); }
function zoneNotOpen()  { return new Date() < new Date(ZONE_OPEN); }
function zoneClosed()   { return new Date() > new Date(ZONE_DEADLINE); }

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
      b.textContent = '⚠️ You are offline. Do not submit until reconnected.';
      const sub = document.getElementById('sf-submit');
      if (sub) sub.disabled = true;
    } else {
      b.className  = 'net-banner net-banner-online';
      b.textContent = '✅ Connected. You can submit now.';
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
  setInterval(updateCountdowns, 60000);

  // Restore session if available
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      authData = JSON.parse(stored);
      if (authData && authData.phone && authData.role) {
        applyRoleUI(authData.role);
        if (typeof WelcomeStats !== 'undefined') WelcomeStats.show(authData);
      }
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }
});

// ── Phone Verification ────────────────────────────────────────
async function verifyPhone() {
  const input   = document.getElementById('landing-phone');
  const msgEl   = document.getElementById('landing-auth-msg');
  const btn     = document.getElementById('btn-verify');
  const phone   = input.value.trim();

  if (!phone) {
    msgEl.innerHTML = '<p class="auth-msg-error">Please enter your phone number.</p>';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Checking…';
  msgEl.innerHTML = '';

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'checkAuth', phone }),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    const data = await res.json();

    if (data.status === 'found') {
      authData = { phone, ...data };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));
      applyRoleUI(data.role);
      msgEl.innerHTML = `<p class="auth-msg-ok">&#10003; Verified: <strong>${data.organiserName}</strong> &mdash; ${roleLabel(data.role)}</p>`;
      if (typeof WelcomeStats !== 'undefined') WelcomeStats.show(authData);

    } else if (data.reason === 'inactive') {
      authData = null;
      sessionStorage.removeItem(SESSION_KEY);
      lockAllButtons();
      msgEl.innerHTML = '<p class="auth-msg-error">Registration pending. Contact Mwansa Gibson: 0973375828</p>';

    } else {
      authData = null;
      sessionStorage.removeItem(SESSION_KEY);
      lockAllButtons();
      msgEl.innerHTML = '<p class="auth-msg-error">Not registered. Contact Mwansa Gibson: 0973375828</p>';
    }

  } catch (_) {
    msgEl.innerHTML = '<p class="auth-msg-error">Connection failed. Check your internet and try again.</p>';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Verify';
  }
}

// ── Role UI ───────────────────────────────────────────────────
// Enables/disables/shows/hides the three landing buttons based on role.
// Disabled buttons are truly disabled (not just visually greyed).
function applyRoleUI(role) {
  const schoolBtn = document.getElementById('btn-open-school');
  const zoneBtn   = document.getElementById('btn-open-zone');
  const dashBtn   = document.getElementById('btn-open-dashboard');

  if (role === 'District') {
    // District always has full access regardless of deadlines
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
         Submission period was 26–30 May 2026.<br>
         Contact Mwansa Gibson: 0973375828</div>`
    : '';

  if (zoneNotOpen()) {
    zoneMsg.innerHTML = `<div class="deadline-warn-notice">Zone submissions open on<br>
       1st June 2026. Check back then.</div>`;
  } else if (zoneClosed()) {
    zoneMsg.innerHTML = `<div class="deadline-closed-notice">Zone submissions are now closed.<br>
       Submission period was 1–5 June 2026.<br>
       Contact Mwansa Gibson: 0973375828</div>`;
  } else {
    zoneMsg.innerHTML = '';
  }
}

function showDeadlineClosed(mode) {
  const isSchool = mode === 'school';
  const pageId   = isSchool ? 'page-school' : 'page-zone';
  const label    = isSchool ? 'School Submission' : 'Zone Submission';
  const period   = isSchool ? '26–30 May 2026'    : '1–5 June 2026';
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
          Submission period was ${period}.<br>
          Contact Mwansa Gibson: 0973375828
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
          Zone submissions open on<br>1st June 2026. Check back then.
        </div>
        <button class="btn-auth-action btn-back-home" onclick="App.backToLanding()">Back to Home</button>
      </div>
    </div>`);
}

// ── Countdown Timers ──────────────────────────────────────────
function updateCountdowns() {
  const el = document.getElementById('deadline-countdowns');
  if (!el) return;

  const now        = new Date();
  const schoolDl   = new Date(SCHOOL_DEADLINE);
  const zoneOpenDt = new Date(ZONE_OPEN);
  const zoneDl     = new Date(ZONE_DEADLINE);

  let schoolCard;
  if (now > schoolDl) {
    schoolCard = `
      <div class="deadline-card">
        <div class="deadline-card-label">School Submissions</div>
        <span class="deadline-badge-closed">CLOSED</span>
        <div class="deadline-period">26–30 May 2026</div>
      </div>`;
  } else {
    const { days, hours, minutes, colorClass } = diffParts(schoolDl - now);
    schoolCard = `
      <div class="deadline-card">
        <div class="deadline-card-label">School submissions close in:</div>
        <div class="deadline-timer ${colorClass}">${days}d ${hours}h ${minutes}m</div>
      </div>`;
  }

  let zoneCard;
  if (now > zoneDl) {
    zoneCard = `
      <div class="deadline-card">
        <div class="deadline-card-label">Zone Submissions</div>
        <span class="deadline-badge-closed">CLOSED</span>
        <div class="deadline-period">1–5 June 2026</div>
      </div>`;
  } else if (now < zoneOpenDt) {
    const { days, colorClass } = diffParts(zoneOpenDt - now);
    zoneCard = `
      <div class="deadline-card">
        <div class="deadline-card-label">Zone submissions open in:</div>
        <div class="deadline-timer ${colorClass}">${days} day${days !== 1 ? 's' : ''}</div>
      </div>`;
  } else {
    const { days, hours, minutes, colorClass } = diffParts(zoneDl - now);
    zoneCard = `
      <div class="deadline-card">
        <div class="deadline-card-label">Zone submissions close in:</div>
        <div class="deadline-timer ${colorClass}">${days}d ${hours}h ${minutes}m</div>
      </div>`;
  }

  el.innerHTML = schoolCard + zoneCard;
}

function diffParts(ms) {
  const total   = Math.max(0, Math.floor(ms / 60000));
  const days    = Math.floor(total / 1440);
  const hours   = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  const colorClass = ms <= 24 * 60 * 60 * 1000   ? 'timer-red'
                   : ms <= 3 * 24 * 60 * 60 * 1000 ? 'timer-orange'
                   : 'timer-green';
  return { days, hours, minutes, colorClass };
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

  // Backend-mirrored role check — blocks any client-side bypass attempt.
  if (mode === 'school' && role !== 'School' && role !== 'District') {
    showAccessDenied('school'); return;
  }
  if (mode === 'zone' && role !== 'Zone' && role !== 'District') {
    showAccessDenied('zone'); return;
  }
  if (mode === 'dashboard' && role !== 'District') {
    showAccessDenied('dashboard'); return;
  }

  // Deadline guard — District bypasses all deadline restrictions
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
    showPage('page-school');
    SchoolForm.render('page-school', authData);
  } else if (mode === 'zone') {
    showPage('page-zone');
    ZoneForm.render('page-zone', authData);
  } else if (mode === 'dashboard') {
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
    msg = 'Unauthorized. Access denied. You are registered as a School JETS Organiser and may only access the School Submission form.';
  } else if (role === 'Zone') {
    msg = 'Unauthorized. Access denied. You are registered as a Zonal JETS Coordinator and may only access the Zone Submission form.';
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
  showPage('page-landing');
}

function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
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
  get authData()    { return authData; },
  get currentMode() { return currentMode; },
};
