// ═══════════════════════════════════════════════════════════════
// app.js — Phone auth, routing, page orchestration
// JETS 2024-2026 | Lavushimanda District
// ═══════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzYd7lQYJ8ylREFy7dLZRkMfT3BjN-_FX6cTdPg4OG-aDK2U-dCl0E5-Q8wNNGxQ0lurw/exec";

const SESSION_KEY = "jets_session";

let currentMode = null;
let authData    = null;

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open-school').addEventListener('click', () => App.startFlow('school'));
  document.getElementById('btn-open-zone').addEventListener('click',  () => App.startFlow('zone'));
  document.getElementById('btn-signin-cancel').addEventListener('click', App.cancelSignIn);
  document.getElementById('btn-phone-submit').addEventListener('click', App.submitPhone);
  document.getElementById('phone-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') App.submitPhone();
  });

  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try { authData = JSON.parse(stored); } catch (_) { sessionStorage.removeItem(SESSION_KEY); }
  }
});

// ── Flow Start ────────────────────────────────────────────────
function startFlow(mode) {
  currentMode = mode;

  if (authData && authData.phone) {
    checkRegistration(authData.phone);
    return;
  }

  showSignInOverlay(mode);
}

// ── Phone Overlay ─────────────────────────────────────────────
function showSignInOverlay(mode) {
  const overlay = document.getElementById('signin-overlay');
  const badge   = document.getElementById('signin-mode-badge');

  badge.textContent = mode === 'school' ? 'School Submission' : 'Zone Submission';
  badge.className   = 'signin-mode-badge ' + (mode === 'school' ? 'badge-school' : 'badge-zone');

  document.getElementById('phone-input').value = '';
  document.getElementById('phone-error').textContent = '';
  overlay.classList.remove('hidden');
  setTimeout(() => document.getElementById('phone-input').focus(), 100);
}

function cancelSignIn() {
  document.getElementById('signin-overlay').classList.add('hidden');
  currentMode = null;
}

function submitPhone() {
  const input   = document.getElementById('phone-input');
  const errorEl = document.getElementById('phone-error');
  const phone   = input.value.trim();

  if (!phone) {
    errorEl.textContent = 'Please enter your phone number.';
    return;
  }

  errorEl.textContent = '';
  document.getElementById('signin-overlay').classList.add('hidden');

  authData = { phone };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));
  checkRegistration(phone);
}

// ── Registration Check ────────────────────────────────────────
async function checkRegistration(phone) {
  const pageId = currentMode === 'school' ? 'page-school' : 'page-zone';
  showPage(pageId);
  setPageHTML(pageId, buildLoadingHTML(phone));

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'checkAuth', phone, formType: currentMode }),
    });

    if (!res.ok) throw new Error(`Server responded ${res.status}`);

    const data = await res.json();

    if (data.status === 'found') {
      authData = { phone, ...data };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));

      if (currentMode === 'school') {
        SchoolForm.render(pageId, authData);
      } else {
        ZoneForm.render(pageId, authData);
      }

    } else {
      const errMsg = data.reason === 'inactive'
        ? (data.message || 'Your registration is pending. Contact the District JETS Organiser: Mwansa Gibson — 0973375828')
        : 'Your phone number is not registered. Contact the District JETS Organiser: Mwansa Gibson — 0973375828';
      setPageHTML(pageId, buildAuthErrorHTML(phone, errMsg, false));
    }

  } catch (_) {
    setPageHTML(pageId, buildAuthErrorHTML(
      phone,
      'Connection failed. Check your internet and try again.',
      true
    ));
  }
}

// ── HTML Builders ─────────────────────────────────────────────
function buildLoadingHTML(phone) {
  return `
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <p class="auth-gmail-pill">${maskPhone(phone)}</p>
        <div class="auth-checking">
          <div class="spinner-dark"></div>
          <p class="auth-checking-text">Checking registration&hellip;</p>
        </div>
      </div>
    </div>`;
}

function buildAuthErrorHTML(phone, message, isNetworkError) {
  const modeLabel = currentMode === 'school' ? 'School Submission' : 'Zone Submission';
  return `
    <div class="form-topbar">
      <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
      <span class="topbar-title">${modeLabel}</span>
    </div>
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <p class="auth-gmail-pill">${maskPhone(phone)}</p>
        <div class="alert alert-error">${message}</div>
        ${isNetworkError
          ? `<button class="btn-auth-action btn-retry" onclick="App.retryCheck()">Try Again</button>`
          : ''}
        <button class="btn-auth-action btn-back-home" onclick="App.backToLanding()">
          Back to Home
        </button>
      </div>
    </div>`;
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
  currentMode = null;
  showPage('page-landing');
}

function retryCheck() {
  if (authData && authData.phone) checkRegistration(authData.phone);
}

function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
  authData = null;
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
  cancelSignIn,
  submitPhone,
  backToLanding,
  retryCheck,
  signOut,
  maskPhone,
  maskGmail: maskPhone,
  showPage,
  setPageHTML,
  get authData() { return authData; },
  get currentMode() { return currentMode; },
};
