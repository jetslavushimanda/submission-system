// ═══════════════════════════════════════════════════════════════
// app.js — Phone auth, role-based access, routing
// JETS 2024-2026 | Lavushimanda District
// ═══════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYd7lQYJ8ylREFy7dLZRkMfT3BjN-_FX6cTdPg4OG-aDK2U-dCl0E5-Q8wNNGxQ0lurw/exec";

const SESSION_KEY = "jets_session";

let currentMode = null;
let authData    = null;

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open-school').addEventListener('click',    () => App.startFlow('school'));
  document.getElementById('btn-open-zone').addEventListener('click',      () => App.startFlow('zone'));
  document.getElementById('btn-open-dashboard').addEventListener('click', () => App.startFlow('dashboard'));
  document.getElementById('btn-verify').addEventListener('click', App.verifyPhone);
  document.getElementById('landing-phone').addEventListener('keydown', e => {
    if (e.key === 'Enter') App.verifyPhone();
  });

  // Restore session if available
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      authData = JSON.parse(stored);
      if (authData && authData.phone && authData.role) {
        applyRoleUI(authData.role);
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
    enableBtn(schoolBtn);
    enableBtn(zoneBtn);
    dashBtn.classList.remove('hidden');
    enableBtn(dashBtn);
  } else if (role === 'School') {
    enableBtn(schoolBtn);
    disableBtn(zoneBtn);
    dashBtn.classList.add('hidden');
    disableBtn(dashBtn);
  } else if (role === 'Zone') {
    disableBtn(schoolBtn);
    enableBtn(zoneBtn);
    dashBtn.classList.add('hidden');
    disableBtn(dashBtn);
  } else {
    lockAllButtons();
  }
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
