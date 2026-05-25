// ═══════════════════════════════════════════════════════════════
// dashboard.js — District Dashboard module
// JETS 2024-2026 | Lavushimanda District
// Theme: Orange #e67e22 + Navy #1a3c6e
// ═══════════════════════════════════════════════════════════════

const Dashboard = (() => {

  let _pageId, _auth, _data, _cacheTime, _feedTimer, _allSubs;
  let _organisers = null;   // cached from adminGetAllOrganisers
  let _orgEditTarget = null; // the record being edited { zone,name,role,phone,... }
  const CACHE_MS       = 5 * 60 * 1000;  // 5 minutes
  const FEED_REFRESH_S = 60 * 1000;       // 60 seconds

  let _activeDrawerId = null; // Currently open drawer identifier

  const ZONE_NAMES = ['Mpumba', 'Chiundaponde', 'Lukulu', 'Kalonje', 'Mwelushi'];

  // Innovation categories (matches data.js)
  const INNOV_CATS = [
    'Agricultural Science Innovations',
    'Chemistry Innovations',
    'Physics & Renewable Energy Innovations',
    'Computer Science & Software Development Innovations',
    'Mathematics Innovations',
    'Medicine & Health Innovations',
    'Robotics & Artificial Intelligence Innovations',
    'Food Science, Technology & Hospitality Innovations',
    'Environmental Sustainable Development Innovations',
  ];

  // Academics categories (flattened unique values from ACADEMICS_BY_LEVEL)
  const ACAD_CATS = [
    'Quiz & Olympiads — Mathematics',
    'Quiz & Olympiads — Science',
    'Quiz & Olympiads — CTS',
    'Quiz & Olympiads — Physics/Mathematics',
    'Quiz & Olympiads — Biology/Chemistry',
  ];

  // ── Entry Point ───────────────────────────────────────────────
  function render(pageId, auth) {
    _pageId   = pageId;
    _auth     = auth;
    _data     = null;
    _allSubs  = null;
    _cacheTime = 0;
    _activeDrawerId = null;

    if (auth.role !== 'District') {
      App.setPageHTML(pageId, deniedHTML());
      return;
    }

    App.setPageHTML(pageId, shellHTML());
    bindGlobalEvents();
    loadFullData();
  }

  function destroy() {
    if (_feedTimer) { clearInterval(_feedTimer); _feedTimer = null; }
  }

  // ── Access Denied ─────────────────────────────────────────────
  function deniedHTML() {
    return `
<div class="form-topbar" style="background:linear-gradient(135deg,#0d2347,#1a3c6e)">
  <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
  <span class="topbar-title">District Dashboard</span>
</div>
<div class="db-denied-wrap">
  <div class="db-denied-card">
    <div class="alert alert-error">Access Denied. District access only.</div>
    <button class="btn-auth-action btn-back-home" style="margin-top:16px" onclick="App.backToLanding()">Back to Home</button>
  </div>
</div>`;
  }

  // ── Static Shell ──────────────────────────────────────────────
  function shellHTML() {
    return `
<div class="form-topbar" style="background:linear-gradient(135deg,#0d2347,#1a3c6e)">
  <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
  <span class="topbar-title">District Dashboard</span>
  <button class="db-refresh-btn" id="db-refresh-btn" onclick="Dashboard._manualRefresh()">&#8635; Refresh</button>
  <button class="btn-signout-form" onclick="App.signOut()">Sign Out</button>
</div>

<header class="db-header">
  <div class="db-header-logos">
    <img src="assets/coat-of-arms.png" alt="Zambia Coat of Arms" class="db-logo"
         onerror="this.outerHTML='<span class=&quot;logo-text-fb&quot;></span>'">
    <div class="db-header-text">
      <p class="db-h-title">JETS 2026 District Dashboard</p>
      <p class="db-h-sub">Lavushimanda District &nbsp;|&nbsp; Muchinga Region</p>
      <p class="db-h-dist">Signed in: <strong>${App.maskPhone(_auth.phone)}</strong> &mdash; ${_auth.organiserName}</p>
    </div>
    <img src="assets/jets-logo.png" alt="JETS Logo" class="db-logo"
         onerror="this.outerHTML='<span class=&quot;logo-text-fb&quot;></span>'">
  </div>
  <div class="db-meta-bar">
    <span>Last updated: <span id="db-last-updated">&#8212;</span></span>
    <span class="db-meta-sep">|</span>
    <span id="db-feed-tick">Feed refreshes every 60s</span>
  </div>
</header>

<div class="db-body" id="db-body">${skeletonHTML()}</div>`;
  }

  function skeletonHTML() {
    return `
<div class="db-button-grid">
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
  <div class="db-skeleton" style="height: 100px; border-radius: 12px; margin-bottom: 0;"></div>
</div>
<div style="text-align: center; margin-top: 24px; color: var(--db-navy); font-weight: 600;">
  Loading dashboard data...
</div>
`;
  }

  // ── Data Loading ──────────────────────────────────────────────
  async function loadFullData(force) {
    const now = Date.now();
    if (!force && _data && (now - _cacheTime) < CACHE_MS) {
      renderAll(_data);
      return;
    }

    setRefreshBtn(true);
    try {
      const data = await FirestoreDB.getFullDashboard();
      if (data.status !== 'ok') throw new Error(data.message || 'Dashboard load failed.');

      _data     = data;
      _allSubs  = data.allSubs || [];
      _cacheTime = Date.now();
      renderAll(data);

      // Self-Healing System Config Sync:
      // If Firestore deadlines doc doesn't have the driveUrl, but we have it in _auth, save it to Firestore!
      if (_auth && _auth.driveUrl && !data.driveUrl) {
        console.log("Self-Healing Sync: Writing driveUrl to Firestore...");
        try {
          await FirestoreDB.saveDeadlines({ driveUrl: _auth.driveUrl });
          _data.driveUrl = _auth.driveUrl; // Update local cache
          // Re-render only quick actions so the button updates instantly
          const actionsBox = document.querySelector('.db-actions-body');
          if (actionsBox) {
            const parent = actionsBox.closest('.db-section');
            if (parent) {
              parent.outerHTML = renderActions(_data);
            }
          }
          console.log("Self-Healing Sync: driveUrl successfully saved to Firestore.");
        } catch (err) {
          console.warn("Failed to auto-sync driveUrl to Firestore:", err);
        }
      }

      // Start auto-refresh of feed
      if (_feedTimer) clearInterval(_feedTimer);
      _feedTimer = setInterval(refreshFeed, FEED_REFRESH_S);

    } catch (err) {
      const body = document.getElementById('db-body');
      if (body) body.innerHTML = `<div class="db-error">&#9888; Could not load dashboard: ${err.message}<br><br><button class="btn-retry" onclick="Dashboard._manualRefresh()">Try Again</button></div>`;
    } finally {
      setRefreshBtn(false);
    }
  }

  async function refreshFeed() {
    try {
      const data = await FirestoreDB.getRecentFeed();
      if (data.status === 'ok') {
        const feedEl = document.getElementById('db-feed-list');
        if (feedEl) {
          feedEl.innerHTML = buildFeedItems(data.recentFeed || []);
          feedEl.querySelectorAll('.btn-feed-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const d = btn.dataset;
              promptDelete(d.ref, d.participant, d.school, d.category, d.source);
            });
          });
        }
        const tick = document.getElementById('db-feed-tick');
        if (tick) tick.textContent = 'Feed refreshed ' + fmtTimeShort(new Date().toISOString());
      }
    } catch (_) {}
  }

  function setRefreshBtn(loading) {
    const btn = document.getElementById('db-refresh-btn');
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = loading ? 'Loading…' : 'Refresh';
  }

  // ── Drawer Management ──────────────────────────────────────────
  async function openDrawer(drawerId) {
    const now = Date.now();
    if (!_data || (now - _cacheTime) >= CACHE_MS) {
      showGlobalLoader();
      try {
        await loadFullData(true);
      } catch (err) {
        hideGlobalLoader();
        alert("Failed to load dashboard: " + err.message);
        return;
      }
      hideGlobalLoader();
    }
    activateDrawer(drawerId);
  }

  function activateDrawer(drawerId) {
    closeActiveDrawer(true);
    const drawer = document.getElementById('drawer-' + drawerId);
    const backdrop = document.getElementById('db-backdrop');
    if (drawer && backdrop) {
      drawer.classList.add('active');
      backdrop.classList.add('active');
      _activeDrawerId = drawerId;
    }
  }

  function closeActiveDrawer(isSwapping) {
    document.querySelectorAll('.bottom-drawer').forEach(d => d.classList.remove('active'));
    const backdrop = document.getElementById('db-backdrop');
    if (backdrop) backdrop.classList.remove('active');
    if (!isSwapping) {
      _activeDrawerId = null;
    }
  }

  function closeDeleteDrawer() {
    closeActiveDrawer();
  }

  // ── Delete submission with WhatsApp ───────────────────────────
  function promptDelete(ref, participant, school, category, source) {
    source = source || (ref.startsWith('ZON-') || ref.startsWith('ZN-') ? 'Zone' : 'School');
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('del-ref',         ref);
    setTxt('del-participant', participant);
    setTxt('del-school',      school);
    setTxt('del-category',    category);

    const reasonSel = document.getElementById('del-reason');
    if (reasonSel) reasonSel.selectedIndex = 0;
    const delMsg = document.getElementById('del-msg');
    if (delMsg) { delMsg.style.display = 'none'; delMsg.textContent = ''; }

    const confirmBtn = document.getElementById('btn-confirm-delete');
    if (confirmBtn) {
      confirmBtn.dataset.ref         = ref;
      confirmBtn.dataset.source      = source;
      confirmBtn.dataset.participant = participant;
      confirmBtn.dataset.school      = school;
      confirmBtn.dataset.category    = category;
      confirmBtn.disabled    = false;
      confirmBtn.textContent = 'DELETE & NOTIFY';
    }

    activateDrawer('delete-confirm');
  }

  async function confirmDelete() {
    const btn    = document.getElementById('btn-confirm-delete');
    const reason = (document.getElementById('del-reason') || {}).value || '';
    const delMsg = document.getElementById('del-msg');

    if (!reason) {
      if (delMsg) { delMsg.textContent = 'Please select a reason.'; delMsg.style.display = 'block'; }
      return;
    }

    const ref         = btn.dataset.ref;
    const source      = btn.dataset.source;
    const participant = btn.dataset.participant;
    const school      = btn.dataset.school;
    const category    = btn.dataset.category;

    btn.disabled    = true;
    btn.textContent = 'Deleting…';

    try {
      await FirestoreDB.deleteSubmission(ref, source, _auth.organiserName, reason, { participant, school, category });

      // Look up organiser phone from loaded organisers list
      let organiserPhone = '';
      let organiserName  = school;
      if (_organisers) {
        const org = _organisers.find(o => (o.name || o.schoolName || '') === school);
        if (org) { organiserPhone = org.phone || ''; organiserName = org.organiser || org.organiserName || school; }
      }

      const siteLink = window.location.href.split('?')[0];
      const waMsg = encodeURIComponent(
        `JETS 2026 - Submission Removed\n` +
        `Dear ${organiserName},\n\n` +
        `Participant: ${participant}\n` +
        `Category: ${category}\n` +
        `Reference: ${ref}\n` +
        `Reason: ${reason}\n\n` +
        `Please resubmit: ${siteLink}\n` +
        `Contact District JETS Organiser: 0973375828\n` +
        `Lavushimanda District JETS 2026`
      );

      closeDeleteDrawer();
      loadFullData(true);

      const waUrl = organiserPhone
        ? `https://wa.me/260${organiserPhone.replace(/^0/, '')}?text=${waMsg}`
        : `https://wa.me/?text=${waMsg}`;
      window.open(waUrl, '_blank', 'noopener');

    } catch (err) {
      if (delMsg) { delMsg.textContent = 'Delete failed: ' + err.message; delMsg.style.display = 'block'; }
      btn.disabled    = false;
      btn.textContent = 'DELETE & NOTIFY';
    }
  }

  function bindDeleteConfirmBtn() {
    const btn = document.getElementById('btn-confirm-delete');
    if (btn) btn.addEventListener('click', confirmDelete);
  }

  function showGlobalLoader() {
    const el = document.getElementById('db-global-loader');
    if (el) el.classList.remove('hidden');
  }

  function hideGlobalLoader() {
    const el = document.getElementById('db-global-loader');
    if (el) el.classList.add('hidden');
  }

  // ── Render All Sections ───────────────────────────────────────
  function renderAll(data) {
    const body = document.getElementById('db-body');
    if (!body) return;

    updateLastUpdated(data.cachedAt);

    const corrections = data.corrections || [];

    body.innerHTML = `
<!-- Button Grid -->
<div class="db-button-grid">
  <button class="db-grid-btn btn-overview" onclick="Dashboard.openDrawer('overview')">
    <span class="db-btn-icon">📊</span>
    <span class="db-btn-text">Overview</span>
  </button>
  <button class="db-grid-btn btn-zone" onclick="Dashboard.openDrawer('zone')">
    <span class="db-btn-icon">📍</span>
    <span class="db-btn-text">Zone Progress</span>
  </button>
  <button class="db-grid-btn btn-school" onclick="Dashboard.openDrawer('school')">
    <span class="db-btn-icon">🏫</span>
    <span class="db-btn-text">School Status</span>
  </button>
  <button class="db-grid-btn btn-feed" onclick="Dashboard.openDrawer('feed')">
    <span class="db-btn-icon">🔔</span>
    <span class="db-btn-text">Recent Feed</span>
  </button>
  <button class="db-grid-btn btn-coverage" onclick="Dashboard.openDrawer('coverage')">
    <span class="db-btn-icon">📈</span>
    <span class="db-btn-text">Category Coverage</span>
  </button>
  <button class="db-grid-btn btn-skills" onclick="Dashboard.openDrawer('skills')">
    <span class="db-btn-icon">🛠️</span>
    <span class="db-btn-text">Skills Tracker</span>
  </button>
  <button class="db-grid-btn btn-admin" onclick="Dashboard.openDrawer('admin')">
    <span class="db-btn-icon">🛡️</span>
    <span class="db-btn-text">Admin Panel</span>
  </button>
  <button class="db-grid-btn btn-settings" onclick="Dashboard.openDrawer('settings')">
    <span class="db-btn-icon">⚙️</span>
    <span class="db-btn-text">Actions & Settings</span>
  </button>
</div>

<!-- Shared Backdrop Overlay -->
<div id="db-backdrop" class="db-backdrop" onclick="Dashboard.closeActiveDrawer()"></div>

<!-- Drawer 1: Overview -->
<div id="drawer-overview" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Overview Statistics</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderOverview(data.overview)}
  </div>
</div>

<!-- Drawer 2: Zone Progress -->
<div id="drawer-zone" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Zone Submission Progress</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderZones(data.zones)}
  </div>
</div>

<!-- Drawer 3: School Status -->
<div id="drawer-school" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">School Status & Submissions</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderSchoolList(data.schoolList)}
  </div>
</div>

<!-- Drawer 4: Recent Feed -->
<div id="drawer-feed" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Recent Submissions Feed</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderFeed(data.recentFeed)}
  </div>
</div>

<!-- Drawer 5: Category Coverage -->
<div id="drawer-coverage" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Category Coverage by Zone</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderCoverage(data.coverage)}
  </div>
</div>

<!-- Drawer 6: Skills Tracker -->
<div id="drawer-skills" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Technical Skills Tracker</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderSkills(data.skills)}
  </div>
</div>

<!-- Drawer 7: Admin Panel (Corrections, Organiser Mgmt, Deadline Mgmt) -->
<div id="drawer-admin" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Admin Panel</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderCorrections(corrections)}
    ${renderOrganiserMgmt()}
    ${renderDeadlineMgmt()}
  </div>
</div>

<!-- Drawer 8: Actions & Settings -->
<div id="drawer-settings" class="bottom-drawer">
  <div class="drawer-header">
    <span class="drawer-title">Quick Actions & Settings</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeActiveDrawer()">&times;</button>
  </div>
  <div class="drawer-body">
    ${renderActions(data)}
  </div>
</div>

<!-- Deletion Confirmation Drawer -->
<div id="drawer-delete-confirm" class="bottom-drawer">
  <div class="drawer-header" style="background:#e74c3c;color:#fff">
    <span class="drawer-title">Confirm Deletion</span>
    <button class="btn-close-drawer" onclick="Dashboard.closeDeleteDrawer()">&times;</button>
  </div>
  <div class="drawer-body" style="padding:16px">
    <div style="margin-bottom:12px; font-size:14px; color:#555;">
      This action is permanent and logs the deletion. A WhatsApp notification will be generated for the organiser.
    </div>
    <div class="delete-sub-details" style="background:#f8f9fa; padding:12px; border-radius:8px; margin-bottom:16px; border-left:4px solid #e74c3c; font-size:13px; line-height:1.6;">
      <div><strong>Ref#:</strong> <span id="del-ref" style="font-family:monospace; font-weight:bold;"></span></div>
      <div><strong>Participant:</strong> <span id="del-participant" style="font-weight:bold;"></span></div>
      <div><strong>School:</strong> <span id="del-school" style="font-weight:bold;"></span></div>
      <div><strong>Category:</strong> <span id="del-category" style="font-weight:bold;"></span></div>
    </div>
    <div style="margin-bottom:16px;">
      <label style="display:block; font-weight:bold; margin-bottom:6px; font-size:13px; color:#333;">Reason for Deletion *</label>
      <select id="del-reason" style="width:100%; padding:10px; border:1.5px solid #ccc; border-radius:6px; font-family:inherit; font-size:13px; outline:none;">
        <option value="">-- Select Reason --</option>
        <option value="Wrong category">Wrong category</option>
        <option value="Wrong name">Wrong name</option>
        <option value="Duplicate">Duplicate</option>
        <option value="Wrong school">Wrong school</option>
        <option value="Exceeds limit">Exceeds limit</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div id="del-msg" style="margin-bottom:8px; font-size:13px; color:#e74c3c; display:none;"></div>
    <div style="display:flex; gap:12px; flex-wrap:wrap;">
      <button id="btn-confirm-delete" class="db-action-btn db-action-primary" style="background:#e74c3c; flex:1; box-shadow:none; padding:12px; font-size:13px; min-width:140px;">DELETE &amp; NOTIFY</button>
      <button id="btn-cancel-delete" class="db-action-btn db-action-outline" style="flex:1; border-color:#ccc; color:#555; padding:12px; font-size:13px; min-width:100px;" onclick="Dashboard.closeDeleteDrawer()">CANCEL</button>
    </div>
  </div>
</div>

<!-- Global Overlay Loader -->
<div id="db-global-loader" class="db-global-loader hidden">
  <div class="db-spinner"></div>
  <div class="db-loader-text">Fetching latest data...</div>
</div>
`;

    bindSchoolSearch();
    bindZoneToggles();
    bindSchoolRows();
    bindCorrectionButtons();
    bindDeadlineMgmt();

    // Bind the delete buttons in Recent Feed
    document.querySelectorAll('.btn-feed-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = btn.dataset;
        promptDelete(d.ref, d.participant, d.school, d.category, d.source);
      });
    });

    bindDeleteConfirmBtn();

    // Re-active active drawer if it was set
    if (_activeDrawerId) {
      const drawer = document.getElementById('drawer-' + _activeDrawerId);
      const backdrop = document.getElementById('db-backdrop');
      if (drawer && backdrop) {
        drawer.classList.add('active');
        backdrop.classList.add('active');
      }
    }

    // Load organisers async after DOM is ready
    loadOrganisers();
  }

  // ── Section 0: Pending Corrections ───────────────────────────
  function renderCorrections(corrections) {
    const pending  = corrections.filter(c => c.status === 'Pending');
    const resolved = corrections.filter(c => c.status !== 'Pending');
    const badge    = pending.length > 0
      ? `<span class="db-corr-badge">${pending.length}</span>` : '';

    const pendingCards = pending.length === 0
      ? '<div class="db-corr-empty">No pending correction requests.</div>'
      : pending.map(c => correctionCard(c)).join('');

    const resolvedSection = resolved.length === 0 ? '' : `
<div class="db-corr-resolved-header">Recently Resolved</div>
${resolved.slice(0, 10).map(c => correctionCard(c)).join('')}`;

    return `
<div class="db-section db-section-corrections" style="margin-bottom: 24px;">
  <div class="db-section-title">Pending Corrections ${badge}</div>
  <div class="db-corr-body">
    ${pendingCards}
    ${resolvedSection}
  </div>
</div>`;
  }

  function correctionCard(c) {
    const isPending  = c.status === 'Pending';
    const isApproved = c.status === 'Approved';
    const statusCls  = isPending  ? 'db-corr-s-pending'
                     : isApproved ? 'db-corr-s-approved'
                     : 'db-corr-s-rejected';
    const statusIcon = isPending  ? '&#9203;'
                     : isApproved ? '&#10003;'
                     : '&#10007;';
    const actions = isPending ? `
<div class="db-corr-actions">
  <button class="db-corr-approve" data-reqid="${esc(c.requestId)}">&#10003; Approve</button>
  <button class="db-corr-reject"  data-reqid="${esc(c.requestId)}">&#10007; Reject</button>
</div>` : `
<div class="db-corr-decided">
  Decided by <strong>${esc(c.decidedBy || '—')}</strong>
</div>`;

    return `
<div class="db-corr-card" data-reqid="${esc(c.requestId)}">
  <div class="db-corr-card-top">
    <span class="db-corr-ref">${esc(c.refNumber)}</span>
    <span class="db-corr-school">${esc(c.schoolOrZone)}</span>
    <span class="db-corr-status ${statusCls}">${statusIcon} ${esc(c.status)}</span>
  </div>
  <div class="db-corr-participant">
    Participant: <strong>${esc(c.participantName || '—')}</strong>
    &nbsp;&bull;&nbsp; ${esc(c.coordinatorName || '—')}
  </div>
  <div class="db-corr-section-lbl">What to correct:</div>
  <div class="db-corr-text">${esc(c.whatToCorrect)}</div>
  <div class="db-corr-section-lbl">Correct information:</div>
  <div class="db-corr-text db-corr-text-info">${esc(c.correctInfo)}</div>
  ${actions}
</div>`;
  }

  function bindCorrectionButtons() {
    document.querySelectorAll('.db-corr-approve, .db-corr-reject').forEach(btn => {
      btn.addEventListener('click', async () => {
        const requestId = btn.dataset.reqid;
        const decision  = btn.classList.contains('db-corr-approve') ? 'Approved' : 'Rejected';
        const label     = decision === 'Approved' ? 'Approve' : 'Reject';

        if (!confirm(`${label} this correction request?\n\nRef: ${requestId}`)) return;

        btn.disabled    = true;
        btn.textContent = decision === 'Approved' ? 'Approving…' : 'Rejecting…';

        try {
          const data = await FirestoreDB.handleCorrectionDecision(requestId, decision, _auth.organiserName);
          if (data.status !== 'ok') throw new Error(data.message || 'Failed.');

          // Refresh the dashboard to show updated state
          loadFullData(true);

        } catch (err) {
          alert('Could not record decision: ' + err.message);
          btn.disabled    = false;
          btn.textContent = label;
        }
      });
    });
  }

  // ── Section 1: Overview ───────────────────────────────────────
  function renderOverview(ov) {
    const cards = [
      { num: ov.totalSubmissions,   label: 'Total\nSubmissions' },
      { num: `${ov.schoolsSubmitted} / ${ov.schoolsTotal}`, label: 'Schools\nSubmitted' },
      { num: ov.schoolsNotStarted,  label: 'Schools\nNot Started' },
      { num: ov.todaySubmissions,   label: 'Today\'s\nSubmissions' },
    ];
    return `
<div class="db-section">
  <div class="db-section-title">Overview</div>
  <div class="db-counters">
    ${cards.map(c => `
    <div class="db-counter-card">
      <div class="db-counter-num">${c.num}</div>
      <div class="db-counter-label">${c.label.replace('\n','<br>')}</div>
    </div>`).join('')}
  </div>
</div>`;
  }

  // ── Section 2: Zone Progress ──────────────────────────────────
  function renderZones(zones) {
    const cards = zones.map(z => {
      const fillClass = z.pct >= 100 ? 'db-fill-red' : z.pct >= 70 ? 'db-fill-orange' : 'db-fill-green';
      const badgeClass = z.status === 'Complete' ? 'db-badge-complete'
                       : z.status === 'In Progress' ? 'db-badge-inprogress' : 'db-badge-notstarted';
      const schoolRows = z.schools.map(s => {
        const dot = s.submitted > 0 ? 'db-zs-dot-green' : 'db-zs-dot-red';
        return `<div class="db-zone-school-row">
          <span class="db-zs-dot ${dot}"></span>
          <span class="db-zs-name">${esc(s.name)}</span>
          <span class="db-zs-type">${shortType(s.type)}</span>
          <span class="db-zs-counts">S:${s.schoolCount} Z:${s.zoneCount}</span>
        </div>`;
      }).join('');
      return `
<div class="db-zone-card">
  <div class="db-zone-head">
    <span class="db-zone-name">${z.name} Zone</span>
    <span class="db-badge ${badgeClass}">${z.status}</span>
  </div>
  <div class="db-zone-coord">${esc(z.coordinator)} &nbsp;&bull;&nbsp; ${z.phone}</div>
  <div class="db-zone-prog-row">
    <div class="db-zone-track"><div class="db-zone-fill ${fillClass}" style="width:${z.pct}%"></div></div>
    <span class="db-zone-count">${z.submitted} / ${z.max}</span>
  </div>
  <div class="db-zone-toggle" data-zone="${z.name}">
    <span class="db-zone-toggle-icon">&#9658;</span> Schools (${z.schools.length})
  </div>
  <div class="db-zone-schools hidden" id="db-zs-${z.name}">${schoolRows}</div>
</div>`;
    }).join('');
    return `
<div class="db-section">
  <div class="db-section-title">Zone Progress</div>
  <div class="db-zones-list">${cards}</div>
</div>`;
  }

  // ── Section 3: School Status List ─────────────────────────────
  function renderSchoolList(schoolList) {
    const rows = schoolList.map(s => schoolRow(s)).join('');
    return `
<div class="db-section">
  <div class="db-section-title">School Status (42 schools)</div>
  <div class="db-school-filters">
    <input type="search" id="db-school-search" class="db-school-search" placeholder="Search schools&hellip;">
    <select id="db-zone-filter" class="db-zone-filter">
      <option value="">All Zones</option>
      ${ZONE_NAMES.map(z => `<option value="${z}">${z}</option>`).join('')}
    </select>
  </div>
  <div id="db-school-count-note" class="db-school-count-note">Showing all 42 schools</div>
  <div class="db-school-list-body" id="db-school-list">${rows}</div>
</div>`;
  }

  function schoolRow(s) {
    const cls  = s.hasStarted ? 'db-school-row-submitted' : 'db-school-row-not-started';
    const icon = s.hasStarted ? '&#10003;' : '&#8212;';
    return `
<div class="db-school-row ${cls}" data-school="${esc(s.name)}" data-zone="${s.zone}" data-name="${s.name.toLowerCase()}">
  <div>
    <div class="db-sr-name">${esc(s.name)}</div>
    <div class="db-sr-zone">${s.zone} &bull; ${shortType(s.type)}</div>
  </div>
  <span class="db-sr-count">${s.submitted > 0 ? s.submitted + ' sub' : ''}</span>
  <span class="db-sr-icon">${icon}</span>
</div>`;
  }

  // ── Section 4: Recent Submissions Feed ────────────────────────
  function renderFeed(feed) {
    return `
<div class="db-section">
  <div class="db-section-title">Recent Submissions</div>
  <div class="db-feed-status">Last 20 &mdash; School + Zone combined &mdash; auto-refreshes every 60s</div>
  <div class="db-feed-list" id="db-feed-list">${buildFeedItems(feed)}</div>
</div>`;
  }

  function buildFeedItems(feed) {
    if (!feed || feed.length === 0) return '<div class="db-feed-empty">No submissions yet.</div>';
    return feed.map(f => {
      const srcBadge = f.source === 'Zone'
        ? '<span class="db-feed-source-badge db-src-zone">ZONE</span>'
        : '<span class="db-feed-source-badge db-src-school">SCHOOL</span>';
      const timeStr = fmtTimeShort(f.time) + ' ' + fmtDate(f.time);
      return `
<div class="db-feed-item">
  <div class="db-feed-item-top">
    ${srcBadge}
    <span class="db-feed-time">${esc(timeStr)}</span>
    <span class="db-feed-zone">${esc(f.zone)}</span>
    <button class="btn-feed-delete"
            data-ref="${esc(f.ref)}"
            data-source="${esc(f.source)}"
            data-participant="${esc(f.participant)}"
            data-school="${esc(f.school)}"
            data-category="${esc(f.category)}">&#128465;</button>
  </div>
  <div class="db-feed-school">${esc(f.school)}</div>
  <div class="db-feed-participant"><strong>${esc(f.participant)}</strong></div>
  <div class="db-feed-ref">${esc(f.category)} &bull; <span class="db-feed-refno">${esc(f.ref)}</span></div>
</div>`;
    }).join('');
  }

  // ── Section 5: Category Coverage ─────────────────────────────
  function renderCoverage(coverage) {
    const zoneHeaders = ZONE_NAMES.map(z => `<th>${z.slice(0, 5)}</th>`).join('');

    function catRow(cat, rowClass) {
      const cells = ZONE_NAMES.map(z => {
        const count = (coverage[z] && coverage[z][cat]) || 0;
        if (count > 0) return `<td class="db-cell-hit">&#10003;<br><small>${count}</small></td>`;
        return `<td class="db-cell-miss">&#8212;</td>`;
      }).join('');
      const shortCat = cat.length > 38 ? cat.slice(0, 36) + '…' : cat;
      return `<tr class="${rowClass}"><td title="${esc(cat)}">${esc(shortCat)}</td>${cells}</tr>`;
    }

    const innovRows = INNOV_CATS.map(c => catRow(c, '')).join('');
    const acadRows  = ACAD_CATS.map(c => catRow(c, '')).join('');

    return `
<div class="db-section">
  <div class="db-section-title">Category Coverage by Zone</div>
  <div class="db-table-wrap">
    <table class="db-coverage-table">
      <thead>
        <tr><th>Category</th>${zoneHeaders}</tr>
      </thead>
      <tbody>
        <tr class="db-cov-group-header"><td colspan="6">Innovations</td></tr>
        ${innovRows}
        <tr class="db-cov-group-header"><td colspan="6">Academics / Quiz &amp; Olympiads</td></tr>
        ${acadRows}
      </tbody>
    </table>
  </div>
</div>`;
  }

  // ── Section 6: Skills Tracker ─────────────────────────────────
  function renderSkills(skills) {
    const totalUsed  = skills.reduce((s, r) => s + r.used, 0);
    const totalSlots = skills.reduce((s, r) => s + r.slots, 0);

    const rows = skills.map(sk => {
      const pct       = sk.slots > 0 ? Math.min(100, Math.round((sk.used / sk.slots) * 100)) : 0;
      const fillClass = pct >= 100 ? 'db-skill-fill-full' : pct >= 75 ? 'db-skill-fill-warning' : '';
      return `
<div class="db-skill-row">
  <span class="db-skill-label">${esc(sk.category)}</span>
  <div class="db-skill-track"><div class="db-skill-fill ${fillClass}" style="width:${pct}%"></div></div>
  <span class="db-skill-count">${sk.used}</span>
  <span class="db-skill-slots">/ ${sk.slots}</span>
</div>`;
    }).join('');

    return `
<div class="db-section">
  <div class="db-section-title">Technical Skills &mdash; District-wide</div>
  <div class="db-skills-body">
    ${rows}
    <div class="db-skill-total-row">
      <span>TOTAL</span>
      <span>${totalUsed} / ${totalSlots}</span>
    </div>
  </div>
</div>`;
  }

  // ── Section 7: Quick Actions ──────────────────────────────────
  function renderActions(data) {
    const drive = data.driveUrl || '';

    return `
<div class="db-section">
  <div class="db-section-title">Quick Actions</div>
  <div class="db-actions-body">
    <button onclick="Dashboard.exportExcel('all')" class="db-action-btn db-action-primary">
      Export All to Excel
    </button>
    <button onclick="Dashboard.exportExcel('school')" class="db-action-btn db-action-secondary">
      Export School Submissions
    </button>
    <button onclick="Dashboard.exportExcel('zone')" class="db-action-btn db-action-secondary">
      Export Zone Submissions
    </button>
    ${drive && drive !== '#' ? `
    <a href="${drive}" target="_blank" rel="noopener" class="db-action-btn db-action-outline">
      View Drive Files
    </a>` : `
    <button onclick="alert('Google Drive folder is not configured in Firestore yet. Please run migrateSystemSettingsToFirestore() in your Apps Script editor to update it.')" class="db-action-btn db-action-outline" style="opacity: 0.6; cursor: not-allowed;">
      View Drive Files (Not Configured)
    </button>`}
  </div>
</div>`;
  }

  // ── Event Binding ─────────────────────────────────────────────
  function bindGlobalEvents() {}

  function bindZoneToggles() {
    document.querySelectorAll('.db-zone-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const zone    = btn.dataset.zone;
        const panel   = document.getElementById('db-zs-' + zone);
        if (!panel) return;
        const isOpen  = !panel.classList.contains('hidden');
        panel.classList.toggle('hidden', isOpen);
        btn.classList.toggle('open', !isOpen);
      });
    });
  }

  function bindSchoolRows() {
    document.querySelectorAll('.db-school-row').forEach(row => {
      row.addEventListener('click', () => {
        const schoolName = row.dataset.school;
        const detailId   = 'db-det-' + slugify(schoolName);
        const existing   = document.getElementById(detailId);
        if (existing) {
          existing.remove();
          return;
        }
        const subs = (_allSubs || []).filter(s => s.school === schoolName);
        const el   = document.createElement('div');
        el.id        = detailId;
        el.className = 'db-school-detail';
        el.innerHTML = buildSchoolDetail(schoolName, subs);
        row.parentNode.insertBefore(el, row.nextSibling);
      });
    });
  }

  function buildSchoolDetail(schoolName, subs) {
    if (!subs.length) {
      return `<div class="db-school-detail-title">${esc(schoolName)}</div>
              <div class="db-detail-none">No submissions found.</div>`;
    }
    const rows = subs.map(s => `
<div class="db-detail-row">
  <span class="db-det-time">${fmtTimeShort(s.time)} ${fmtDate(s.time)}</span>
  <span class="db-det-name">${esc(s.participant)}</span>
  <span class="db-det-type">${esc(s.type)}</span>
  <span class="db-det-cat">${esc(s.category)}</span>
  <span class="db-det-ref">${esc(s.ref)}</span>
</div>`).join('');
    return `<div class="db-school-detail-title">Submissions from ${esc(schoolName)}</div>${rows}`;
  }

  function bindSchoolSearch() {
    const search = document.getElementById('db-school-search');
    const filter = document.getElementById('db-zone-filter');
    if (!search || !filter) return;
    const applyFilter = () => {
      const q    = search.value.toLowerCase().trim();
      const zone = filter.value;
      let visible = 0;
      document.querySelectorAll('#db-school-list .db-school-row').forEach(row => {
        const matchQ    = !q    || row.dataset.name.includes(q);
        const matchZone = !zone || row.dataset.zone === zone;
        const show      = matchQ && matchZone;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
        // also hide detail if parent row hidden
        const det = document.getElementById('db-det-' + slugify(row.dataset.school));
        if (det) det.style.display = show ? '' : 'none';
      });
      const note = document.getElementById('db-school-count-note');
      if (note) note.textContent = 'Showing ' + visible + ' of 42 schools';
    };
    search.addEventListener('input', applyFilter);
    filter.addEventListener('change', applyFilter);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function updateLastUpdated(isoStr) {
    const el = document.getElementById('db-last-updated');
    if (el) el.textContent = isoStr ? fmtFull(isoStr) : '—';
  }

  function fmtFull(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear() +
           ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtTimeShort(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getDate() + ' ' + mo[d.getMonth()];
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function esc(str) {
    return (str || '').toString()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function slugify(str) {
    return (str || '').replace(/[^a-z0-9]/gi, '-').toLowerCase();
  }

  function shortType(type) {
    const map = {
      'Primary School':     'Primary',
      'Secondary School':   'Secondary',
      'Open Centre School': 'Open Centre',
      'Private School':     'Private',
      'Community School':   'Community',
    };
    return map[type] || type;
  }

  // ══════════════════════════════════════════════════════════════
  // ORGANISER MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  const SCHOOL_TYPES = [
    'Primary School', 'Secondary School', 'Open Centre School',
    'Private School', 'Community School', 'DEC',
  ];
  const ALL_ZONES_ORG = ['DISTRICT', ...ZONE_NAMES];

  function renderOrganiserMgmt() {
    const zoneOpts = ALL_ZONES_ORG.map(z => `<option value="${z}">${z}</option>`).join('');
    const typeOpts = SCHOOL_TYPES.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
    return `
<div class="db-section db-section-org" id="db-org-section">
  <div class="db-section-title">Organiser Management</div>

  <div class="db-org-controls">
    <input type="search" id="db-org-search" class="db-org-input db-org-search"
           placeholder="Search name, phone or zone&hellip;">
    <select id="db-org-zone-filter" class="db-org-input db-org-filter-sel">
      <option value="">All Zones</option>
      ${zoneOpts}
    </select>
    <select id="db-org-role-filter" class="db-org-input db-org-filter-sel">
      <option value="">All Roles</option>
      <option value="School">School</option>
      <option value="Zone">Zone</option>
      <option value="District">District</option>
    </select>
    <button id="db-org-add-btn" class="db-org-add-btn">+ ADD NEW ORGANISER</button>
  </div>

  <div id="db-org-form-panel" class="db-org-form-panel hidden">
    <div class="db-org-form-header">
      <span id="db-org-form-title" class="db-org-form-title-text">Add New Organiser</span>
    </div>
    <div class="db-org-form-grid">
      <label class="db-org-label">Zone *
        <select id="db-org-f-zone" class="db-org-input">
          <option value="">-- Select Zone --</option>${zoneOpts}
        </select>
      </label>
      <label class="db-org-label">School Name *
        <input type="text" id="db-org-f-name" class="db-org-input" placeholder="e.g. Mpumba Primary">
      </label>
      <label class="db-org-label">School Type *
        <select id="db-org-f-type" class="db-org-input">
          <option value="">-- Select Type --</option>${typeOpts}
        </select>
      </label>
      <label class="db-org-label">Organiser Name *
        <input type="text" id="db-org-f-organiser" class="db-org-input" placeholder="Full name">
      </label>
      <label class="db-org-label">Phone Number *
        <input type="tel" id="db-org-f-phone" class="db-org-input" placeholder="e.g. 0971234567">
      </label>
      <label class="db-org-label">Role *
        <select id="db-org-f-role" class="db-org-input">
          <option value="School">School</option>
          <option value="Zone">Zone</option>
          <option value="District">District</option>
        </select>
      </label>
      <label class="db-org-label">Status
        <select id="db-org-f-status" class="db-org-input">
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </label>
    </div>
    <div class="db-org-form-btns">
      <button id="db-org-f-save" class="db-org-f-save">Save</button>
      <button id="db-org-f-cancel" class="db-org-f-cancel">Cancel</button>
    </div>
    <div id="db-org-form-msg" class="db-org-form-msg hidden"></div>
  </div>

  <div class="db-org-table-outer">
    <div id="db-org-loading" class="db-org-loading">Loading organisers&hellip;</div>
    <div class="db-org-table-scroll hidden" id="db-org-table-wrap">
      <table class="db-org-table" id="db-org-table">
        <thead>
          <tr>
            <th>Zone</th><th>School</th><th>Type</th>
            <th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody id="db-org-tbody"></tbody>
      </table>
    </div>
    <div id="db-org-count" class="db-org-count hidden"></div>
  </div>

  <div class="db-org-pending-section" id="db-org-pending-section">
    <div class="db-org-pending-title">Pending / Inactive &mdash; Quick Activate</div>
    <div id="db-org-pending-list" class="db-org-pending-list">
      <div class="db-org-loading">Loading&hellip;</div>
    </div>
  </div>
</div>`;
  }

  // ── Load organisers ───────────────────────────────────────────
  async function loadOrganisers() {
    const loadEl = document.getElementById('db-org-loading');
    const wrap   = document.getElementById('db-org-table-wrap');
    if (!loadEl) return;

    try {
      const data = await FirestoreDB.adminGetAllOrganisers();
      if (data.status !== 'ok') throw new Error(data.message || 'Load failed.');

      _organisers = data.records || [];
      populateOrganiserTable(_organisers);
      bindOrgTableEvents();
      bindOrgFormEvents();
      bindOrgFilterEvents();

    } catch (err) {
      if (loadEl) loadEl.innerHTML =
        `<div class="db-org-error">&#9888; Could not load organisers: ${esc(err.message)}
         <button class="db-org-retry-btn" onclick="Dashboard._reloadOrg()">Retry</button></div>`;
    }
  }

  function populateOrganiserTable(list) {
    const loadEl  = document.getElementById('db-org-loading');
    const wrap    = document.getElementById('db-org-table-wrap');
    const tbody   = document.getElementById('db-org-tbody');
    const countEl = document.getElementById('db-org-count');
    if (!tbody) return;

    if (loadEl) loadEl.classList.add('hidden');
    if (wrap)   wrap.classList.remove('hidden');

    tbody.innerHTML = list.map(o => orgRow(o)).join('');

    if (countEl) {
      countEl.classList.remove('hidden');
      countEl.textContent = `${list.length} record${list.length !== 1 ? 's' : ''}`;
    }

    // Pending section
    const pending = list.filter(o => o.status === 'Inactive' || o.phone === 'PENDING');
    const pendEl  = document.getElementById('db-org-pending-list');
    if (pendEl) {
      if (pending.length === 0) {
        pendEl.innerHTML = '<div class="db-org-pending-none">No pending schools. All active.</div>';
      } else {
        pendEl.innerHTML = pending.map(o => `
<div class="db-org-pending-card">
  <div class="db-org-pending-info">
    <strong>${esc(o.organiser !== 'PENDING' ? o.organiser : o.name)}</strong>
    <span>${esc(o.zone)} &bull; ${esc(o.name)} &bull; ${esc(o.role)}</span>
    <span class="db-org-pend-phone">${esc(o.phone)}</span>
  </div>
  <button class="db-org-activate-btn"
          data-zone="${esc(o.zone)}" data-name="${esc(o.name)}"
          data-role="${esc(o.role)}" data-phone="${esc(o.phone)}">
    ACTIVATE
  </button>
</div>`).join('');

        document.querySelectorAll('.db-org-activate-btn').forEach(btn => {
          btn.addEventListener('click', () => orgQuickActivate(btn));
        });
      }
    }
  }

  function orgRow(o) {
    const statusCls  = o.status === 'Active' ? 'db-org-status-active' : 'db-org-status-inactive';
    const toggleLbl  = o.status === 'Active' ? 'DEACTIVATE' : 'ACTIVATE';
    const toggleCls  = o.status === 'Active' ? 'db-org-deactivate-btn' : 'db-org-do-activate-btn';
    const newStatus  = o.status === 'Active' ? 'Inactive' : 'Active';
    return `
<tr class="db-org-row" data-zone="${esc(o.zone)}" data-name="${esc(o.name).toLowerCase()}"
    data-role="${esc(o.role)}" data-filter-zone="${esc(o.zone)}" data-filter-role="${esc(o.role)}">
  <td>${esc(o.zone)}</td>
  <td>${esc(o.name)}</td>
  <td>${esc(shortType(o.type))}</td>
  <td>${esc(o.organiser)}</td>
  <td>${esc(o.phone)}</td>
  <td><span class="db-org-role-badge db-org-role-${o.role.toLowerCase()}">${esc(o.role)}</span></td>
  <td><span class="${statusCls}">${esc(o.status)}</span></td>
  <td class="db-org-actions-cell">
    <button class="db-org-edit-btn"
            data-zone="${esc(o.zone)}" data-name="${esc(o.name)}" data-type="${esc(o.type)}"
            data-organiser="${esc(o.organiser)}" data-phone="${esc(o.phone)}"
            data-role="${esc(o.role)}" data-status="${esc(o.status)}">EDIT</button>
    <button class="${toggleCls} db-org-toggle-btn"
            data-zone="${esc(o.zone)}" data-name="${esc(o.name)}"
            data-role="${esc(o.role)}" data-phone="${esc(o.phone)}"
            data-new-status="${newStatus}">${toggleLbl}</button>
    <button class="db-org-delete-btn"
            data-zone="${esc(o.zone)}" data-name="${esc(o.name)}"
            data-role="${esc(o.role)}" data-phone="${esc(o.phone)}"
            data-organiser="${esc(o.organiser)}">DELETE</button>
  </td>
</tr>`;
  }

  function bindOrgTableEvents() {
    document.querySelectorAll('.db-org-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => orgOpenEditForm(btn.dataset));
    });
    document.querySelectorAll('.db-org-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => orgToggleStatus(btn));
    });
    document.querySelectorAll('.db-org-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => orgConfirmDelete(btn));
    });
  }

  function bindOrgFormEvents() {
    const addBtn    = document.getElementById('db-org-add-btn');
    const saveBtn   = document.getElementById('db-org-f-save');
    const cancelBtn = document.getElementById('db-org-f-cancel');
    if (addBtn)    addBtn.addEventListener('click', orgOpenAddForm);
    if (saveBtn)   saveBtn.addEventListener('click', orgSave);
    if (cancelBtn) cancelBtn.addEventListener('click', orgCloseForm);
  }

  function bindOrgFilterEvents() {
    const search     = document.getElementById('db-org-search');
    const zoneFilter = document.getElementById('db-org-zone-filter');
    const roleFilter = document.getElementById('db-org-role-filter');
    const applyFilter = () => {
      const q    = (search ? search.value : '').toLowerCase().trim();
      const zone = zoneFilter ? zoneFilter.value : '';
      const role = roleFilter ? roleFilter.value : '';
      let count  = 0;
      document.querySelectorAll('#db-org-tbody .db-org-row').forEach(row => {
        const text = row.textContent.toLowerCase();
        const show = (!q    || text.includes(q)) &&
                     (!zone || row.dataset.filterZone === zone) &&
                     (!role || row.dataset.filterRole === role);
        row.style.display = show ? '' : 'none';
        if (show) count++;
      });
      const countEl = document.getElementById('db-org-count');
      if (countEl) countEl.textContent = `${count} record${count !== 1 ? 's' : ''} shown`;
    };
    if (search)     search.addEventListener('input', applyFilter);
    if (zoneFilter) zoneFilter.addEventListener('change', applyFilter);
    if (roleFilter) roleFilter.addEventListener('change', applyFilter);
  }

  function orgOpenAddForm() {
    _orgEditTarget = null;
    const panel = document.getElementById('db-org-form-panel');
    const title = document.getElementById('db-org-form-title');
    if (!panel) return;
    if (title) title.textContent = 'Add New Organiser';
    orgClearForm();
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function orgOpenEditForm(d) {
    _orgEditTarget = { zone: d.zone, name: d.name, role: d.role, phone: d.phone };
    const panel = document.getElementById('db-org-form-panel');
    const title = document.getElementById('db-org-form-title');
    if (!panel) return;
    if (title) title.textContent = 'Edit Organiser';
    document.getElementById('db-org-f-zone').value      = d.zone      || '';
    document.getElementById('db-org-f-name').value      = d.name      || '';
    document.getElementById('db-org-f-type').value      = d.type      || '';
    document.getElementById('db-org-f-organiser').value = d.organiser || '';
    document.getElementById('db-org-f-phone').value     = d.phone     || '';
    document.getElementById('db-org-f-role').value      = d.role      || 'School';
    document.getElementById('db-org-f-status').value    = d.status    || 'Active';
    orgHideMsg();
    panel.classList.remove('hidden');
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function orgCloseForm() {
    const panel = document.getElementById('db-org-form-panel');
    if (panel) panel.classList.add('hidden');
    _orgEditTarget = null;
  }

  function orgClearForm() {
    ['db-org-f-zone','db-org-f-name','db-org-f-type','db-org-f-organiser','db-org-f-phone'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const roleEl   = document.getElementById('db-org-f-role');
    const statusEl = document.getElementById('db-org-f-status');
    if (roleEl)   roleEl.value   = 'School';
    if (statusEl) statusEl.value = 'Active';
    orgHideMsg();
  }

  async function orgSave() {
    const saveBtn = document.getElementById('db-org-f-save');
    const zone      = document.getElementById('db-org-f-zone').value.trim();
    const name      = document.getElementById('db-org-f-name').value.trim();
    const type      = document.getElementById('db-org-f-type').value.trim();
    const organiser = document.getElementById('db-org-f-organiser').value.trim();
    const phone     = document.getElementById('db-org-f-phone').value.trim();
    const role      = document.getElementById('db-org-f-role').value.trim();
    const status    = document.getElementById('db-org-f-status').value.trim();

    if (!zone || !name || !type || !organiser || !phone || !role) {
      orgShowMsg('error', 'All fields marked * are required.');
      return;
    }

    saveBtn.disabled    = true;
    saveBtn.textContent = 'Saving…';

    try {
      const record = { zone, name, type, organiser, phone, role, status };
      let data;
      if (_orgEditTarget) {
        data = await FirestoreDB.adminUpdateOrganiser(_orgEditTarget.phone, record);
      } else {
        data = await FirestoreDB.adminAddOrganiser(record);
      }
      if (data.status !== 'ok') throw new Error(data.message || 'Save failed.');

      orgShowMsg('ok', _orgEditTarget ? 'Organiser updated.' : 'Organiser added.');
      setTimeout(() => { orgCloseForm(); loadOrganisers(); }, 800);

    } catch (err) {
      orgShowMsg('error', err.message);
    } finally {
      saveBtn.disabled    = false;
      saveBtn.textContent = 'Save';
    }
  }

  async function orgToggleStatus(btn) {
    const newStatus = btn.dataset.newStatus;
    const label     = newStatus === 'Active' ? 'Activating…' : 'Deactivating…';
    btn.disabled    = true;
    btn.textContent = label;

    try {
      const data = await FirestoreDB.adminToggleStatus(btn.dataset.phone, newStatus);
      if (data.status !== 'ok') throw new Error(data.message || 'Failed.');
      loadOrganisers();
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled    = false;
      btn.textContent = newStatus === 'Active' ? 'ACTIVATE' : 'DEACTIVATE';
    }
  }

  async function orgQuickActivate(btn) {
    btn.disabled    = true;
    btn.textContent = 'Activating…';
    try {
      const data = await FirestoreDB.adminToggleStatus(btn.dataset.phone, 'Active');
      if (data.status !== 'ok') throw new Error(data.message || 'Failed.');
      loadOrganisers();
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled    = false;
      btn.textContent = 'ACTIVATE';
    }
  }

  function orgConfirmDelete(btn) {
    const name      = btn.dataset.name;
    const organiser = btn.dataset.organiser;
    // Inline confirm — replace the actions cell with a confirm row
    const row = btn.closest('tr');
    if (!row) return;
    const existing = row.nextElementSibling;
    if (existing && existing.classList.contains('db-org-confirm-row')) {
      existing.remove();
      return;
    }
    const cols = row.querySelectorAll('td').length;
    const confirmRow = document.createElement('tr');
    confirmRow.className = 'db-org-confirm-row';
    confirmRow.innerHTML = `
<td colspan="${cols}" class="db-org-confirm-cell">
  <div class="db-org-confirm-box">
    <span>Delete <strong>${esc(organiser)}</strong> (${esc(name)})?
      Their past submissions will remain safe. This cannot be undone.</span>
    <div class="db-org-confirm-btns">
      <button class="db-org-confirm-yes"
              data-zone="${btn.dataset.zone}" data-name="${btn.dataset.name}"
              data-role="${btn.dataset.role}" data-phone="${btn.dataset.phone}">
        DELETE CONFIRM
      </button>
      <button class="db-org-confirm-no">CANCEL</button>
    </div>
  </div>
</td>`;
    row.parentNode.insertBefore(confirmRow, row.nextSibling);

    confirmRow.querySelector('.db-org-confirm-yes').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      b.disabled    = true;
      b.textContent = 'Deleting…';
      try {
        const data = await FirestoreDB.adminDeleteOrganiser(b.dataset.phone);
        if (data.status !== 'ok') throw new Error(data.message || 'Delete failed.');
        confirmRow.remove();
        loadOrganisers();
      } catch (err) {
        alert('Error: ' + err.message);
        b.disabled    = false;
        b.textContent = 'DELETE CONFIRM';
      }
    });

    confirmRow.querySelector('.db-org-confirm-no').addEventListener('click', () => {
      confirmRow.remove();
    });
  }

  function orgShowMsg(type, msg) {
    const el = document.getElementById('db-org-form-msg');
    if (!el) return;
    el.className = type === 'ok' ? 'db-org-form-msg db-org-msg-ok' : 'db-org-form-msg db-org-msg-err';
    el.textContent = msg;
  }

  function orgHideMsg() {
    const el = document.getElementById('db-org-form-msg');
    if (el) el.className = 'db-org-form-msg hidden';
  }

  // ══════════════════════════════════════════════════════════════
  // DEADLINE MANAGEMENT
  // ══════════════════════════════════════════════════════════════

  function renderDeadlineMgmt() {
    const dl  = (typeof App !== 'undefined') ? App.deadlines : {};
    const fmt = iso => {
      if (!iso) return '—';
      const d = new Date(iso);
      const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear() +
             ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    };
    return `
<div class="db-section db-section-deadlines" id="db-dl-section">
  <div class="db-section-title">Deadline Management</div>

  <div class="db-dl-current">
    <div class="db-dl-row">
      <span class="db-dl-lbl">School open:</span>
      <span class="db-dl-val" id="db-dl-show-school-open">${fmt(dl.School_Open)}</span>
    </div>
    <div class="db-dl-row">
      <span class="db-dl-lbl">School close:</span>
      <span class="db-dl-val" id="db-dl-show-school-close">${fmt(dl.School_Close)}</span>
    </div>
    <div class="db-dl-row">
      <span class="db-dl-lbl">Zone open:</span>
      <span class="db-dl-val" id="db-dl-show-zone-open">${fmt(dl.Zone_Open)}</span>
    </div>
    <div class="db-dl-row">
      <span class="db-dl-lbl">Zone close:</span>
      <span class="db-dl-val" id="db-dl-show-zone-close">${fmt(dl.Zone_Close)}</span>
    </div>
  </div>

  <div class="db-dl-btns">
    <button class="db-dl-btn db-dl-btn-extend" id="db-dl-btn-extend-school">
      Extend School Deadline
    </button>
    <button class="db-dl-btn db-dl-btn-extend" id="db-dl-btn-extend-zone">
      Extend Zone Deadline
    </button>
    <button class="db-dl-btn db-dl-btn-reset" id="db-dl-btn-reset">
      Reset to Original Dates
    </button>
    <button class="db-dl-btn db-dl-btn-close-now" id="db-dl-btn-close-now">
      Close Submissions Now
    </button>
    <button class="db-dl-btn db-dl-btn-reopen" id="db-dl-btn-reopen">
      Reopen Submissions
    </button>
  </div>

  <div id="db-dl-form-panel" class="db-dl-form-panel hidden">
    <div class="db-dl-form-title" id="db-dl-form-title">Extend Deadline</div>
    <div class="db-dl-form-grid">
      <label class="db-org-label" id="db-dl-f-school-open-wrap">School Open
        <input type="datetime-local" id="db-dl-f-school-open" class="db-org-input">
      </label>
      <label class="db-org-label">School Close *
        <input type="datetime-local" id="db-dl-f-school-close" class="db-org-input">
      </label>
      <label class="db-org-label" id="db-dl-f-zone-open-wrap">Zone Open *
        <input type="datetime-local" id="db-dl-f-zone-open" class="db-org-input">
      </label>
      <label class="db-org-label">Zone Close *
        <input type="datetime-local" id="db-dl-f-zone-close" class="db-org-input">
      </label>
    </div>
    <div class="db-org-form-btns">
      <button id="db-dl-f-save" class="db-org-f-save">Save Deadlines</button>
      <button id="db-dl-f-cancel" class="db-org-f-cancel">Cancel</button>
    </div>
    <div id="db-dl-form-msg" class="db-org-form-msg hidden"></div>
  </div>

  <div id="db-dl-msg" class="db-org-form-msg hidden"></div>
</div>`;
  }

  function bindDeadlineMgmt() {
    // Helpers
    const dlFormPanel = () => document.getElementById('db-dl-form-panel');
    const dlFormMsg   = () => document.getElementById('db-dl-form-msg');
    const dlMsg       = () => document.getElementById('db-dl-msg');

    function dlShowMsg(el, type, msg) {
      if (!el) return;
      el.className   = type === 'ok' ? 'db-org-form-msg db-org-msg-ok' : 'db-org-form-msg db-org-msg-err';
      el.textContent = msg;
    }

    function isoToLocal(iso) {
      if (!iso) return '';
      return iso.slice(0, 16);
    }

    function openForm(mode) {
      const panel = dlFormPanel();
      if (!panel) return;
      const dl = App.deadlines;
      const titleEl = document.getElementById('db-dl-form-title');

      const soWrap  = document.getElementById('db-dl-f-school-open-wrap');
      const zoWrap  = document.getElementById('db-dl-f-zone-open-wrap');

      if (mode === 'extend-school') {
        if (titleEl) titleEl.textContent = 'Extend School Deadline';
        if (soWrap)  soWrap.style.display  = 'none';
        if (zoWrap)  zoWrap.style.display  = 'none';
        document.getElementById('db-dl-f-school-close').value = isoToLocal(dl.School_Close);
        document.getElementById('db-dl-f-zone-open').value    = isoToLocal(dl.Zone_Open);
        document.getElementById('db-dl-f-zone-close').value   = isoToLocal(dl.Zone_Close);
        document.getElementById('db-dl-f-school-open').value  = isoToLocal(dl.School_Open);

      } else if (mode === 'extend-zone') {
        if (titleEl) titleEl.textContent = 'Extend Zone Deadline';
        if (soWrap)  soWrap.style.display  = 'none';
        if (zoWrap)  zoWrap.style.display  = 'none';
        document.getElementById('db-dl-f-school-close').value = isoToLocal(dl.School_Close);
        document.getElementById('db-dl-f-zone-open').value    = isoToLocal(dl.Zone_Open);
        document.getElementById('db-dl-f-zone-close').value   = isoToLocal(dl.Zone_Close);
        document.getElementById('db-dl-f-school-open').value  = isoToLocal(dl.School_Open);

      } else if (mode === 'reopen') {
        if (titleEl) titleEl.textContent = 'Reopen Submissions — Set New Dates';
        if (soWrap)  soWrap.style.display  = '';
        if (zoWrap)  zoWrap.style.display  = '';
        document.getElementById('db-dl-f-school-open').value  = isoToLocal(dl.School_Open);
        document.getElementById('db-dl-f-school-close').value = isoToLocal(dl.School_Close);
        document.getElementById('db-dl-f-zone-open').value    = isoToLocal(dl.Zone_Open);
        document.getElementById('db-dl-f-zone-close').value   = isoToLocal(dl.Zone_Close);
      }

      const msgEl = dlFormMsg();
      if (msgEl) msgEl.className = 'db-org-form-msg hidden';
      panel.classList.remove('hidden');
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    async function dlSave() {
      const saveBtn = document.getElementById('db-dl-f-save');
      const sc = document.getElementById('db-dl-f-school-close').value;
      const so = document.getElementById('db-dl-f-school-open').value;
      const zo = document.getElementById('db-dl-f-zone-open').value;
      const zc = document.getElementById('db-dl-f-zone-close').value;

      if (!sc || !zc) {
        dlShowMsg(dlFormMsg(), 'err', 'School Close and Zone Close are required.');
        return;
      }

      saveBtn.disabled    = true;
      saveBtn.textContent = 'Saving…';

      try {
        const dlPayload = {
          School_Open:  so || App.deadlines.School_Open,
          School_Close: sc,
          Zone_Open:    zo || App.deadlines.Zone_Open,
          Zone_Close:   zc,
        };
        const data = await FirestoreDB.saveDeadlines(dlPayload);
        if (data.status !== 'ok') throw new Error(data.message || 'Save failed.');

        App.setDeadlines(dlPayload);
        dlShowMsg(dlFormMsg(), 'ok', 'Deadlines saved. Countdown updated immediately.');
        updateDeadlineDisplay(dlPayload);
        setTimeout(() => {
          const p = dlFormPanel();
          if (p) p.classList.add('hidden');
        }, 1200);

      } catch (err) {
        dlShowMsg(dlFormMsg(), 'err', err.message);
      } finally {
        saveBtn.disabled    = false;
        saveBtn.textContent = 'Save Deadlines';
      }
    }

    async function dlReset() {
      const ok = confirm(
        'Reset all deadlines to original dates?\n\n' +
        'School: 26–30 May 2026\n' +
        'Zone: 1–5 June 2026\n\n' +
        'Confirm?'
      );
      if (!ok) return;

      const msg = dlMsg();
      if (msg) { msg.className = 'db-org-form-msg'; msg.textContent = 'Resetting…'; }

      try {
        const defaults = {
          School_Open:  '2026-05-26T00:00:00',
          School_Close: '2026-05-30T23:59:00',
          Zone_Open:    '2026-06-01T00:00:00',
          Zone_Close:   '2026-06-05T23:59:00',
        };
        const data = await FirestoreDB.saveDeadlines(defaults);
        if (data.status !== 'ok') throw new Error(data.message || 'Failed.');
        App.setDeadlines(defaults);
        updateDeadlineDisplay(defaults);
        if (msg) { msg.className = 'db-org-form-msg db-org-msg-ok'; msg.textContent = 'Deadlines reset to original.'; }
      } catch (err) {
        if (msg) { msg.className = 'db-org-form-msg db-org-msg-err'; msg.textContent = err.message; }
      }
    }

    async function dlCloseNow() {
      const ok = confirm(
        'Close all submissions right now?\n\n' +
        'This will prevent any new submissions from school and zone coordinators.\n\n' +
        'Close Now?'
      );
      if (!ok) return;

      const now  = new Date();
      const nowS = now.toISOString().slice(0, 16);
      const msg  = dlMsg();
      if (msg) { msg.className = 'db-org-form-msg'; msg.textContent = 'Closing…'; }

      try {
        const closedDl = {
          School_Open:  App.deadlines.School_Open,
          School_Close: nowS,
          Zone_Open:    App.deadlines.Zone_Open,
          Zone_Close:   nowS,
        };
        const data = await FirestoreDB.saveDeadlines(closedDl);
        if (data.status !== 'ok') throw new Error(data.message || 'Failed.');
        App.setDeadlines(closedDl);
        updateDeadlineDisplay(closedDl);
        if (msg) { msg.className = 'db-org-form-msg db-org-msg-ok'; msg.textContent = 'Submissions closed.'; }
      } catch (err) {
        if (msg) { msg.className = 'db-org-form-msg db-org-msg-err'; msg.textContent = err.message; }
      }
    }

    function updateDeadlineDisplay(dl) {
      const fmt = iso => {
        const d = new Date(iso);
        const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear() +
               ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
      };
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v); };
      set('db-dl-show-school-open',  dl.School_Open);
      set('db-dl-show-school-close', dl.School_Close);
      set('db-dl-show-zone-open',    dl.Zone_Open);
      set('db-dl-show-zone-close',   dl.Zone_Close);
    }

    // Bind button events
    const el = id => document.getElementById(id);
    const on = (id, fn) => { const e = el(id); if (e) e.addEventListener('click', fn); };

    on('db-dl-btn-extend-school', () => openForm('extend-school'));
    on('db-dl-btn-extend-zone',   () => openForm('extend-zone'));
    on('db-dl-btn-reopen',        () => openForm('reopen'));
    on('db-dl-f-save',            dlSave);
    on('db-dl-f-cancel',          () => { const p = dlFormPanel(); if (p) p.classList.add('hidden'); });
    on('db-dl-btn-reset',         dlReset);
    on('db-dl-btn-close-now',     dlCloseNow);
  }

  // ── Excel Exporting ───────────────────────────────────────────
  function exportExcel(type) {
    if (!_data) {
      alert("No data loaded to export yet.");
      return;
    }

    if (typeof XLSX === 'undefined') {
      alert("SheetJS library is not loaded. Please verify your internet connection or script tags.");
      return;
    }

    const schoolSubs = _data.schoolSubmissions || [];
    const zoneSubs   = _data.zoneSubmissions || [];

    const wb = XLSX.utils.book_new();

    const pad2 = n => n < 10 ? '0' + n : n;
    const formatExcelDate = iso => {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        const y = d.getFullYear();
        const m = pad2(d.getMonth() + 1);
        const day = pad2(d.getDate());
        const hr = pad2(d.getHours());
        const min = pad2(d.getMinutes());
        const sec = pad2(d.getSeconds());
        return `${y}-${m}-${day} ${hr}:${min}:${sec}`;
      } catch (_) {
        return String(iso);
      }
    };

    const mapSchoolRow = (r) => {
      let pTypeLabel = r.participantType || '';
      if (pTypeLabel === 'Learner' && r.learnerSubType) {
        pTypeLabel = 'Learner — ' + r.learnerSubType;
      }
      const supervisorMentor = r.supervisingTeacher || r.mentorName || r.mentor || '';
      return {
        'Timestamp':                  formatExcelDate(r.timestamp),
        'Ref#':                       r.ref || r.refNumber || '',
        'Zone':                       r.zone || '',
        'School':                     r.schoolName || r.school || '',
        'School Type':                r.schoolType || '',
        'Organiser Name':             r.organiserName || '',
        'Phone':                      r.phone || '',
        'Participant Type':           pTypeLabel,
        'Level':                      r.level || '',
        'Full Name':                  r.fullName || r.participant || '',
        'Age':                        r.age || '',
        'Sex':                        r.sex || r.gender || '',
        'Grade':                      r.gradeForm || r.grade || '',
        'Category':                   r.category || '',
        'Sub-Skill':                  r.subSkill || r.subType || '',
        'Innovation Title':           r.titleOfInnovation || r.title || '',
        'Supervising Teacher/Mentor': supervisorMentor,
        'Report Drive Link':          r.fileUrl || r.driveUrl || '',
        'Submitted By':               r.submittedBy || r.submitterRole || ''
      };
    };

    const mapZoneRow = (r) => {
      let pTypeLabel = r.participantType || '';
      if (pTypeLabel === 'Learner' && r.learnerSubType) {
        pTypeLabel = 'Learner — ' + r.learnerSubType;
      }
      const supervisorMentor = r.supervisingTeacher || r.mentorName || r.mentor || '';
      return {
        'Timestamp':                  formatExcelDate(r.timestamp),
        'Ref#':                       r.ref || r.refNumber || '',
        'Zone':                       r.zone || '',
        'Zonal Coordinator':          r.coordinatorName || '',
        'Phone':                      r.phone || '',
        'Participant School':         r.participantSchool || r.school || '',
        'School Type':                r.schoolType || '',
        'Participant Type':           pTypeLabel,
        'Level':                      r.level || '',
        'Full Name':                  r.fullName || r.participant || '',
        'Age':                        r.age || '',
        'Sex':                        r.sex || r.gender || '',
        'Grade':                      r.gradeForm || r.grade || '',
        'Category':                   r.category || '',
        'Sub-Skill':                  r.subSkill || r.subType || '',
        'Innovation Title':           r.titleOfInnovation || r.title || '',
        'Supervising Teacher/Mentor': supervisorMentor,
        'Report Drive Link':          r.fileUrl || r.driveUrl || '',
        'Submitted By':               r.submittedBy || r.submitterRole || ''
      };
    };

    if (type === 'school' || type === 'all') {
      const rows = schoolSubs.map(mapSchoolRow);
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'School Submissions');
    }

    if (type === 'zone' || type === 'all') {
      const rows = zoneSubs.map(mapZoneRow);
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Zone Submissions');
    }

    const filename = `JETS_Submissions_${type}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  }

  // ── Public API ────────────────────────────────────────────────
  return {
    render,
    destroy,
    openDrawer,
    closeActiveDrawer,
    closeDeleteDrawer,
    promptDelete,
    exportExcel,
    _manualRefresh: () => loadFullData(true),
    _reloadOrg:     () => loadOrganisers(),
  };

})();
