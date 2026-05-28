// welcome-stats.js — Post-login statistics summary card
// JETS 2024-2026 | Lavushimanda District

const WelcomeStats = (() => {

  const CACHE_PREFIX = 'jets_ws_';
  let _auth = null;
  let _retryTimer = null;

  function cacheKey() { return CACHE_PREFIX + (_auth ? _auth.phone : ''); }

  // ── Public: show after login ───────────────────────────────────
  function show(auth) {
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    _auth = auth;
    const container = document.getElementById('welcome-stats-container');
    if (!container) return;

    if (auth.role !== 'School' && auth.role !== 'Zone') {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    try {
      const cached = sessionStorage.getItem(cacheKey());
      if (cached) { _render(JSON.parse(cached)); return; }
    } catch (_) {}

    _skeleton();
    _fetch();
  }

  // ── Public: refresh after successful submission ───────────────
  function refresh() {
    if (!_auth) return;
    try { sessionStorage.removeItem(cacheKey()); } catch (_) {}
    _fetch();
  }

  // ── Public: hide on sign-out ──────────────────────────────────
  function hide() {
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    _auth = null;
    const container = document.getElementById('welcome-stats-container');
    if (container) { container.classList.add('hidden'); container.innerHTML = ''; }
  }

  // ── Fetch ─────────────────────────────────────────────────────
  async function _fetch() {
    const container = document.getElementById('welcome-stats-container');
    if (!container || !_auth) return;
    
    if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
    
    if (!container.querySelector('.ws-skeleton') && !container.querySelector('.ws-greet')) {
      _skeleton();
    }
    
    try {
      const data = await FirestoreDB.getWelcomeStats(
        _auth.phone, _auth.role, _auth.zone, _auth.schoolName
      );
      if (data.status !== 'ok') throw new Error(data.message || 'Failed');
      try { sessionStorage.setItem(cacheKey(), JSON.stringify(data)); } catch (_) {}
      _render(data);
    } catch (_) {
      _renderError();
    }
  }

  // ── Skeleton ──────────────────────────────────────────────────
  function _skeleton() {
    const c = document.getElementById('welcome-stats-container');
    if (!c) return;
    c.innerHTML = `
      <div class="ws-card ws-loading-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 180px; padding: 24px;">
        <div class="spinner-dark"></div>
        <p style="margin-top: 16px; font-size: 14px; color: var(--text-muted); font-weight: 500;">Loading statistics&#8230;</p>
      </div>`;
  }

  function _renderError() {
    const c = document.getElementById('welcome-stats-container');
    if (!c || !_auth) return;
    
    // Ensure skeleton is displayed silently if it failed
    if (!c.querySelector('.ws-skeleton')) {
      _skeleton();
    }
    c.classList.remove('hidden');
    
    // Schedule silent retry every 30s
    if (_retryTimer) clearTimeout(_retryTimer);
    _retryTimer = setTimeout(() => {
      _fetch();
    }, 30000);
  }

  // ── Render dispatch ───────────────────────────────────────────
  function _render(data) {
    if (!_auth) return;
    if (data.role === 'School') _renderSchool(data);
    else if (data.role === 'Zone') _renderZone(data);
  }

  // ── School welcome card ───────────────────────────────────────
  function _renderSchool(data) {
    const c = document.getElementById('welcome-stats-container');
    if (!c) return;

    const slotTotal   = (typeof SLOT_TOTALS !== 'undefined' && SLOT_TOTALS[_auth.schoolType]) || 30;
    const dlIso       = (typeof App !== 'undefined' && App.deadlines) ? App.deadlines.School_Close : null;
    const dlDays      = dlIso ? _daysUntil(dlIso) : null;
    const dlText      = dlDays === null ? ''
                      : dlDays < 0  ? 'School deadline has passed'
                      : dlDays === 0 ? 'School deadline: TODAY!'
                      : `School deadline in: ${dlDays} day${dlDays !== 1 ? 's' : ''}`;

    const needsSkills = (_auth.schoolType === 'Secondary School' || _auth.schoolType === 'Private School');
    const missing = [];
    if (data.innovations === 0) missing.push('Innovations');
    if (data.academics   === 0) missing.push('Academics');
    if (needsSkills && data.skills === 0) missing.push('Technical Skills');

    const missingHtml = missing.length
      ? `<div class="ws-section">
           <div class="ws-section-lbl">CATEGORIES NOT YET SUBMITTED:</div>
           ${missing.map(m => `<div class="ws-miss-item">&#8226; ${_esc(m)}</div>`).join('')}
         </div>`
      : `<div class="ws-all-done">&#10003; All categories submitted!</div>`;

    c.classList.remove('hidden');
    c.innerHTML = `
      <div class="ws-card ws-card-school">
        <div class="ws-greet">Welcome ${_esc(_auth.organiserName)}.</div>
        <div class="ws-sub">Tap a section below to start submitting participants for ${_esc(_auth.schoolName)}.</div>
        <div class="ws-div"></div>
        <div class="ws-hdr">YOUR SUBMISSION SUMMARY:</div>
        <div class="ws-rule"></div>
        <div class="ws-row">
          <span class="ws-lbl">Total Submitted:</span>
          <span class="ws-val${data.total >= slotTotal ? ' ws-full' : ''}">${data.total} of ${slotTotal} slots</span>
        </div>
        <div class="ws-row">
          <span class="ws-lbl">Innovations:</span>
          <span class="ws-val">${data.innovations} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-lbl">Academics:</span>
          <span class="ws-val">${data.academics} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-lbl">Skills:</span>
          <span class="ws-val">${data.skills} submitted</span>
        </div>
        ${missingHtml}
        ${dlText ? `<div class="ws-rule"></div><div class="ws-deadline${dlDays !== null && dlDays >= 0 && dlDays <= 2 ? ' ws-dl-urgent' : ''}">${dlText}</div>` : ''}
      </div>`;
  }

  // ── Zone welcome card ─────────────────────────────────────────
  function _renderZone(data) {
    const c = document.getElementById('welcome-stats-container');
    if (!c) return;

    const ZONE_TOTAL = 64;
    const dlIso   = (typeof App !== 'undefined' && App.deadlines) ? App.deadlines.Zone_Close : null;
    const dlDays  = dlIso ? _daysUntil(dlIso) : null;
    const dlText  = dlDays === null ? ''
                  : dlDays < 0  ? 'Zone deadline has passed'
                  : dlDays === 0 ? 'Zone deadline: TODAY!'
                  : `Zone deadline in: ${dlDays} day${dlDays !== 1 ? 's' : ''}`;

    const allSchools   = (typeof ZONES !== 'undefined' && ZONES[_auth.zone])
                         ? ZONES[_auth.zone].schools.map(s => s.name) : [];
    const submitted    = new Set(data.submittedSchools || []);
    const notSubmitted = allSchools.filter(s => !submitted.has(s));

    const notSubmHtml = notSubmitted.length
      ? `<div class="ws-section">
           <div class="ws-section-lbl">SCHOOLS NOT YET SUBMITTED:</div>
           ${notSubmitted.map(s => `<div class="ws-miss-item">&#8226; ${_esc(s)}</div>`).join('')}
         </div>`
      : `<div class="ws-all-done">&#10003; All schools have submitted!</div>`;

    c.classList.remove('hidden');
    c.innerHTML = `
      <div class="ws-card ws-card-zone">
        <div class="ws-greet">Welcome ${_esc(_auth.organiserName)}.</div>
        <div class="ws-sub">Tap a section below to start submitting participants for ${_esc(_auth.zone)} Zone.</div>
        <div class="ws-div"></div>
        <div class="ws-hdr">ZONE SUBMISSION SUMMARY:</div>
        <div class="ws-rule"></div>
        <div class="ws-row">
          <span class="ws-lbl">Total Submitted:</span>
          <span class="ws-val${data.total >= ZONE_TOTAL ? ' ws-full' : ''}">${data.total} of ${ZONE_TOTAL} slots</span>
        </div>
        <div class="ws-row">
          <span class="ws-lbl">Innovations:</span>
          <span class="ws-val">${data.innovations} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-lbl">Academics:</span>
          <span class="ws-val">${data.academics} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-lbl">Skills:</span>
          <span class="ws-val">${data.skills} submitted</span>
        </div>
        ${notSubmHtml}
        ${dlText ? `<div class="ws-rule"></div><div class="ws-deadline${dlDays !== null && dlDays >= 0 && dlDays <= 2 ? ' ws-dl-urgent' : ''}">${dlText}</div>` : ''}
      </div>`;
  }

  // ── Helpers ───────────────────────────────────────────────────
  function _daysUntil(iso) {
    return Math.ceil((new Date(iso) - new Date()) / 86400000);
  }

  function _esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { show, refresh, hide };

})();
