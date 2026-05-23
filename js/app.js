// ═══════════════════════════════════════════════════════════════
// app.js — Google Sign-In, auth routing, page orchestration
// JETS 2024-2026 | Lavushimanda District
//
// SETUP (DEC must fill in both values before deploying):
//   APPS_SCRIPT_URL  — paste the deployed Web App URL from Apps Script
//   GOOGLE_CLIENT_ID — paste the OAuth 2.0 Client ID from Google Cloud Console
// ═══════════════════════════════════════════════════════════════

const APPS_SCRIPT_URL  = "YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE";

const SESSION_KEY = "jets_session";

let currentMode = null;   // 'school' | 'zone'
let authData    = null;   // { gmail, zone, schoolName, schoolType, organiserName, phone }

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-open-school').addEventListener('click', () => App.startFlow('school'));
  document.getElementById('btn-open-zone').addEventListener('click',  () => App.startFlow('zone'));
  document.getElementById('btn-signin-cancel').addEventListener('click', App.cancelSignIn);

  // Restore session if the user already authenticated this browser session
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try { authData = JSON.parse(stored); } catch (_) { sessionStorage.removeItem(SESSION_KEY); }
  }

  // If GSI loaded before this script ran, init now; otherwise the
  // window.onGoogleLibraryLoad callback (set in index.html) will call initGSI().
  if (window.google && window.google.accounts) {
    App.initGSI();
  } else if (window._gsiPending) {
    App.initGSI();
  }
});

// ── GSI Initialisation ────────────────────────────────────────
function initGSI() {
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredential,
    auto_select: false,
    cancel_on_tap_outside: false,
    itp_support: true,
  });
  window._gsiReady = true;
}

// ── Flow Start ────────────────────────────────────────────────
function startFlow(mode) {
  currentMode = mode;

  // Already have a verified session — go straight to registration check
  if (authData && authData.gmail) {
    checkRegistration(authData.gmail);
    return;
  }

  showSignInOverlay(mode);
}

// ── Sign-In Overlay ───────────────────────────────────────────
function showSignInOverlay(mode) {
  const overlay = document.getElementById('signin-overlay');
  const badge   = document.getElementById('signin-mode-badge');
  const loading = document.getElementById('signin-gsi-loading');
  const btnWrap = document.getElementById('google-signin-btn');

  badge.textContent = mode === 'school' ? 'School Submission' : 'Zone Submission';
  badge.className   = 'signin-mode-badge ' + (mode === 'school' ? 'badge-school' : 'badge-zone');

  btnWrap.innerHTML = '';
  overlay.classList.remove('hidden');

  if (window._gsiReady) {
    loading.classList.add('hidden');
    google.accounts.id.renderButton(btnWrap, {
      theme: 'outline',
      size:  'large',
      width: 260,
      text:  'signin_with',
      shape: 'rectangular',
    });
  } else {
    // GSI still loading (very slow connection) — show fallback text
    loading.classList.remove('hidden');
    // Retry every 500 ms until ready
    const wait = setInterval(() => {
      if (window._gsiReady) {
        clearInterval(wait);
        loading.classList.add('hidden');
        btnWrap.innerHTML = '';
        google.accounts.id.renderButton(btnWrap, {
          theme: 'outline', size: 'large', width: 260, text: 'signin_with', shape: 'rectangular',
        });
      }
    }, 500);
  }
}

function cancelSignIn() {
  document.getElementById('signin-overlay').classList.add('hidden');
  currentMode = null;
}

// ── Credential Handler (GSI callback) ─────────────────────────
function handleCredential(response) {
  document.getElementById('signin-overlay').classList.add('hidden');

  // Decode JWT to extract email — validation happens server-side via Tab 1 lookup
  let gmail;
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    gmail = payload.email;
  } catch (_) {
    showPageError('Could not read your Google account. Please try again.');
    return;
  }

  authData = { gmail };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));

  checkRegistration(gmail);
}

// ── Registration Check ────────────────────────────────────────
async function checkRegistration(gmail) {
  const pageId = currentMode === 'school' ? 'page-school' : 'page-zone';
  showPage(pageId);
  setPageHTML(pageId, buildLoadingHTML(gmail));

  try {
    // CORS note: no Content-Type header = text/plain request = no preflight needed.
    // Apps Script deployed as "Anyone" returns Access-Control-Allow-Origin: * automatically.
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'checkAuth', gmail, formType: currentMode }),
    });

    if (!res.ok) throw new Error(`Server responded ${res.status}`);

    const data = await res.json();

    if (data.status === 'found') {
      authData = { gmail, ...data };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(authData));

      if (currentMode === 'school') {
        SchoolForm.render(pageId, authData);
      } else {
        ZoneForm.render(pageId, authData);
      }

    } else {
      const errMsg = data.reason === 'inactive'
        ? (data.message || 'Your account has been deactivated. Contact the District JETS Organiser.')
        : 'Your Gmail is not registered. Contact the District JETS Organiser.';
      setPageHTML(pageId, buildAuthErrorHTML(gmail, errMsg, false));
    }

  } catch (_) {
    setPageHTML(pageId, buildAuthErrorHTML(
      gmail,
      'Connection failed. Check your internet and try again.',
      true
    ));
  }
}

// ── HTML Builders ─────────────────────────────────────────────
function buildLoadingHTML(gmail) {
  return `
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <p class="auth-gmail-pill">${maskGmail(gmail)}</p>
        <div class="auth-checking">
          <div class="spinner-dark"></div>
          <p class="auth-checking-text">Checking registration&hellip;</p>
        </div>
      </div>
    </div>`;
}

function buildAuthErrorHTML(gmail, message, isNetworkError) {
  const modeLabel = currentMode === 'school' ? 'School Submission' : 'Zone Submission';
  return `
    <div class="form-topbar">
      <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
      <span class="topbar-title">${modeLabel}</span>
    </div>
    <div class="auth-status-wrap">
      <div class="auth-status-card">
        <p class="auth-gmail-pill">${maskGmail(gmail)}</p>
        <div class="alert alert-error">${message}</div>
        ${isNetworkError
          ? `<button class="btn-auth-action btn-retry" onclick="App.retryCheck()">Try Again</button>`
          : ''}
        <button class="btn-auth-action btn-signout-text" onclick="App.signOut()">
          Sign out &amp; use a different account
        </button>
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
  if (authData && authData.gmail) checkRegistration(authData.gmail);
}

function signOut() {
  sessionStorage.removeItem(SESSION_KEY);
  authData = null;
  if (window.google && window.google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  backToLanding();
}

function showPageError(msg) {
  alert(msg); // fallback for critical decode errors
}

// ── Utilities ─────────────────────────────────────────────────
function maskGmail(gmail) {
  if (!gmail || !gmail.includes('@')) return gmail;
  const [name, domain] = gmail.split('@');
  return name.charAt(0) + '***@' + domain;
}

// ── Public API (called from inline HTML and other JS files) ───
const App = {
  initGSI,
  startFlow,
  cancelSignIn,
  backToLanding,
  retryCheck,
  signOut,
  maskGmail,
  showPage,
  setPageHTML,
  get authData() { return authData; },
  get currentMode() { return currentMode; },
};
