// history.js — Submission History view
// JETS 2024-2026 | Lavushimanda District

const SubmissionHistory = (() => {

  let _pageId, _auth, _formType, _slotTotal;
  let _allRows = [], _filtered = [];
  let _filterTab = 'all', _searchName = '', _searchRef = '';
  let _correctionTarget = null; // { refNumber, participantName, rowIndex }

  // ── Entry Point ───────────────────────────────────────────────
  function show(pageId, auth, formType, slotTotal) {
    _pageId    = pageId;
    _auth      = auth;
    _formType  = formType;
    _slotTotal = slotTotal || 0;
    _allRows   = [];
    _filtered  = [];
    _filterTab = 'all';
    _searchName = '';
    _searchRef  = '';
    _correctionTarget = null;

    App.setPageHTML(pageId, buildShellHTML());
    bindEvents();
    fetchHistory();
  }

  // ── Shell HTML ────────────────────────────────────────────────
  function buildShellHTML() {
    const backFn = _formType === 'school'
      ? `SchoolForm.render('${_pageId}', App.authData)`
      : `ZoneForm.render('${_pageId}', App.authData)`;
    return `
<div class="form-topbar">
  <button class="btn-back" onclick="${backFn}">&#8592; Back to Form</button>
  <span class="topbar-title">My Submissions</span>
  <button class="btn-signout-form" onclick="App.signOut()">Sign Out</button>
</div>

<div class="sh-body">

  <div class="sh-controls form-card">
    <div class="sh-filter-label">Filter by tab:</div>
    <div class="sh-filter-tabs">
      <button class="sh-ftab active" data-ftab="all">All</button>
      <button class="sh-ftab" data-ftab="innovations">Innovations</button>
      <button class="sh-ftab" data-ftab="academics">Academics</button>
      <button class="sh-ftab" data-ftab="skills">Skills</button>
    </div>
    <div class="sh-search-row">
      <input type="text" id="sh-search-name" class="sh-search"
             placeholder="Search by participant name&#8230;" autocomplete="off">
      <input type="text" id="sh-search-ref"  class="sh-search"
             placeholder="Search by reference number&#8230;" autocomplete="off">
    </div>
  </div>

  <div id="sh-list-wrap" class="sh-list-wrap">
    <div class="sh-loading">
      <div class="spinner-dark"></div>
      <p class="sh-loading-text">Loading submissions&#8230;</p>
    </div>
  </div>

  <div id="sh-summary" class="sh-summary form-card hidden"></div>

</div>

${buildCorrectionModalHTML()}`;
  }

  // ── Correction Modal HTML ─────────────────────────────────────
  function buildCorrectionModalHTML() {
    return `
<div id="sh-corr-overlay" class="sh-corr-overlay hidden" role="dialog" aria-modal="true">
  <div class="sh-corr-modal">
    <div class="sh-corr-header">
      <span class="sh-corr-title">Request Correction</span>
      <button class="sh-corr-close" id="sh-corr-close" aria-label="Close">&times;</button>
    </div>
    <div class="sh-corr-body">
      <div class="field">
        <label>Reference Number</label>
        <input type="text" id="sh-corr-ref" class="sh-corr-readonly" readonly>
      </div>
      <div class="field">
        <label>Participant Name</label>
        <input type="text" id="sh-corr-name" class="sh-corr-readonly" readonly>
      </div>
      <div class="field">
        <label>What needs to be corrected? <span class="sh-corr-req">*</span></label>
        <textarea id="sh-corr-what" class="sh-corr-textarea" rows="3"
                  placeholder="Describe what is incorrect in the submission&#8230;"></textarea>
      </div>
      <div class="field">
        <label>Correct information <span class="sh-corr-req">*</span></label>
        <textarea id="sh-corr-info" class="sh-corr-textarea" rows="3"
                  placeholder="Provide the correct details that should replace the error&#8230;"></textarea>
      </div>
      <div id="sh-corr-msg" class="sh-corr-msg hidden"></div>
      <button class="sh-corr-submit-btn" id="sh-corr-submit">Submit Correction Request</button>
    </div>
  </div>
</div>`;
  }

  // ── Fetch ───────────────────────────────────────────────────
  async function fetchHistory() {
    try {
      const data = await FirestoreDB.getSubmissionHistory(
        _auth.phone, _formType, _auth.zone, _auth.schoolName
      );
      if (data.status !== 'ok') throw new Error(data.message || 'Failed to load history.');

      _allRows = data.rows || [];
      applyFilters();
      renderList();
      renderSummary();

    } catch (err) {
      const wrap = document.getElementById('sh-list-wrap');
      if (wrap) {
        wrap.innerHTML = `
          <div class="sh-error">
            <p>Could not load submissions. Check your connection and try again.</p>
            <button class="btn-retry" id="sh-retry-btn">Retry</button>
          </div>`;
        document.getElementById('sh-retry-btn').addEventListener('click', () => {
          wrap.innerHTML = `
            <div class="sh-loading">
              <div class="spinner-dark"></div>
              <p class="sh-loading-text">Loading submissions&#8230;</p>
            </div>`;
          fetchHistory();
        });
      }
    }
  }

  // ── Filter & Search ───────────────────────────────────────────
  function applyFilters() {
    let rows = _allRows.slice();

    if (_filterTab !== 'all') {
      rows = rows.filter(r => tabLabel(r.pType).toLowerCase() === _filterTab);
    }
    if (_searchName) {
      const q = _searchName.toLowerCase();
      rows = rows.filter(r => (r.fullName || '').toLowerCase().includes(q));
    }
    if (_searchRef) {
      const q = _searchRef.toLowerCase();
      rows = rows.filter(r => (r.refNumber || '').toLowerCase().includes(q));
    }

    _filtered = rows;
  }

  // ── Render List ───────────────────────────────────────────────
  function renderList() {
    const wrap = document.getElementById('sh-list-wrap');
    if (!wrap) return;

    if (!_allRows.length) {
      wrap.innerHTML = `
        <div class="sh-empty">
          <p class="sh-empty-main">No submissions yet.</p>
          <p class="sh-empty-sub">Start by selecting a tab above.</p>
        </div>`;
      return;
    }

    if (!_filtered.length) {
      wrap.innerHTML = `
        <div class="sh-empty">
          <p class="sh-empty-main">No submissions match your search.</p>
        </div>`;
      return;
    }

    const items = _filtered.map((r, idx) => {
      const tab      = tabLabel(r.pType);
      const tabClass = tab === 'Innovations' ? 'sh-badge-innov'
                     : tab === 'Academics'   ? 'sh-badge-acad'
                     : 'sh-badge-skills';
      const dt = r.timestamp ? fmtDateTime(r.timestamp) : '&#8212;';

      // Correction status area
      const corrHtml = buildCorrStatusHTML(r, idx);

      return `
        <div class="sh-entry">
          <div class="sh-entry-top">
            <span class="sh-name">${r.fullName ? esc(r.fullName) : '&mdash;'}</span>
            <span class="sh-badge ${tabClass}">${tab}</span>
          </div>
          <div class="sh-entry-meta">
            <span><span class="sh-meta-lbl">Category:</span> ${r.category ? esc(r.category) : '&mdash;'}</span>
            <span><span class="sh-meta-lbl">Grade:</span> ${r.grade ? esc(r.grade) : '&mdash;'}</span>
          </div>
          <div class="sh-entry-meta">
            <span><span class="sh-meta-lbl">Date:</span> ${dt}</span>
            <span><span class="sh-meta-lbl">Ref:</span> <span class="sh-ref">${r.refNumber ? esc(r.refNumber) : '&mdash;'}</span></span>
          </div>
          <div class="sh-entry-bottom">
            <span class="sh-status sh-status-submitted">&#10003; ${esc(r.status || 'Submitted')}</span>
            ${corrHtml}
          </div>
        </div>`;
    }).join('');

    wrap.innerHTML = `<div class="sh-list">${items}</div>`;

    // Bind correction buttons after render
    wrap.querySelectorAll('.sh-corr-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        const row = _filtered[idx];
        if (row) openCorrectionModal(row);
      });
    });
  }

  function buildCorrStatusHTML(r, idx) {
    const cs = r.correctionStatus;
    if (!cs) {
      // No correction yet — show the button
      return `<button class="sh-corr-btn" data-idx="${idx}">&#9998; Request Correction</button>`;
    }
    if (cs === 'Pending') {
      return `<span class="sh-corr-status sh-corr-pending">&#9203; Correction Pending</span>`;
    }
    if (cs === 'Approved') {
      return `<span class="sh-corr-status sh-corr-approved">&#10003; Correction Approved</span>`;
    }
    if (cs === 'Rejected') {
      return `
        <span class="sh-corr-status sh-corr-rejected">&#10007; Correction Rejected</span>
        <button class="sh-corr-btn" data-idx="${idx}">&#9998; Request Again</button>`;
    }
    return '';
  }

  // ── Correction Modal ──────────────────────────────────────────
  function openCorrectionModal(row) {
    _correctionTarget = row;
    const overlay = document.getElementById('sh-corr-overlay');
    const refEl   = document.getElementById('sh-corr-ref');
    const nameEl  = document.getElementById('sh-corr-name');
    const whatEl  = document.getElementById('sh-corr-what');
    const infoEl  = document.getElementById('sh-corr-info');
    const msgEl   = document.getElementById('sh-corr-msg');

    if (!overlay) return;
    if (refEl)  refEl.value  = row.refNumber  || '';
    if (nameEl) nameEl.value = row.fullName   || '';
    if (whatEl) whatEl.value = '';
    if (infoEl) infoEl.value = '';
    if (msgEl)  { msgEl.textContent = ''; msgEl.className = 'sh-corr-msg hidden'; }

    const submitBtn = document.getElementById('sh-corr-submit');
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Correction Request'; }

    overlay.classList.remove('hidden');
    if (whatEl) whatEl.focus();
  }

  function closeCorrectionModal() {
    const overlay = document.getElementById('sh-corr-overlay');
    if (overlay) overlay.classList.add('hidden');
    _correctionTarget = null;
  }

  async function submitCorrection() {
    if (!_correctionTarget) return;

    const whatEl = document.getElementById('sh-corr-what');
    const infoEl = document.getElementById('sh-corr-info');
    const msgEl  = document.getElementById('sh-corr-msg');
    const btn    = document.getElementById('sh-corr-submit');

    const what = (whatEl ? whatEl.value : '').trim();
    const info = (infoEl ? infoEl.value : '').trim();

    if (!what || !info) {
      showCorrMsg('Please fill in both fields before submitting.', 'error');
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Submitting&#8230;';
    if (msgEl) { msgEl.textContent = ''; msgEl.className = 'sh-corr-msg hidden'; }

    try {
      const data = await FirestoreDB.submitCorrectionRequest({
        phone:           _auth.phone,
        coordinatorName: _auth.organiserName || '',
        schoolOrZone:    _formType === 'zone'
                           ? (_auth.zone || _auth.schoolName || '')
                           : (_auth.schoolName || ''),
        refNumber:       _correctionTarget.refNumber,
        participantName: _correctionTarget.fullName || '',
        whatToCorrect:   what,
        correctInfo:     info,
        source:          _formType,
      });
      if (data.status !== 'ok') throw new Error(data.message || 'Submission failed.');

      // Update row's correctionStatus in memory so badge updates on re-render
      _correctionTarget.correctionStatus    = 'Pending';
      _correctionTarget.correctionRequestId = data.requestId || null;
      // Mirror update to _allRows too
      const orig = _allRows.find(r => r.refNumber === _correctionTarget.refNumber);
      if (orig) { orig.correctionStatus = 'Pending'; orig.correctionRequestId = _correctionTarget.correctionRequestId; }

      showCorrMsg('Correction request submitted. The DEC will review it shortly.', 'success');
      btn.textContent = 'Submitted';

      setTimeout(() => {
        closeCorrectionModal();
        applyFilters();
        renderList();
      }, 1800);

    } catch (err) {
      showCorrMsg('Failed: ' + err.message, 'error');
      btn.disabled    = false;
      btn.textContent = 'Submit Correction Request';
    }
  }

  function showCorrMsg(text, type) {
    const el = document.getElementById('sh-corr-msg');
    if (!el) return;
    el.textContent = text;
    el.className   = 'sh-corr-msg sh-corr-msg-' + type;
  }

  // ── Render Summary ────────────────────────────────────────────
  function renderSummary() {
    const el = document.getElementById('sh-summary');
    if (!el) return;

    if (!_allRows.length) {
      el.classList.add('hidden');
      return;
    }

    const total     = _allRows.length;
    const remaining = _slotTotal > 0 ? Math.max(0, _slotTotal - total) : null;
    const last      = _allRows[0];
    const lastDt    = last && last.timestamp ? fmtDateTime(last.timestamp) : '&#8212;';

    const slotsRow = remaining !== null
      ? `<div class="sh-sum-item"><span class="sh-sum-num sh-sum-rem">${remaining}</span><span class="sh-sum-lbl">Slots Remaining</span></div>`
      : '';

    el.innerHTML = `
      <div class="sh-sum-grid">
        <div class="sh-sum-item">
          <span class="sh-sum-num">${total}</span>
          <span class="sh-sum-lbl">Total Submitted</span>
        </div>
        ${slotsRow}
        <div class="sh-sum-item sh-sum-last">
          <span class="sh-sum-lbl">Last Submission</span>
          <span class="sh-sum-date">${lastDt}</span>
        </div>
      </div>`;
    el.classList.remove('hidden');
  }

  // ── Events ────────────────────────────────────────────────────
  function bindEvents() {
    document.querySelectorAll('.sh-ftab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sh-ftab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        _filterTab = btn.dataset.ftab;
        applyFilters();
        renderList();
      });
    });

    const nameEl = document.getElementById('sh-search-name');
    const refEl  = document.getElementById('sh-search-ref');
    if (nameEl) nameEl.addEventListener('input', () => { _searchName = nameEl.value; applyFilters(); renderList(); });
    if (refEl)  refEl.addEventListener('input',  () => { _searchRef  = refEl.value;  applyFilters(); renderList(); });

    // Modal events
    const closeBtn  = document.getElementById('sh-corr-close');
    const submitBtn = document.getElementById('sh-corr-submit');
    const overlay   = document.getElementById('sh-corr-overlay');

    if (closeBtn)  closeBtn.addEventListener('click', closeCorrectionModal);
    if (submitBtn) submitBtn.addEventListener('click', submitCorrection);
    if (overlay) {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeCorrectionModal();
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  function tabLabel(pType) {
    if (!pType) return 'Innovations';
    if (pType.indexOf('Technical Skills') !== -1) return 'Skills';
    if (pType.indexOf('Academics')        !== -1) return 'Academics';
    return 'Innovations';
  }

  function fmtDateTime(iso) {
    try {
      const d   = new Date(iso);
      const day = d.getDate().toString().padStart(2, '0');
      const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
      const yr  = d.getFullYear();
      const hr  = d.getHours().toString().padStart(2, '0');
      const mn  = d.getMinutes().toString().padStart(2, '0');
      return `${day} ${mon} ${yr}, ${hr}:${mn}`;
    } catch (_) { return iso; }
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { show };

})();
