// welcome-stats.js — Post-login statistics summary card
// JETS 2024-2026 | Lavushimanda District

const WelcomeStats = (() => {

  const CACHE_PREFIX = 'jets_ws_';
  let _auth = null;

  function cacheKey() { return CACHE_PREFIX + (_auth ? _auth.phone : ''); }

  // ── Public: show after login ───────────────────────────────────
  function show(auth) {
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
    _auth = null;
    const container = document.getElementById('welcome-stats-container');
    if (container) { container.classList.add('hidden'); container.innerHTML = ''; }
  }

  // ── Fetch ─────────────────────────────────────────────────────
  async function _fetch() {
    const container = document.getElementById('welcome-stats-container');
    if (!container || !_auth) return;
    _skeleton();
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getWelcomeStats', phone: _auth.phone }),
      });
      if (!res.ok) throw new Error('Server error ' + res.status);
      const data = await res.json();
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
      <div class="ws-card ws-skeleton">
        <div class="ws-skel ws-skel-lg"></div>
        <div class="ws-skel ws-skel-md"></div>
        <div class="ws-skel-sep"></div>
        <div class="ws-skel ws-skel-sm"></div>
        <div class="ws-skel ws-skel-row"></div>
        <div class="ws-skel ws-skel-row"></div>
        <div class="ws-skel ws-skel-row"></div>
        <div class="ws-skel ws-skel-row"></div>
      </div>`;
  }

  function _renderError() {
    const c = document.getElementById('welcome-stats-container');
    if (!c) return;
    c.innerHTML = `
      <div class="ws-card ws-error-card">
        <p class="ws-error-txt">Could not load statistics. Continue to your form below.</p>
      </div>`;
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

    const slotTotal  = (typeof SLOT_TOTALS !== 'undefined' && SLOT_TOTALS[_auth.schoolType]) || 30;
    const dlDays     = _daysUntil(SCHOOL_DEADLINE);
    const dlText     = dlDays < 0  ? 'School deadline has passed'
                     : dlDays === 0 ? '⏰ School deadline: TODAY!'
                     : `⏰ School deadline in: ${dlDays} day${dlDays !== 1 ? 's' : ''}`;

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
      : `<div class="ws-all-done">✓ All categories submitted!</div>`;

    c.innerHTML = `
      <div class="ws-card">
        <div class="ws-greet">Welcome back ${_esc(_auth.organiserName)} 👋</div>
        <div class="ws-sub">${_esc(_auth.schoolName)} &nbsp;|&nbsp; ${_esc(_auth.zone)} Zone</div>
        <div class="ws-div"></div>
        <div class="ws-hdr">YOUR SUBMISSION SUMMARY:</div>
        <div class="ws-rule"></div>
        <div class="ws-row">
          <span class="ws-ico">📊</span>
          <span class="ws-lbl">Total Submitted:</span>
          <span class="ws-val${data.total >= slotTotal ? ' ws-full' : ''}">${data.total} of ${slotTotal} slots</span>
        </div>
        <div class="ws-row">
          <span class="ws-ico">📚</span>
          <span class="ws-lbl">Innovations:</span>
          <span class="ws-val">${data.innovations} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-ico">🎓</span>
          <span class="ws-lbl">Academics:</span>
          <span class="ws-val">${data.academics} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-ico">🔧</span>
          <span class="ws-lbl">Skills:</span>
          <span class="ws-val">${data.skills} submitted</span>
        </div>
        ${missingHtml}
        <div class="ws-rule"></div>
        <div class="ws-deadline${dlDays >= 0 && dlDays <= 2 ? ' ws-dl-urgent' : ''}">${dlText}</div>
        <div class="ws-div"></div>
      </div>`;
  }

  // ── Zone welcome card ─────────────────────────────────────────
  function _renderZone(data) {
    const c = document.getElementById('welcome-stats-container');
    if (!c) return;

    const ZONE_TOTAL = 64;
    const dlDays  = _daysUntil(ZONE_DEADLINE);
    const dlText  = dlDays < 0  ? 'Zone deadline has passed'
                  : dlDays === 0 ? '⏰ Zone deadline: TODAY!'
                  : `⏰ Zone deadline in: ${dlDays} day${dlDays !== 1 ? 's' : ''}`;

    const allSchools   = (typeof ZONES !== 'undefined' && ZONES[_auth.zone])
                         ? ZONES[_auth.zone].schools.map(s => s.name) : [];
    const submitted    = new Set(data.submittedSchools || []);
    const notSubmitted = allSchools.filter(s => !submitted.has(s));

    const notSubmHtml = notSubmitted.length
      ? `<div class="ws-section">
           <div class="ws-section-lbl">SCHOOLS NOT YET SUBMITTED:</div>
           ${notSubmitted.map(s => `<div class="ws-miss-item">&#8226; ${_esc(s)}</div>`).join('')}
         </div>`
      : `<div class="ws-all-done">✓ All schools have submitted!</div>`;

    c.innerHTML = `
      <div class="ws-card">
        <div class="ws-greet">Welcome back ${_esc(_auth.organiserName)} 👋</div>
        <div class="ws-sub">${_esc(_auth.zone)} Zone</div>
        <div class="ws-div"></div>
        <div class="ws-hdr">ZONE SUBMISSION SUMMARY:</div>
        <div class="ws-rule"></div>
        <div class="ws-row">
          <span class="ws-ico">📊</span>
          <span class="ws-lbl">Total Submitted:</span>
          <span class="ws-val${data.total >= ZONE_TOTAL ? ' ws-full' : ''}">${data.total} of ${ZONE_TOTAL} slots</span>
        </div>
        <div class="ws-row">
          <span class="ws-ico">📚</span>
          <span class="ws-lbl">Innovations:</span>
          <span class="ws-val">${data.innovations} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-ico">🎓</span>
          <span class="ws-lbl">Academics:</span>
          <span class="ws-val">${data.academics} submitted</span>
        </div>
        <div class="ws-row">
          <span class="ws-ico">🔧</span>
          <span class="ws-lbl">Skills:</span>
          <span class="ws-val">${data.skills} submitted</span>
        </div>
        ${notSubmHtml}
        <div class="ws-rule"></div>
        <div class="ws-deadline${dlDays >= 0 && dlDays <= 2 ? ' ws-dl-urgent' : ''}">${dlText}</div>
        <div class="ws-div"></div>
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
