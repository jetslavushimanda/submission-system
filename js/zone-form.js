// zone-form.js — Zonal JETS Coordinator Selection Portal
// JETS 2026 | Lavushimanda District

const ZoneForm = (() => {

  let _pageId, _auth, _submitting = false;
  
  // State variables
  let _allCandidates = [];       // Array of all school submissions in zone
  let _selections = new Set();    // Set of selected candidate IDs
  let _autoSelections = new Set(); // Set of auto-selected candidate IDs
  let _activeSheet = null;
  let _activeTab = 'learner';      // 'learner' | 'teacher' | 'youth'
  
  let _selectedCategory = null;   // Active category for detail cards
  let _selectedSubject = null;    // Active subject for academic cards
  let _selectedSkill = null;      // Active skill for technical cards

  // Constants
  const ZONE_SLOT_TOTAL = 64;

  const INNOVATION_CATEGORIES = [
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

  const LEVELS = ['ECE & Primary', 'Junior Secondary', 'Senior Secondary'];

  const ACADEMIC_SLOTS = [
    { level: 'ECE & Primary', category: 'Quiz & Olympiads — Mathematics', label: 'ECE & Primary Mathematics' },
    { level: 'ECE & Primary', category: 'Quiz & Olympiads — Science', label: 'ECE & Primary Science' },
    { level: 'ECE & Primary', category: 'Quiz & Olympiads — CTS', label: 'ECE & Primary CTS' },
    { level: 'Junior Secondary', category: 'Quiz & Olympiads — Physics/Mathematics', label: 'Junior Physics/Math' },
    { level: 'Junior Secondary', category: 'Quiz & Olympiads — Biology/Chemistry', label: 'Junior Biology/Chem' },
    { level: 'Senior Secondary', category: 'Quiz & Olympiads — Physics/Mathematics', label: 'Senior Physics/Math' },
    { level: 'Senior Secondary', category: 'Quiz & Olympiads — Biology/Chemistry', label: 'Senior Biology/Chem' },
  ];

  const SKILL_LIMITS = {
    'Civil Engineering': 4,
    'Mechanical Engineering': 4,
    'Electronics Services': 2,
    'Fashion Technology': 1,
    'Cosmetology': 1,
  };

  const SKILL_CATEGORIES = Object.keys(SKILL_LIMITS);

  // ── Entry Point ───────────────────────────────────────────────
  function render(pageId, auth) {
    _pageId = pageId;
    _auth = auth;
    _submitting = false;
    _selections.clear();
    _autoSelections.clear();
    _activeSheet = null;
    _activeTab = 'learner';
    _selectedCategory = null;
    _selectedSubject = null;
    _selectedSkill = null;

    App.setPageHTML(pageId, buildHTML());
    bindEvents();
    loadAllZoneData();
  }

  function destroy() {}

  // ── Full Page HTML ────────────────────────────────────────────
  function buildHTML() {
    return `
<!-- Custom styling for the premium selection interface -->
<style>
  :root {
    --db-navy: #1a3c6e;
    --db-navy-light: #f0f4fa;
    --db-orange: #e67e22;
    --db-orange-light: #fdf5ee;
    --db-green: #2ecc71;
    --db-green-light: #ebfcf2;
    --db-gray: #7f8c8d;
    --db-gray-light: #f8f9fa;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
  }
  .collapsible-card {
    background: #fff;
    border-radius: var(--radius-md);
    border: 1.5px solid #e8eef7;
    margin-bottom: 16px;
    overflow: hidden;
  }
  .collapsible-trigger {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 18px;
    cursor: pointer;
    font-weight: 700;
    color: var(--db-navy);
    background: var(--db-navy-light);
    user-select: none;
  }
  .collapsible-arrow {
    transition: transform 0.3s ease;
    font-size: 12px;
  }
  .collapsible-arrow.open {
    transform: rotate(180deg);
  }
  .collapsible-content {
    padding: 16px;
    border-top: 1.5px solid #e8eef7;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    padding: 4px 0;
    border-bottom: 1px dashed #f0f0f0;
  }
  .info-label { color: #555; font-weight: 500; }
  .info-value { color: var(--db-navy); font-weight: 700; }
  .sf-wrong-details {
    font-size: 11px;
    color: #e74c3c;
    margin: 8px 0 0 0;
    font-weight: 600;
    text-align: center;
  }

  /* Counter & Progress bar */
  .selection-counter-card {
    background: #fff;
    border: 1.5px solid #e8eef7;
    border-radius: var(--radius-md);
    padding: 18px;
    margin-bottom: 16px;
    text-align: center;
  }
  .counter-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--db-navy);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .counter-display {
    font-size: 32px;
    font-weight: 800;
    color: var(--db-navy);
    margin-bottom: 10px;
  }
  .counter-display span {
    color: var(--db-orange);
  }
  .progress-track {
    height: 10px;
    background: #eaeded;
    border-radius: 5px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .progress-fill {
    height: 100%;
    width: 0%;
    transition: width 0.4s ease, background 0.4s ease;
  }
  .progress-fill.blue { background: #3498db; }
  .progress-fill.orange { background: var(--db-orange); }
  .progress-fill.green { background: var(--db-green); }
  .progress-note {
    font-size: 12px;
    font-weight: 600;
    color: #555;
  }

  /* Grid Layout buttons */
  .selection-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 24px;
  }
  .selection-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 96px;
    padding: 12px;
    background: #fff;
    border: 1.5px solid #e8eef7;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.25s ease, box-shadow 0.25s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .selection-btn:active {
    transform: scale(0.96);
  }
  .selection-btn-icon svg {
    width: 24px;
    height: 24px;
    color: var(--db-navy);
    transition: color 0.25s ease;
  }
  .selection-btn-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--db-navy);
  }
  .selection-btn-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .badge-empty { background: #eaeded; color: #7f8c8d; }
  .badge-partial { background: var(--db-orange-light); color: var(--db-orange); }
  .badge-complete { background: var(--db-green-light); color: var(--db-green); }

  .selection-btn-full {
    grid-column: 1 / span 2;
    min-height: 56px;
    background: var(--db-navy);
    border: none;
  }
  .selection-btn-full .selection-btn-title {
    color: #fff;
    font-size: 14px;
  }
  .selection-btn-full:active {
    background: #11294d;
  }

  /* Slide Sheet styling */
  .slide-sheet {
    position: fixed;
    top: 0;
    right: -100%;
    width: 100%;
    max-width: 540px;
    height: 100%;
    background: #fff;
    box-shadow: -4px 0 20px rgba(0,0,0,0.15);
    z-index: 1000;
    transition: right 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    display: flex;
    flex-direction: column;
  }
  .slide-sheet.active {
    right: 0;
  }
  .sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: linear-gradient(135deg, var(--db-navy-dark), var(--db-navy));
    color: #fff;
    flex-wrap: nowrap;
    gap: 12px;
  }
  .sheet-title {
    font-size: 16px;
    font-weight: 700;
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .btn-close-sheet {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: #fff;
    font-size: 22px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    line-height: 1;
    flex-shrink: 0;
  }
  .btn-close-sheet:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  .btn-close-sheet:active {
    transform: scale(0.92);
  }
  .sheet-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f8fafe;
  }

  .sheet-back-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }
  .btn-sheet-back {
    background: none;
    border: none;
    color: var(--db-navy);
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
  }
  .btn-sheet-back:active { background: #eaeded; }

  /* Subtabs */
  .sheet-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    background: #eaeded;
    padding: 4px;
    border-radius: 8px;
    margin-bottom: 16px;
  }
  .sheet-tab-btn {
    border: none;
    background: none;
    padding: 8px 4px;
    font-size: 12px;
    font-weight: 700;
    color: #555;
    border-radius: 6px;
    cursor: pointer;
    text-align: center;
  }
  .sheet-tab-btn.active {
    background: #fff;
    color: var(--db-navy);
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
  }

  /* List & Category Buttons */
  .category-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .category-btn {
    background: #fff;
    border: 1.5px solid #e8eef7;
    border-radius: var(--radius-md);
    padding: 14px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }
  .category-btn:active { transform: scale(0.99); }
  .category-name {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--db-navy);
    flex: 1;
    padding-right: 12px;
  }
  .category-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }
  .category-avail {
    font-size: 11px;
    font-weight: 600;
    color: #7f8c8d;
  }

  /* Participant cards */
  .level-section-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--db-gray);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin: 16px 0 8px 0;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 4px;
  }
  .participant-card {
    background: #fff;
    border: 1.5px solid #e8eef7;
    border-radius: var(--radius-md);
    padding: 16px;
    margin-bottom: 12px;
    position: relative;
    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
    transition: background 0.3s ease, border-color 0.3s ease;
  }
  .participant-card.selected {
    background: var(--db-green-light);
    border-color: var(--db-green);
  }
  .card-badge {
    position: absolute;
    top: 14px;
    right: 14px;
    font-size: 9px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 12px;
    letter-spacing: 0.3px;
  }
  .badge-selected-manual { background: var(--db-green); color: #fff; }
  .badge-selected-auto { background: #27ae60; color: #fff; }

  .p-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--db-navy);
    margin-bottom: 6px;
    padding-right: 64px;
  }
  .p-school {
    font-size: 12px;
    font-weight: 600;
    color: #555;
    margin-bottom: 4px;
  }
  .p-details {
    font-size: 11.5px;
    font-weight: 600;
    color: #7f8c8d;
    margin-bottom: 4px;
  }
  .p-title {
    font-size: 12.5px;
    font-style: italic;
    color: #444;
    margin-top: 6px;
    border-top: 1px dashed #f0f0f0;
    padding-top: 6px;
  }
  .p-select-wrapper {
    display: flex;
    justify-content: flex-end;
    margin-top: 12px;
  }
  .btn-select {
    border: 1.5px solid var(--db-navy);
    background: none;
    color: var(--db-navy);
    font-size: 12px;
    font-weight: 700;
    padding: 6px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .btn-select.selected {
    border-color: #c0392b;
    color: #c0392b;
  }
  .btn-select:active { transform: scale(0.96); }

  .empty-slot-msg {
    font-size: 12px;
    font-style: italic;
    color: #7f8c8d;
    padding: 8px 12px;
    background: var(--db-gray-light);
    border-radius: 6px;
    text-align: center;
  }

  .slot-full-note {
    font-size: 11.5px;
    color: #e67e22;
    font-weight: 600;
    margin-top: 8px;
    text-align: right;
  }

  /* Overlay backdrop */
  .sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(13, 35, 71, 0.4);
    backdrop-filter: blur(2px);
    z-index: 990;
    display: none;
  }
  .sheet-overlay.active {
    display: block;
  }

  /* Drawer Summary list styling */
  .summary-sec {
    margin-bottom: 18px;
  }
  .summary-sec-title {
    font-size: 12px;
    font-weight: 800;
    color: var(--db-navy);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: var(--db-navy-light);
    padding: 6px 12px;
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #fff;
    border: 1px solid #e8eef7;
    border-radius: 6px;
    margin-bottom: 6px;
  }
  .sum-p-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    padding-right: 12px;
  }
  .sum-p-title { font-size: 13.5px; font-weight: 700; color: #2c3e50; }
  .sum-p-cat { font-size: 11px; font-weight: 600; color: #7f8c8d; }
  .sum-p-type-auto { font-size: 9px; font-weight: 700; background: var(--db-green-light); color: var(--db-green); padding: 1px 6px; border-radius: 4px; align-self: flex-start; }
  .sum-p-type-manual { font-size: 9px; font-weight: 700; background: #e8f4fd; color: #3498db; padding: 1px 6px; border-radius: 4px; align-self: flex-start; }
  .btn-sum-deselect {
    border: 1px solid #c0392b;
    background: none;
    color: #c0392b;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
  }
  .btn-sum-deselect:active { transform: scale(0.96); }

  .empty-slots-title {
    font-size: 12px;
    font-weight: 800;
    color: #7f8c8d;
    text-transform: uppercase;
    background: #eaeded;
    padding: 6px 12px;
    border-radius: 6px;
    margin-bottom: 8px;
    margin-top: 16px;
  }
  .empty-slots-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .empty-slot-item {
    font-size: 11.5px;
    color: #7f8c8d;
    background: #fafafa;
    border: 1px solid #f0f0f0;
    padding: 6px 12px;
    border-radius: 6px;
  }

  .summary-tot-card {
    background: var(--db-navy-light);
    border: 1.5px dashed var(--db-navy);
    padding: 14px;
    border-radius: 8px;
    margin-top: 20px;
    font-size: 13px;
    line-height: 1.6;
  }

  /* Success page styling */
  .success-panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #fff;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    text-align: center;
  }
  .success-icon {
    font-size: 64px;
    color: var(--db-green);
    margin-bottom: 16px;
  }
  .success-title {
    font-size: 22px;
    font-weight: 800;
    color: var(--db-navy);
    margin-bottom: 12px;
  }
  .success-card {
    background: #f8fafe;
    border: 1.5px solid #e2e8f0;
    border-radius: var(--radius-lg);
    padding: 20px;
    width: 100%;
    max-width: 400px;
    margin-bottom: 24px;
    text-align: left;
    font-size: 13px;
    line-height: 1.6;
  }
</style>

<!-- Initial Loading Screen -->
<div id="zf-initial-loading" class="auth-status-wrap">
  <div class="auth-status-card">
    <div class="spinner-dark"></div>
    <div class="auth-checking-text">Loading Zone Submissions...</div>
  </div>
</div>

<!-- Selection Interface Dashboard -->
<div class="sf-main-view hidden" id="zf-main-content">
  <div class="form-topbar" style="background: linear-gradient(135deg, #0d2347, #1a3c6e);">
    <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
    <span class="topbar-title">Zone Selection Portal</span>
    <button class="btn-signout-form" onclick="App.signOut()">Sign Out</button>
  </div>

  <header class="sf-header">
    <div class="sf-header-logos">
      <img src="assets/coat-of-arms.png" alt="Zambia Coat of Arms" class="sf-logo" onerror="this.outerHTML='<span class=&quot;logo-text-fb&quot;></span>'">
      <div class="sf-header-text">
        <p class="sf-h-title">JETS 2026 DISTRICT SELECTION</p>
        <p class="sf-h-sub">Zone Selection Dashboard</p>
        <p class="sf-h-district">Lavushimanda District &nbsp;|&nbsp; Muchinga Region</p>
      </div>
      <img src="assets/jets-logo.png" alt="JETS Logo" class="sf-logo" onerror="this.outerHTML='<span class=&quot;logo-text-fb&quot;></span>'">
    </div>
    <div class="sf-signedin-bar">
      Signed in as: &nbsp;<strong>${App.maskPhone(_auth.phone)}</strong> &mdash; ${_auth.organiserName}
    </div>
  </header>

  <div class="sf-body">
    <!-- Collapsible Zone Info Card -->
    <div class="collapsible-card" id="zf-info-card">
      <div class="collapsible-trigger" onclick="ZoneForm.toggleInfoCard()">
        <span>Zone Coordinator Details</span>
        <span class="collapsible-arrow" id="zf-arrow">&#9662;</span>
      </div>
      <div class="collapsible-content hidden" id="zf-info-content">
        <div class="info-row"><span class="info-label">Zone Name</span><span class="info-value">${_auth.zone} Zone</span></div>
        <div class="info-row"><span class="info-label">Zonal JETS Coordinator</span><span class="info-value">${_auth.organiserName}</span></div>
        <div class="info-row"><span class="info-label">Phone Number</span><span class="info-value">${_auth.phone}</span></div>
        <p class="sf-wrong-details">Wrong details? Contact the District JETS Organiser: 0973375828</p>
      </div>
    </div>

    <!-- Main Selection Counter & Progress Bar -->
    <div class="selection-counter-card">
      <div class="counter-title">Zonal Selections Quota</div>
      <div class="counter-display" id="main-counter">Selected: <span id="main-selected-count">0</span> of 64</div>
      <div class="progress-track">
        <div id="main-progress-fill" class="progress-fill blue" style="width: 0%"></div>
      </div>
      <div class="progress-note" id="main-progress-note">Select participants to fill the district fair roster.</div>
    </div>

    <!-- Grid Buttons Layout -->
    <div class="selection-grid">
      <button class="selection-btn" onclick="ZoneForm.openSheet('innovations')">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6L15 17H9l-.7-2C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z"/></svg></span>
        <span class="selection-btn-title">INNOVATIONS</span>
        <span class="selection-btn-badge badge-empty" id="badge-innovations">0/27</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSheet('academics')">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
        <span class="selection-btn-title">ACADEMICS</span>
        <span class="selection-btn-badge badge-empty" id="badge-academics">0/7</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSheet('skills')">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>
        <span class="selection-btn-title">SKILLS</span>
        <span class="selection-btn-badge badge-empty" id="badge-skills">0/12</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSheet('teachers')">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
        <span class="selection-btn-title">TEACHERS</span>
        <span class="selection-btn-badge badge-empty" id="badge-teachers">0/9</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSheet('youth')">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg></span>
        <span class="selection-btn-title">YOUTH</span>
        <span class="selection-btn-badge badge-empty" id="badge-youth">0/9</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSummary()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
        <span class="selection-btn-title">SUMMARY</span>
        <span class="selection-btn-badge badge-empty" id="badge-summary" style="background:#f0f4fa; color:var(--db-navy);">VIEW</span>
      </button>

      <button class="selection-btn selection-btn-full" onclick="ZoneForm.openConfirmSubmit()">
        <span class="selection-btn-title" id="submit-btn-label">SUBMIT 0 OF 64 SELECTIONS</span>
      </button>
    </div>
  </div>
</div>

<!-- Backdrop sheet overlay -->
<div id="sheet-overlay" class="sheet-overlay" onclick="ZoneForm.closeSheet()"></div>

<!-- Slide Sheet: Innovations -->
<div id="sheet-innovations" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">Innovations Selection</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeSheet()">&times;</button>
  </div>
  <div class="sheet-body">
    <div class="sheet-tabs">
      <button class="sheet-tab-btn active" id="tab-learner" onclick="ZoneForm.switchSubTab('learner')">Learner</button>
      <button class="sheet-tab-btn" id="tab-teacher" onclick="ZoneForm.switchSubTab('teacher')">Teacher</button>
      <button class="sheet-tab-btn" id="tab-youth" onclick="ZoneForm.switchSubTab('youth')">Youth</button>
    </div>
    <div id="innovations-list" class="category-list"></div>
  </div>
</div>

<!-- Slide Sheet: Category Detail / Selection Cards -->
<div id="sheet-category-detail" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title" id="cat-detail-title">Category Title</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeCategoryDetail()">&times;</button>
  </div>
  <div class="sheet-back-bar">
    <button class="btn-sheet-back" onclick="ZoneForm.closeCategoryDetail()">&#8592; Back to Innovations</button>
  </div>
  <div class="sheet-body" id="cat-detail-body">
  </div>
</div>

<!-- Slide Sheet: Academics -->
<div id="sheet-academics" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">Academics / Quiz Selection</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeSheet()">&times;</button>
  </div>
  <div class="sheet-body" id="academics-body">
  </div>
</div>

<!-- Slide Sheet: Academics Subject Detail -->
<div id="sheet-acad-detail" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title" id="acad-detail-title">Subject Title</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeAcadDetail()">&times;</button>
  </div>
  <div class="sheet-back-bar">
    <button class="btn-sheet-back" onclick="ZoneForm.closeAcadDetail()">&#8592; Back to Academics</button>
  </div>
  <div class="sheet-body" id="acad-detail-body">
  </div>
</div>

<!-- Slide Sheet: Technical Skills -->
<div id="sheet-skills" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">Technical Skills Selection</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeSheet()">&times;</button>
  </div>
  <div class="sheet-body" id="skills-body">
  </div>
</div>

<!-- Slide Sheet: Skills Category Detail -->
<div id="sheet-skill-detail" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title" id="skill-detail-title">Skill Category</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeSkillDetail()">&times;</button>
  </div>
  <div class="sheet-back-bar">
    <button class="btn-sheet-back" onclick="ZoneForm.closeSkillDetail()">&#8592; Back to Skills</button>
  </div>
  <div class="sheet-body" id="skill-detail-body">
  </div>
</div>

<!-- Bottom Drawer: Selection Summary -->
<div id="drawer-summary" class="slide-sheet" style="top: auto; bottom: -100%; height: 80%; width: 100%; max-width: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
  <div class="sheet-header" style="border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
    <span class="sheet-title">Zonal Selections Summary</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeDrawer('summary')">&times;</button>
  </div>
  <div class="sheet-body" id="summary-body">
  </div>
</div>

<!-- Bottom Drawer: Submit Selections Confirmation -->
<div id="drawer-confirm" class="slide-sheet" style="top: auto; bottom: -100%; height: 70%; width: 100%; max-width: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
  <div class="sheet-header" style="border-radius: var(--radius-lg) var(--radius-lg) 0 0; background: var(--db-navy);">
    <span class="sheet-title">Confirm Zone Selections</span>
    <button class="btn-close-sheet" onclick="ZoneForm.closeDrawer('confirm')">&times;</button>
  </div>
  <div class="sheet-body" id="confirm-body" style="padding: 24px;">
  </div>
</div>

<!-- Submission Success Overlay -->
<div id="panel-success" class="success-panel hidden">
  <div class="success-icon">&#10004;</div>
  <div class="success-title">Selections Successfully Submitted!</div>
  <div class="success-card" id="success-card-body">
  </div>
  <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 400px;">
    <button onclick="ZoneForm.sendWhatsApp()" class="db-action-btn db-action-primary" style="background:#25d366; color:#fff; padding: 14px; font-weight:700; border:none; border-radius:8px; cursor:pointer;">
      💬 SEND WHATSAPP REPORT
    </button>
    <button onclick="App.backToLanding()" class="db-action-btn db-action-outline" style="border:1.5px solid var(--db-navy); color:var(--db-navy); background:#fff; padding: 14px; font-weight:700; border-radius:8px; cursor:pointer;">
      🏡 RETURN TO LANDING
    </button>
  </div>
</div>
`;
  }

  // ── Collapsible Card Toggle ──────────────────────────────────
  function toggleInfoCard() {
    const content = document.getElementById('zf-info-content');
    const arrow = document.getElementById('zf-arrow');
    if (!content) return;
    const isHidden = content.classList.contains('hidden');
    content.classList.toggle('hidden', !isHidden);
    if (arrow) arrow.classList.toggle('open', isHidden);
  }

  // ── Database Data Loading ─────────────────────────────────────
  async function loadAllZoneData() {
    const spinner = document.getElementById('zf-initial-loading');
    const content = document.getElementById('zf-main-content');
    try {
      // Query all school submissions inside coordinator's zone
      const snap = await db.collection('school_submissions')
        .where('zone', '==', _auth.zone)
        .get();
      
      _allCandidates = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch existing selections to recover state if already submitted
      const selectionSnap = await db.collection('zone_submissions')
        .where('zone', '==', _auth.zone)
        .get();

      const existingSelIds = new Set(selectionSnap.docs.map(d => d.id));

      // Calculate auto-selections
      precomputeSelections(existingSelIds);

      updateDashboardState();

    } catch (err) {
      console.error('Failed to load school submissions roster', err);
      alert('Error fetching submission roster. Please try again.');
    } finally {
      if (spinner) spinner.classList.add('hidden');
      if (content) content.classList.remove('hidden');
    }
  }

  // Helper to generate info rows
  function ir(lbl, val) {
    return `<div class="info-row"><span class="info-label">${lbl}</span><span class="info-value">${val}</span></div>`;
  }

  // ── State Computation ─────────────────────────────────────────
  function precomputeSelections(existingSelIds) {
    _selections.clear();
    _autoSelections.clear();

    // 1. Learner Innovations
    INNOVATION_CATEGORIES.forEach(cat => {
      LEVELS.forEach(lvl => {
        const matches = _allCandidates.filter(c => 
          c.participantType === 'Learner' &&
          (c.learnerSubType || 'Innovations') === 'Innovations' &&
          c.category === cat &&
          c.level === lvl
        );
        if (matches.length === 1) {
          const cid = matches[0].id;
          _autoSelections.add(cid);
          _selections.add(cid);
        } else if (matches.length > 1) {
          // If already submitted previously, restore selection
          const prev = matches.find(m => existingSelIds.has(m.id));
          if (prev) _selections.add(prev.id);
        }
      });
    });

    // 2. Teacher Innovations
    INNOVATION_CATEGORIES.forEach(cat => {
      const matches = _allCandidates.filter(c => 
        c.participantType === 'Teacher' &&
        c.category === cat
      );
      if (matches.length === 1) {
        const cid = matches[0].id;
        _autoSelections.add(cid);
        _selections.add(cid);
      } else if (matches.length > 1) {
        const prev = matches.find(m => existingSelIds.has(m.id));
        if (prev) _selections.add(prev.id);
      }
    });

    // 3. Youth Innovations
    INNOVATION_CATEGORIES.forEach(cat => {
      const matches = _allCandidates.filter(c => 
        c.participantType === 'Out-of-School Youth' &&
        c.category === cat
      );
      if (matches.length === 1) {
        const cid = matches[0].id;
        _autoSelections.add(cid);
        _selections.add(cid);
      } else if (matches.length > 1) {
        const prev = matches.find(m => existingSelIds.has(m.id));
        if (prev) _selections.add(prev.id);
      }
    });

    // 4. Academics
    ACADEMIC_SLOTS.forEach(slot => {
      const matches = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Academics / Quiz & Olympiads' &&
        c.category === slot.category &&
        c.level === slot.level
      );
      if (matches.length === 1) {
        const cid = matches[0].id;
        _autoSelections.add(cid);
        _selections.add(cid);
      } else if (matches.length > 1) {
        const prev = matches.find(m => existingSelIds.has(m.id));
        if (prev) _selections.add(prev.id);
      }
    });

    // 5. Technical Skills
    SKILL_CATEGORIES.forEach(skill => {
      const limit = SKILL_LIMITS[skill];
      const matches = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Technical Skills' &&
        c.category === skill
      );
      if (matches.length <= limit) {
        matches.forEach(m => {
          _autoSelections.add(m.id);
          _selections.add(m.id);
        });
      } else {
        matches.forEach(m => {
          if (existingSelIds.has(m.id)) _selections.add(m.id);
        });
      }
    });
  }

  // Real-time counter and progress bar states
  function updateDashboardState() {
    const count = _selections.size;
    
    // Main Counter update
    const selectedCountEl = document.getElementById('main-selected-count');
    if (selectedCountEl) selectedCountEl.textContent = count;

    // Progress Bar class & filling
    const fillEl = document.getElementById('main-progress-fill');
    const noteEl = document.getElementById('main-progress-note');
    if (fillEl) {
      const pct = Math.min(100, Math.round((count / ZONE_SLOT_TOTAL) * 100));
      fillEl.style.width = pct + '%';
      
      fillEl.className = 'progress-fill';
      if (count <= 32) {
        fillEl.classList.add('blue');
        if (noteEl) noteEl.textContent = 'Keep selecting to build your district roster.';
      } else if (count <= 55) {
        fillEl.classList.add('orange');
        if (noteEl) noteEl.textContent = 'Halfway there! Keep selecting winners.';
      } else if (count < 64) {
        fillEl.classList.add('green');
        if (noteEl) noteEl.textContent = 'Excellent coverage! Almost ready.';
      } else {
        fillEl.classList.add('green');
        if (noteEl) noteEl.innerHTML = '<span style="color:var(--db-green); font-weight:bold;">🎉 Full Quota Reached! Ready to Submit!</span>';
      }
    }

    // Main button progress badges
    updateGridBadges();

    // Bottom submit button text
    const submitBtn = document.getElementById('submit-btn-label');
    if (submitBtn) submitBtn.textContent = `SUBMIT ${count} OF 64 SELECTIONS`;
  }

  // Section quota badge calculators
  function getSectionProgress(section) {
    let selected = 0;
    let quota = 0;

    if (section === 'innovations') {
      quota = 27;
      INNOVATION_CATEGORIES.forEach(cat => {
        LEVELS.forEach(lvl => {
          const candidates = _allCandidates.filter(c => 
            c.participantType === 'Learner' &&
            (c.learnerSubType || 'Innovations') === 'Innovations' &&
            c.category === cat &&
            c.level === lvl
          );
          if (candidates.some(c => _selections.has(c.id))) selected++;
        });
      });
    } else if (section === 'academics') {
      quota = 7;
      ACADEMIC_SLOTS.forEach(slot => {
        const candidates = _allCandidates.filter(c => 
          c.participantType === 'Learner' &&
          c.learnerSubType === 'Academics / Quiz & Olympiads' &&
          c.category === slot.category &&
          c.level === slot.level
        );
        if (candidates.some(c => _selections.has(c.id))) selected++;
      });
    } else if (section === 'skills') {
      quota = 12;
      SKILL_CATEGORIES.forEach(skill => {
        const candidates = _allCandidates.filter(c => 
          c.participantType === 'Learner' &&
          c.learnerSubType === 'Technical Skills' &&
          c.category === skill
        );
        selected += candidates.filter(c => _selections.has(c.id)).length;
      });
    } else if (section === 'teachers') {
      quota = 9;
      INNOVATION_CATEGORIES.forEach(cat => {
        const candidates = _allCandidates.filter(c => 
          c.participantType === 'Teacher' &&
          c.category === cat
        );
        if (candidates.some(c => _selections.has(c.id))) selected++;
      });
    } else if (section === 'youth') {
      quota = 9;
      INNOVATION_CATEGORIES.forEach(cat => {
        const candidates = _allCandidates.filter(c => 
          c.participantType === 'Out-of-School Youth' &&
          c.category === cat
        );
        if (candidates.some(c => _selections.has(c.id))) selected++;
      });
    }

    return { selected, quota };
  }

  function updateGridBadges() {
    ['innovations', 'academics', 'skills', 'teachers', 'youth'].forEach(sec => {
      const badge = document.getElementById('badge-' + sec);
      if (!badge) return;

      const p = getSectionProgress(sec);
      badge.textContent = `${p.selected}/${p.quota}`;
      
      badge.className = 'selection-btn-badge';
      if (p.selected === 0) {
        badge.classList.add('badge-empty');
      } else if (p.selected < p.quota) {
        badge.classList.add('badge-partial');
      } else {
        badge.classList.add('badge-complete');
      }
    });
  }

  // ── Navigation Sheet Controllers ──────────────────────────────
  function openSheet(name) {
    _activeSheet = name;
    
    // Set overlay active
    const overlay = document.getElementById('sheet-overlay');
    if (overlay) overlay.classList.add('active');

    // Slide in the sheet
    const sheet = document.getElementById('sheet-' + name);
    if (sheet) sheet.classList.add('active');

    document.body.style.overflow = 'hidden';

    // Sheet specific initial renders
    if (name === 'innovations') {
      switchSubTab(_activeTab);
    } else if (name === 'academics') {
      renderAcademicsSheet();
    } else if (name === 'skills') {
      renderSkillsSheet();
    }
  }

  function closeSheet() {
    if (!_activeSheet) return;
    const sheet = document.getElementById('sheet-' + _activeSheet);
    if (sheet) sheet.classList.remove('active');

    const overlay = document.getElementById('sheet-overlay');
    if (overlay) overlay.classList.remove('active');

    document.body.style.overflow = '';
    _activeSheet = null;
    
    updateDashboardState();
  }

  // ── Innovations subtab controllers ─────────────────────────────
  function switchSubTab(tab) {
    _activeTab = tab;
    ['learner', 'teacher', 'youth'].forEach(t => {
      const btn = document.getElementById('tab-' + t);
      if (btn) btn.classList.toggle('active', t === tab);
    });

    renderInnovationsList();
  }

  function renderInnovationsList() {
    const listEl = document.getElementById('innovations-list');
    if (!listEl) return;

    const cards = INNOVATION_CATEGORIES.map(cat => {
      let avail = 0;
      let selected = 0;
      let limit = 0;

      if (_activeTab === 'learner') {
        limit = 3;
        LEVELS.forEach(lvl => {
          const matches = _allCandidates.filter(c => 
            c.participantType === 'Learner' &&
            (c.learnerSubType || 'Innovations') === 'Innovations' &&
            c.category === cat &&
            c.level === lvl
          );
          avail += matches.length;
          if (matches.some(m => _selections.has(m.id))) selected++;
        });
      } else if (_activeTab === 'teacher') {
        limit = 1;
        const matches = _allCandidates.filter(c => 
          c.participantType === 'Teacher' &&
          c.category === cat
        );
        avail = matches.length;
        if (matches.some(m => _selections.has(m.id))) selected++;
      } else if (_activeTab === 'youth') {
        limit = 1;
        const matches = _allCandidates.filter(c => 
          c.participantType === 'Out-of-School Youth' &&
          c.category === cat
        );
        avail = matches.length;
        if (matches.some(m => _selections.has(m.id))) selected++;
      }

      const metaBadge = selected === 0 ? '<span class="selection-btn-badge badge-empty">0 slots</span>'
                      : selected < limit ? `<span class="selection-btn-badge badge-partial">${selected}/${limit}</span>`
                      : `<span class="selection-btn-badge badge-complete">FILLED</span>`;

      return `
        <div class="category-btn" onclick="ZoneForm.showCategoryDetail('${esc(cat)}')">
          <span class="category-name">${esc(cat)}</span>
          <div class="category-meta">
            ${metaBadge}
            <span class="category-avail">${avail} available</span>
          </div>
        </div>`;
    }).join('');

    listEl.innerHTML = cards;
  }

  // Detailed sheet showing participant cards inside Innovations Category
  function showCategoryDetail(cat) {
    _selectedCategory = cat;
    const detailSheet = document.getElementById('sheet-category-detail');
    const titleEl = document.getElementById('cat-detail-title');
    const bodyEl = document.getElementById('cat-detail-body');

    if (titleEl) titleEl.textContent = cat;
    if (detailSheet) detailSheet.classList.add('active');

    renderCategoryDetailBody();
  }

  function closeCategoryDetail() {
    const detailSheet = document.getElementById('sheet-category-detail');
    if (detailSheet) detailSheet.classList.remove('active');
    _selectedCategory = null;
    switchSubTab(_activeTab);
  }

  function renderCategoryDetailBody() {
    const bodyEl = document.getElementById('cat-detail-body');
    if (!bodyEl || !_selectedCategory) return;

    let html = '';

    if (_activeTab === 'learner') {
      html = LEVELS.map(lvl => {
        const matches = _allCandidates.filter(c => 
          c.participantType === 'Learner' &&
          (c.learnerSubType || 'Innovations') === 'Innovations' &&
          c.category === _selectedCategory &&
          c.level === lvl
        );

        let content = '';
        if (matches.length === 0) {
          content = `<div class="empty-slot-msg">No ${lvl} submissions in this zone for this category</div>`;
        } else if (matches.length === 1) {
          content = buildParticipantCardHTML(matches[0], true);
        } else {
          content = matches.map(p => buildParticipantCardHTML(p, false)).join('');
        }

        return `
          <div class="level-section-title">${lvl} Section</div>
          ${content}`;
      }).join('');
    } else {
      // Teacher or Youth Selection
      const matches = _allCandidates.filter(c => 
        c.participantType === (_activeTab === 'teacher' ? 'Teacher' : 'Out-of-School Youth') &&
        c.category === _selectedCategory
      );

      if (matches.length === 0) {
        html = `<div class="empty-slot-msg" style="margin-top:24px;">No submissions in this zone for this category</div>`;
      } else if (matches.length === 1) {
        html = buildParticipantCardHTML(matches[0], true);
      } else {
        html = matches.map(p => buildParticipantCardHTML(p, false)).join('');
      }
    }

    bodyEl.innerHTML = html;
  }

  // ── Academics Tab Controllers ─────────────────────────────────
  function renderAcademicsSheet() {
    const bodyEl = document.getElementById('academics-body');
    if (!bodyEl) return;

    // Group subjects by Level
    const levelsGrouped = ['ECE & Primary', 'Junior Secondary', 'Senior Secondary'];
    
    const html = levelsGrouped.map(lvl => {
      const slots = ACADEMIC_SLOTS.filter(s => s.level === lvl);
      
      const buttons = slots.map(slot => {
        const matches = _allCandidates.filter(c => 
          c.participantType === 'Learner' &&
          c.learnerSubType === 'Academics / Quiz & Olympiads' &&
          c.category === slot.category &&
          c.level === slot.level
        );

        const isSelected = matches.some(m => _selections.has(m.id));
        const badge = isSelected ? '<span class="selection-btn-badge badge-complete">FILLED</span>'
                      : '<span class="selection-btn-badge badge-empty">0/1</span>';

        // Strip subject name of Quiz prefix for cleaner rendering
        const cleanSubj = slot.category.replace('Quiz & Olympiads — ', '');

        return `
          <div class="category-btn" onclick="ZoneForm.showAcadSubjectDetail('${esc(slot.category)}', '${esc(lvl)}')">
            <span class="category-name">${esc(cleanSubj)}</span>
            <div class="category-meta">
              ${badge}
              <span class="category-avail">${matches.length} available</span>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="level-section-title" style="margin-top: 10px;">${lvl}</div>
        <div class="category-list">${buttons}</div>`;
    }).join('');

    bodyEl.innerHTML = html;
  }

  function showAcadSubjectDetail(subject, level) {
    _selectedSubject = { subject, level };
    const detailSheet = document.getElementById('sheet-acad-detail');
    const titleEl = document.getElementById('acad-detail-title');
    const bodyEl = document.getElementById('acad-detail-body');

    const cleanTitle = subject.replace('Quiz & Olympiads — ', '') + ` (${level})`;
    if (titleEl) titleEl.textContent = cleanTitle;
    if (detailSheet) detailSheet.classList.add('active');

    renderAcadDetailBody();
  }

  function closeAcadDetail() {
    const detailSheet = document.getElementById('sheet-acad-detail');
    if (detailSheet) detailSheet.classList.remove('active');
    _selectedSubject = null;
    renderAcademicsSheet();
  }

  function renderAcadDetailBody() {
    const bodyEl = document.getElementById('acad-detail-body');
    if (!bodyEl || !_selectedSubject) return;

    const matches = _allCandidates.filter(c => 
      c.participantType === 'Learner' &&
      c.learnerSubType === 'Academics / Quiz & Olympiads' &&
      c.category === _selectedSubject.subject &&
      c.level === _selectedSubject.level
    );

    let html = '';
    if (matches.length === 0) {
      html = `<div class="empty-slot-msg" style="margin-top:24px;">No submissions for ${esc(_selectedSubject.subject.replace('Quiz & Olympiads — ', ''))} from schools in your zone.</div>`;
    } else if (matches.length === 1) {
      html = buildParticipantCardHTML(matches[0], true);
    } else {
      html = matches.map(p => buildParticipantCardHTML(p, false)).join('');
    }

    bodyEl.innerHTML = html;
  }

  // ── Technical Skills Tab Controllers ──────────────────────────
  function renderSkillsSheet() {
    const bodyEl = document.getElementById('skills-body');
    if (!bodyEl) return;

    const html = SKILL_CATEGORIES.map(skill => {
      const limit = SKILL_LIMITS[skill];
      const matches = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Technical Skills' &&
        c.category === skill
      );

      const selectedCount = matches.filter(m => _selections.has(m.id)).length;
      
      const badgeClass = selectedCount === 0 ? 'badge-empty'
                       : selectedCount < limit ? 'badge-partial' : 'badge-complete';
      
      const badge = `<span class="selection-btn-badge ${badgeClass}">${selectedCount}/${limit}</span>`;

      return `
        <div class="category-btn" style="margin-bottom:10px;" onclick="ZoneForm.showSkillCategoryDetail('${esc(skill)}')">
          <span class="category-name">${esc(skill)}</span>
          <div class="category-meta">
            ${badge}
            <span class="category-avail">${matches.length} available</span>
          </div>
        </div>`;
    }).join('');

    bodyEl.innerHTML = `<div class="category-list" style="margin-top:8px;">${html}</div>`;
  }

  function showSkillCategoryDetail(skill) {
    _selectedSkill = skill;
    const detailSheet = document.getElementById('sheet-skill-detail');
    const titleEl = document.getElementById('skill-detail-title');
    const bodyEl = document.getElementById('skill-detail-body');

    if (titleEl) titleEl.textContent = skill;
    if (detailSheet) detailSheet.classList.add('active');

    renderSkillDetailBody();
  }

  function closeSkillDetail() {
    const detailSheet = document.getElementById('sheet-skill-detail');
    if (detailSheet) detailSheet.classList.remove('active');
    _selectedSkill = null;
    renderSkillsSheet();
  }

  function renderSkillDetailBody() {
    const bodyEl = document.getElementById('skill-detail-body');
    if (!bodyEl || !_selectedSkill) return;

    const limit = SKILL_LIMITS[_selectedSkill];
    const matches = _allCandidates.filter(c => 
      c.participantType === 'Learner' &&
      c.learnerSubType === 'Technical Skills' &&
      c.category === _selectedSkill
    );

    let html = '';
    if (matches.length === 0) {
      html = `<div class="empty-slot-msg" style="margin-top:24px;">No submissions for ${esc(_selectedSkill)} from schools in your zone.</div>`;
    } else if (matches.length <= limit) {
      // Auto-selected
      html = matches.map(p => buildParticipantCardHTML(p, true)).join('');
    } else {
      // Manual selection list
      const selectedCount = matches.filter(m => _selections.has(m.id)).length;
      const isFull = selectedCount >= limit;

      html = matches.map(p => buildParticipantCardHTML(p, false, isFull)).join('');
      if (isFull) {
        html = `<div class="slot-full-note">⚠️ All ${limit} slot${limit > 1 ? 's' : ''} filled for this category</div>` + html;
      }
    }

    bodyEl.innerHTML = html;
  }

  // ── HTML Card Builder ──────────────────────────────────────────
  function buildParticipantCardHTML(p, isAuto, isCategoryFull = false) {
    const isSelected = _selections.has(p.id);
    const cardClass = isSelected ? 'participant-card selected' : 'participant-card';
    
    let badge = '';
    if (isAuto) {
      badge = '<span class="card-badge badge-selected-auto">AUTO SELECTED</span>';
    } else if (isSelected) {
      badge = '<span class="card-badge badge-selected-manual">SELECTED</span>';
    }

    let selectBtnHTML = '';
    if (!isAuto) {
      if (isSelected) {
        selectBtnHTML = `<button class="btn-select selected" onclick="ZoneForm.deselectParticipant('${p.id}')">DESELECT</button>`;
      } else {
        const disabledAttr = isCategoryFull ? 'disabled style="border-color:#ccc; color:#aaa; cursor:not-allowed;"' : '';
        selectBtnHTML = `<button class="btn-select" ${disabledAttr} onclick="ZoneForm.selectParticipant('${p.id}')">SELECT</button>`;
      }
    }

    const titleInfo = p.title ? `<div class="p-title"><strong>Title:</strong> ${esc(p.title)}</div>` : '';
    const detailsLine = p.learnerSubType === 'Technical Skills' 
      ? `Sub-Skill: ${esc(p.learnerSubskill || p.subSkill || 'General')}`
      : `Level: ${esc(p.level)} &nbsp;|&nbsp; Grade: ${esc(p.grade || '—')}`;

    return `
      <div class="${cardClass}" id="p-card-${p.id}">
        ${badge}
        <div class="p-name">${esc(p.fullName || p.participant)}</div>
        <div class="p-school">🏫 ${esc(p.schoolName || p.school)}</div>
        <div class="p-details">📝 ${detailsLine}</div>
        ${titleInfo}
        <div class="p-select-wrapper">${selectBtnHTML}</div>
      </div>`;
  }

  // ── Selection Logic Toggles ────────────────────────────────────
  function selectParticipant(id) {
    const candidate = _allCandidates.find(c => c.id === id);
    if (!candidate) return;

    // Apply selection rules depending on section
    if (candidate.participantType === 'Learner' && (candidate.learnerSubType || 'Innovations') === 'Innovations') {
      // Learner Innovations: Select ONLY 1 per level per category
      const siblings = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        (c.learnerSubType || 'Innovations') === 'Innovations' &&
        c.category === candidate.category &&
        c.level === candidate.level
      );
      siblings.forEach(s => _selections.delete(s.id));
      _selections.add(id);

    } else if (candidate.participantType === 'Teacher') {
      // Teacher: Select 1 per category
      const siblings = _allCandidates.filter(c => 
        c.participantType === 'Teacher' &&
        c.category === candidate.category
      );
      siblings.forEach(s => _selections.delete(s.id));
      _selections.add(id);

    } else if (candidate.participantType === 'Out-of-School Youth') {
      // Youth: Select 1 per category
      const siblings = _allCandidates.filter(c => 
        c.participantType === 'Out-of-School Youth' &&
        c.category === candidate.category
      );
      siblings.forEach(s => _selections.delete(s.id));
      _selections.add(id);

    } else if (candidate.participantType === 'Learner' && candidate.learnerSubType === 'Academics / Quiz & Olympiads') {
      // Academics: Select 1 per subject per level
      const siblings = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Academics / Quiz & Olympiads' &&
        c.category === candidate.category &&
        c.level === candidate.level
      );
      siblings.forEach(s => _selections.delete(s.id));
      _selections.add(id);

    } else if (candidate.participantType === 'Learner' && candidate.learnerSubType === 'Technical Skills') {
      // Technical Skills: Allow multiple up to limit
      const limit = SKILL_LIMITS[candidate.category];
      const siblings = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Technical Skills' &&
        c.category === candidate.category
      );
      const selectedSiblingsCount = siblings.filter(s => _selections.has(s.id)).length;
      if (selectedSiblingsCount < limit) {
        _selections.add(id);
      } else {
        alert(`Maximum ${limit} slots allowed for ${candidate.category}.`);
        return;
      }
    }

    // Refresh active details view
    if (_selectedCategory) renderCategoryDetailBody();
    if (_selectedSubject) renderAcadDetailBody();
    if (_selectedSkill) renderSkillDetailBody();

    updateDashboardState();
  }

  function deselectParticipant(id) {
    _selections.delete(id);

    // Refresh active details view
    if (_selectedCategory) renderCategoryDetailBody();
    if (_selectedSubject) renderAcadDetailBody();
    if (_selectedSkill) renderSkillDetailBody();

    updateDashboardState();

    // Refresh summary view if active
    const summaryDrawer = document.getElementById('drawer-summary');
    if (summaryDrawer && summaryDrawer.classList.contains('active')) {
      renderSummaryBody();
    }
  }

  // ── Bottom Drawer summary list ──────────────────────────────────
  function openSummary() {
    const summaryDrawer = document.getElementById('drawer-summary');
    const overlay = document.getElementById('sheet-overlay');
    if (summaryDrawer) summaryDrawer.classList.add('active');
    if (overlay) overlay.classList.add('active');

    renderSummaryBody();
  }

  function closeDrawer(name) {
    const drawer = document.getElementById('drawer-' + name);
    const overlay = document.getElementById('sheet-overlay');
    if (drawer) drawer.classList.remove('active');
    
    // Close overlay if no other panels slide
    const activeSheets = document.querySelectorAll('.slide-sheet.active');
    if (activeSheets.length === 0 && overlay) overlay.classList.remove('active');
  }

  function renderSummaryBody() {
    const bodyEl = document.getElementById('summary-body');
    if (!bodyEl) return;

    // Filters for summary
    const selectedList = _allCandidates.filter(c => _selections.has(c.id));

    // Groups logic
    const buildListHTML = (list) => {
      if (list.length === 0) return '<div class="empty-slot-msg" style="margin:4px 0 10px 0;">No selections made yet</div>';
      return list.map(p => {
        const isAuto = _autoSelections.has(p.id);
        const autoBadge = isAuto 
          ? '<span class="sum-p-type-auto">Auto-Selected</span>' 
          : '<span class="sum-p-type-manual">Manual Selection</span>';
        
        const deselectBtn = isAuto ? '' : `<button class="btn-sum-deselect" onclick="ZoneForm.deselectParticipant('${p.id}')">DESELECT</button>`;

        const titleLine = p.learnerSubType === 'Technical Skills' 
          ? `Sub-Skill: ${esc(p.learnerSubskill || p.subSkill || 'General')}`
          : p.learnerSubType === 'Academics / Quiz & Olympiads'
          ? `Subject: ${esc(p.category.replace('Quiz & Olympiads — ', ''))} | Level: ${esc(p.level)}`
          : `Level: ${esc(p.level)} | Category: ${esc(p.category)}`;

        return `
          <div class="summary-item">
            <div class="sum-p-info">
              <span class="sum-p-title">${esc(p.fullName || p.participant)}</span>
              <span style="font-size:12px; font-weight:600; color:#555;">🏫 ${esc(p.schoolName || p.school)}</span>
              <span class="sum-p-cat">${titleLine}</span>
              ${autoBadge}
            </div>
            ${deselectBtn}
          </div>`;
      }).join('');
    };

    // Calculate empty slots (where school submissions are zero)
    const emptySlots = [];
    
    // Check Innovations empty
    INNOVATION_CATEGORIES.forEach(cat => {
      LEVELS.forEach(lvl => {
        const candidates = _allCandidates.filter(c => 
          c.participantType === 'Learner' &&
          (c.learnerSubType || 'Innovations') === 'Innovations' &&
          c.category === cat &&
          c.level === lvl
        );
        if (candidates.length === 0) emptySlots.push(`Learner Innovations — ${cat} (${lvl})`);
      });
    });

    INNOVATION_CATEGORIES.forEach(cat => {
      const teachers = _allCandidates.filter(c => c.participantType === 'Teacher' && c.category === cat);
      if (teachers.length === 0) emptySlots.push(`Teacher Innovations — ${cat}`);
      const youth = _allCandidates.filter(c => c.participantType === 'Out-of-School Youth' && c.category === cat);
      if (youth.length === 0) emptySlots.push(`Youth Innovations — ${cat}`);
    });

    // Check Academics empty
    ACADEMIC_SLOTS.forEach(slot => {
      const candidates = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Academics / Quiz & Olympiads' &&
        c.category === slot.category &&
        c.level === slot.level
      );
      if (candidates.length === 0) emptySlots.push(`Academics — ${slot.label}`);
    });

    // Check Skills empty
    SKILL_CATEGORIES.forEach(skill => {
      const candidates = _allCandidates.filter(c => 
        c.participantType === 'Learner' &&
        c.learnerSubType === 'Technical Skills' &&
        c.category === skill
      );
      if (candidates.length === 0) emptySlots.push(`Technical Skills — ${skill}`);
    });

    const lInnov = selectedList.filter(c => c.participantType === 'Learner' && (c.learnerSubType || 'Innovations') === 'Innovations');
    const tInnov = selectedList.filter(c => c.participantType === 'Teacher');
    const yInnov = selectedList.filter(c => c.participantType === 'Out-of-School Youth');
    const acad   = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Academics / Quiz & Olympiads');
    const sk     = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Technical Skills');

    bodyEl.innerHTML = `
      <div class="summary-sec">
        <div class="summary-sec-title">Learner Innovations Selection (${lInnov.length} of 27)</div>
        ${buildListHTML(lInnov)}
      </div>
      <div class="summary-sec">
        <div class="summary-sec-title">Teacher Innovations Selection (${tInnov.length} of 9)</div>
        ${buildListHTML(tInnov)}
      </div>
      <div class="summary-sec">
        <div class="summary-sec-title">Youth Innovations Selection (${yInnov.length} of 9)</div>
        ${buildListHTML(yInnov)}
      </div>
      <div class="summary-sec">
        <div class="summary-sec-title">Academics Selection (${acad.length} of 7)</div>
        ${buildListHTML(acad)}
      </div>
      <div class="summary-sec">
        <div class="summary-sec-title">Technical Skills Selection (${sk.length} of 12)</div>
        ${buildListHTML(sk)}
      </div>

      <div class="empty-slots-title">Empty Slots / No School Submissions (${emptySlots.length})</div>
      <div class="empty-slots-list">
        ${emptySlots.length === 0 ? '<div class="empty-slot-msg">All zonal slot quotas have candidate submissions!</div>' : emptySlots.map(s => `<div class="empty-slot-item">⚠️ ${esc(s)}</div>`).join('')}
      </div>

      <div class="summary-tot-card">
        <strong>Selection Breakdown summary:</strong><br>
        • Learner Innovations: ${lInnov.length} / 27<br>
        • Teacher Innovations: ${tInnov.length} / 9<br>
        • Youth Innovations: ${yInnov.length} / 9<br>
        • Academics: ${acad.length} / 7<br>
        • Technical Skills: ${sk.length} / 12<br>
        <hr style="border:none; border-top:1px dashed #cbd5e1; margin:8px 0;">
        <strong>TOTAL SELECTED SLOT QUOTA: ${selectedList.length} of 64</strong>
      </div>
    `;
  }

  // ── Confirmation Drawer ─────────────────────────────────────────
  function openConfirmSubmit() {
    const confirmDrawer = document.getElementById('drawer-confirm');
    const overlay = document.getElementById('sheet-overlay');
    if (confirmDrawer) confirmDrawer.classList.add('active');
    if (overlay) overlay.classList.add('active');

    renderConfirmBody();
  }

  function renderConfirmBody() {
    const bodyEl = document.getElementById('confirm-body');
    if (!bodyEl) return;

    const count = _selections.size;
    const selectedList = _allCandidates.filter(c => _selections.has(c.id));

    const lInnov = selectedList.filter(c => c.participantType === 'Learner' && (c.learnerSubType || 'Innovations') === 'Innovations').length;
    const tInnov = selectedList.filter(c => c.participantType === 'Teacher').length;
    const yInnov = selectedList.filter(c => c.participantType === 'Out-of-School Youth').length;
    const acad   = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Academics / Quiz & Olympiads').length;
    const sk     = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Technical Skills').length;

    // Empty slots calculation
    let emptyCount = 64 - count;

    bodyEl.innerHTML = `
      <div style="font-size:14px; line-height:1.6; color:#333; margin-bottom:16px;">
        Are you sure you want to finalize and submit the JETS coordinator selections? 
        This will freeze these participants as representing your zone at the District Fair.
      </div>
      <div style="background:#f8fafe; border:1.5px solid #cbd5e1; border-radius:12px; padding:16px; margin-bottom:20px; font-family:monospace; font-size:13px; line-height:1.6;">
        <div style="font-weight:bold; color:var(--db-navy); border-bottom:1px solid #cbd5e1; padding-bottom:6px; margin-bottom:8px; font-size:14px; font-family:inherit;">📊 Selection Roster Summary</div>
        <div>Zone: ${_auth.zone} Zone</div>
        <div>Coordinator: ${_auth.organiserName}</div>
        <hr style="border:none; border-top:1px dashed #cbd5e1; margin:6px 0;">
        <div>• Learner Innovations: ${lInnov} of 27</div>
        <div>• Teacher Innovations: ${tInnov} of 9</div>
        <div>• Out-of-School Youth: ${yInnov} of 9</div>
        <div>• Academics Selection: ${acad} of 7</div>
        <div>• Technical Skills:    ${sk} of 12</div>
        <hr style="border:none; border-top:1px dashed #cbd5e1; margin:6px 0;">
        <strong>TOTAL SELECTIONS: ${count} OF 64</strong><br>
        <strong style="color:${emptyCount > 0 ? '#e67e22' : '#2ecc71'};">Empty Slots: ${emptyCount}</strong>
      </div>
      ${emptyCount > 0 ? `
        <div style="font-size:11px; background:#fffdf5; border:1px solid #ffeeba; color:#856404; padding:10px; border-radius:8px; line-height:1.4; margin-bottom:20px;">
          <strong>⚠️ Note on Empty Slots:</strong> Empty slots exist because schools in your zone submitted zero candidate entries for those categories. This is normal and fully acceptable.
        </div>
      ` : ''}
      <div style="display:flex; gap:12px;">
        <button onclick="ZoneForm.confirmAndSubmit()" id="btn-submit-final" class="db-action-btn db-action-primary" style="flex:2; padding: 14px; font-weight:700; border:none; border-radius:8px; cursor:pointer;">
          CONFIRM AND SUBMIT
        </button>
        <button onclick="ZoneForm.closeDrawer('confirm')" class="db-action-btn db-action-outline" style="flex:1; border:1.5px solid var(--db-navy); color:var(--db-navy); background:#fff; padding: 14px; font-weight:700; border-radius:8px; cursor:pointer;">
          GO BACK
        </button>
      </div>
    `;
  }

  // ── Submission write pipeline ────────────────────────────────
  async function confirmAndSubmit() {
    if (_submitting) return;
    _submitting = true;

    const btn = document.getElementById('btn-submit-final');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving selections…';
    }

    try {
      const selectedCandidates = _allCandidates.filter(c => _selections.has(c.id));
      const tsMs = Date.now();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const zoneRefCode = 'ZON-' + tsMs + '-' + rand;

      // Execute dual-collection writes in parallel
      const writes = selectedCandidates.map(async (p) => {
        const isAuto = _autoSelections.has(p.id);

        // Copy original details and add selection flags
        const selectionData = {
          ...p,
          zoneRef: zoneRefCode,
          selectionType: isAuto ? 'Auto' : 'Manual',
          selectedBy: _auth.organiserName,
          selectionTimestamp: new Date().toISOString(),
          zone: _auth.zone,
          status: 'Selected'
        };

        // 1. Write doc to zone_submissions
        await db.collection('zone_submissions').doc(p.id).set(selectionData);

        // 2. Update doc inside school_submissions
        await db.collection('school_submissions').doc(p.id).update({
          zoneSelected: true,
          zoneRef: zoneRefCode
        });
      });

      await Promise.all(writes);

      closeDrawer('confirm');
      showSuccessScreen(selectedCandidates.length, zoneRefCode);

    } catch (err) {
      console.error('Final Zonal submit pipeline transaction failed', err);
      alert('Failed to submit selections. Please check your internet connection.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'CONFIRM AND SUBMIT';
      }
    } finally {
      _submitting = false;
    }
  }

  // Success screen display
  function showSuccessScreen(total, refCode) {
    const successPanel = document.getElementById('panel-success');
    const successBody = document.getElementById('success-card-body');
    if (!successPanel || !successBody) return;

    const selectedList = _allCandidates.filter(c => _selections.has(c.id));
    const lInnov = selectedList.filter(c => c.participantType === 'Learner' && (c.learnerSubType || 'Innovations') === 'Innovations').length;
    const tInnov = selectedList.filter(c => c.participantType === 'Teacher').length;
    const yInnov = selectedList.filter(c => c.participantType === 'Out-of-School Youth').length;
    const acad   = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Academics / Quiz & Olympiads').length;
    const sk     = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Technical Skills').length;

    successBody.innerHTML = `
      <strong>Selections finalized!</strong><br>
      Reference Code: <code>${refCode}</code><br>
      Zone Name: ${_auth.zone} Zone<br>
      Total Finalized: ${total} of 64 slots<br>
      <hr style="border:none; border-top:1px dashed #cbd5e1; margin:8px 0;">
      • Learner Innovations: ${lInnov} slots<br>
      • Teacher Innovations: ${tInnov} slots<br>
      • Youth Innovations: ${yInnov} slots<br>
      • Academics Selection: ${acad} slots<br>
      • Technical Skills: ${sk} slots
    `;

    successPanel.classList.remove('hidden');
  }

  // Prefilled WhatsApp completion report generator
  function sendWhatsApp() {
    const total = _selections.size;
    const selectedList = _allCandidates.filter(c => _selections.has(c.id));
    const lInnov = selectedList.filter(c => c.participantType === 'Learner' && (c.learnerSubType || 'Innovations') === 'Innovations').length;
    const tInnov = selectedList.filter(c => c.participantType === 'Teacher').length;
    const yInnov = selectedList.filter(c => c.participantType === 'Out-of-School Youth').length;
    const acad   = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Academics / Quiz & Olympiads').length;
    const sk     = selectedList.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Technical Skills').length;

    const emptyCount = 64 - total;
    const dateStr = new Date().toLocaleString();

    const text = `*JETS 2026 — Zone Selection Complete*
━━━━━━━━━━━━━━━━━━
*Zone:* ${_auth.zone} Zone
*Coordinator:* ${_auth.organiserName}
*Date:* ${dateStr}

*Total Selected:* ${total} of 64 slots

• Learner Innovations: ${lInnov} selected
• Teacher Innovations: ${tInnov} selected
• Youth Innovations: ${yInnov} selected
• Academics Selection: ${acad} selected
• Technical Skills: ${sk} selected

*Empty slots:* ${emptyCount} (No school submissions)

Contact District JETS Organiser:
0973375828
━━━━━━━━━━━━━━━━━━
Lavushimanda District JETS 2026`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  // ── Global Event Bindings ─────────────────────────────────────
  function bindEvents() {}

  function esc(str) {
    return (str || '').toString()
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  return {
    render,
    destroy,
    toggleInfoCard,
    openSheet,
    closeSheet,
    switchSubTab,
    showCategoryDetail,
    closeCategoryDetail,
    selectParticipant,
    deselectParticipant,
    showAcadSubjectDetail,
    closeAcadDetail,
    showSkillCategoryDetail,
    closeSkillDetail,
    openSummary,
    closeDrawer,
    openConfirmSubmit,
    confirmAndSubmit,
    sendWhatsApp
  };

})();
