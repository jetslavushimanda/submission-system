// ── Global UI helpers ─────────────────────────────────────────
function showSpinner() { document.getElementById('spinner').classList.add('active'); }
function hideSpinner() { document.getElementById('spinner').classList.remove('active'); }

let _toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'active ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = ''; }, 4000);
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Confirm dialog ────────────────────────────────────────────
function showConfirm(msg, onYes) {
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmOverlay').classList.add('open');
  const yes = document.getElementById('confirmYes');
  const no  = document.getElementById('confirmNo');
  const close = () => document.getElementById('confirmOverlay').classList.remove('open');
  yes.onclick = () => { close(); onYes(); };
  no.onclick  = close;
}

// ── Session ───────────────────────────────────────────────────
function getUser() {
  try { return JSON.parse(sessionStorage.getItem('jets_user')); } catch { return null; }
}
function setUser(u) { sessionStorage.setItem('jets_user', JSON.stringify(u)); }
function clearUser() { sessionStorage.removeItem('jets_user'); }

// ── Login ─────────────────────────────────────────────────────
async function login(phone) {
  showSpinner();
  const errEl = document.getElementById('loginError');
  errEl.classList.remove('show');
  try {
    const snap = await db.collection('registration').where('phone', '==', phone).get();
    if (snap.empty) {
      errEl.textContent = 'Not registered. Contact the District JETS Organiser: 0973375828';
      errEl.classList.add('show');
      return;
    }
    const user = { id: snap.docs[0].id, ...snap.docs[0].data() };
    if (user.status !== 'Active') {
      errEl.textContent = 'Registration pending. Contact the District JETS Organiser: 0973375828';
      errEl.classList.add('show');
      return;
    }
    setUser(user);
    loadByRole(user);
  } catch (err) {
    errEl.textContent = 'Connection failed. Check internet and try again.';
    errEl.classList.add('show');
  } finally {
    hideSpinner();
  }
}

function loadByRole(user) {
  if (user.role === 'School')   { initSchool(user);   showPage('page-school'); }
  if (user.role === 'Zone')     { initZone(user);     showPage('page-zone'); }
  if (user.role === 'District') { initDistrict(user); showPage('page-district'); }
}

function signOut() {
  clearUser();
  document.getElementById('phoneInput').value = '';
  document.getElementById('loginError').classList.remove('show');
  showPage('page-landing');
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Resume session
  const user = getUser();
  if (user) { loadByRole(user); return; }

  // Landing bindings
  const inp = document.getElementById('phoneInput');
  const btn = document.getElementById('btnProceed');

  btn.addEventListener('click', () => {
    const phone = inp.value.trim();
    if (!phone) {
      const e = document.getElementById('loginError');
      e.textContent = 'Enter your phone number.';
      e.classList.add('show');
      return;
    }
    login(phone);
  });

  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') btn.click();
  });

  // Sign out buttons
  document.getElementById('schoolSignOut').addEventListener('click', signOut);
  document.getElementById('zoneSignOut').addEventListener('click', signOut);
  document.getElementById('districtSignOut').addEventListener('click', signOut);
});
