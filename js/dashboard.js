// ═══════════════════════════════════════════════════════════════
// dashboard.js — District Dashboard module
// JETS 2024-2026 | Lavushimanda District
// Theme: Orange #e67e22 + Navy #1a3c6e
// ═══════════════════════════════════════════════════════════════

const Dashboard = (() => {

  let _pageId, _auth, _data, _cacheTime, _feedTimer, _allSubs;
  const CACHE_MS       = 5 * 60 * 1000;  // 5 minutes
  const FEED_REFRESH_S = 60 * 1000;       // 60 seconds

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
         onerror="this.classList.add('logo-missing')">
    <div class="db-header-text">
      <p class="db-h-title">JETS 2024&#8211;2026 District Dashboard</p>
      <p class="db-h-sub">Lavushimanda District &nbsp;|&nbsp; Muchinga Region</p>
      <p class="db-h-dist">Signed in: <strong>${App.maskPhone(_auth.phone)}</strong> &mdash; ${_auth.organiserName}</p>
    </div>
    <img src="assets/jets-logo.png" alt="JETS Logo" class="db-logo"
         onerror="this.classList.add('logo-missing')">
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
    const sk = `<div class="db-skeleton"></div>`;
    return `
<div class="db-section">
  <div class="db-section-title">Overview</div>
  <div class="db-skeleton-counters">
    <div class="db-skeleton db-skeleton-counter"></div>
    <div class="db-skeleton db-skeleton-counter"></div>
    <div class="db-skeleton db-skeleton-counter"></div>
    <div class="db-skeleton db-skeleton-counter"></div>
  </div>
</div>
<div class="db-section">
  <div class="db-section-title">Zone Progress</div>
  <div style="padding:12px">
    ${[1,2,3,4,5].map(() => `<div class="db-skeleton db-skeleton-zone"></div>`).join('')}
  </div>
</div>
<div class="db-section">
  <div class="db-section-title">School Status (42 schools)</div>
  <div style="padding:12px">
    ${[1,2,3,4,5,6].map(() => `<div class="db-skeleton db-skeleton-row"></div>`).join('')}
  </div>
</div>`;
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
      const res  = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getFullDashboard', phone: _auth.phone }),
      });
      if (!res.ok) throw new Error('Server error ' + res.status);
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Dashboard load failed.');

      _data     = data;
      _allSubs  = data.allSubs || [];
      _cacheTime = Date.now();
      renderAll(data);

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
      const res  = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getRecentFeed', phone: _auth.phone }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === 'ok') {
        const feedEl = document.getElementById('db-feed-list');
        if (feedEl) feedEl.innerHTML = buildFeedItems(data.recentFeed || []);
        const tick = document.getElementById('db-feed-tick');
        if (tick) tick.textContent = 'Feed refreshed ' + fmtTimeShort(new Date().toISOString());
      }
    } catch (_) {}
  }

  function setRefreshBtn(loading) {
    const btn = document.getElementById('db-refresh-btn');
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = loading ? '&#8635; Loading…' : '&#8635; Refresh';
  }

  // ── Render All Sections ───────────────────────────────────────
  function renderAll(data) {
    const body = document.getElementById('db-body');
    if (!body) return;

    updateLastUpdated(data.cachedAt);

    body.innerHTML = `
${renderOverview(data.overview)}
${renderZones(data.zones)}
${renderSchoolList(data.schoolList)}
${renderFeed(data.recentFeed)}
${renderCoverage(data.coverage)}
${renderSkills(data.skills)}
${renderActions(data)}`;

    bindSchoolSearch();
    bindZoneToggles();
    bindSchoolRows();
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
  <div class="db-zone-coord">&#128101; ${esc(z.coordinator)} &nbsp;&bull;&nbsp; ${z.phone}</div>
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
    <input type="search" id="db-school-search" class="db-school-search" placeholder="&#128269; Search schools&hellip;">
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
      return `
<div class="db-feed-item">
  <div class="db-feed-time">${fmtTimeShort(f.time)}<br><span style="font-size:10px;color:#bbb">${fmtDate(f.time)}</span></div>
  <div>
    <div class="db-feed-school">${esc(f.school)}${srcBadge}</div>
    <div class="db-feed-meta">${esc(f.participant)} &mdash; ${esc(f.type)}</div>
    <div class="db-feed-ref">${esc(f.category)} &nbsp;&bull;&nbsp; ${esc(f.ref)}</div>
  </div>
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
    const exp   = data.exportUrl       || '#';
    const expS  = data.exportSchoolUrl || exp;
    const expZ  = data.exportZoneUrl   || exp;
    const drive = data.driveUrl        || '#';

    return `
<div class="db-section">
  <div class="db-section-title">Quick Actions</div>
  <div class="db-actions-body">
    <a href="${exp}" target="_blank" rel="noopener" class="db-action-btn db-action-primary">
      &#128190; Export All to Excel
    </a>
    <a href="${expS}" target="_blank" rel="noopener" class="db-action-btn db-action-secondary">
      &#128203; Export School Submissions
    </a>
    <a href="${expZ}" target="_blank" rel="noopener" class="db-action-btn db-action-secondary">
      &#128203; Export Zone Submissions
    </a>
    <a href="${drive}" target="_blank" rel="noopener" class="db-action-btn db-action-outline">
      &#128449; View Drive Files
    </a>
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

  // ── Public API ────────────────────────────────────────────────
  return {
    render,
    destroy,
    _manualRefresh: () => loadFullData(true),
  };

})();
