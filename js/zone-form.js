// zone-form.js — Zonal JETS Coordinator Selection Portal
// JETS 2026 | Lavushimanda District

const ZoneForm = (() => {

  let _pageId, _auth, _submitting = false;
  let _unsubscribe = null;

  // State variables
  let _allCandidates = [];       // Array of all school submissions in zone
  let _selections = new Set();    // Set of selected candidate IDs (persisted in Firestore)
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

  // ── Navigation Stack Routing Manager ───────────────────────────
  const Nav = {
    stack: [],
    
    push(viewName, onOpen, onClose) {
      this.stack.push({ name: viewName, close: onClose });
      onOpen();
      this.updateUI();
    },
    
    pop() {
      if (this.stack.length === 0) {
        App.backToLanding();
        return;
      }
      const top = this.stack.pop();
      if (top && top.close) {
        top.close();
      }
      this.updateUI();
    },
    
    clear() {
      while (this.stack.length > 0) {
        const top = this.stack.pop();
        if (top && top.close) top.close();
      }
      this.updateUI();
    },
    
    updateUI() {
      const overlay = document.getElementById('sheet-overlay');
      if (overlay) {
        overlay.classList.toggle('active', this.stack.length > 0);
      }
      document.body.style.overflow = this.stack.length > 0 ? 'hidden' : '';
      
      // Dynamically adjust z-index of sheets based on stack order
      this.stack.forEach((view, index) => {
        const elName = this.getElementName(view.name);
        const el = document.getElementById(elName);
        if (el) {
          el.style.zIndex = 1000 + index;
        }
      });
    },
    
    getElementName(viewName) {
      if (viewName === 'learner-innovations' || viewName === 'teacher-innovations' || viewName === 'youth-innovations') return 'sheet-innovations';
      if (viewName === 'category-detail') return 'sheet-category-detail';
      if (viewName === 'academics') return 'sheet-academics';
      if (viewName === 'acad-detail') return 'sheet-acad-detail';
      if (viewName === 'skills') return 'sheet-skills';
      if (viewName === 'skill-detail') return 'sheet-skill-detail';
      if (viewName === 'summary') return 'drawer-summary';
      if (viewName === 'zone-records') return 'drawer-zone-records';
      return '';
    }
  };

  function isLearnerInnov(c) {
    if (!c || c.participantType !== 'Learner') return false;
    const sub = c.learnerSubType || '';
    return sub !== 'Academics / Quiz & Olympiads' && sub !== 'Technical Skills';
  }

  // ── Entry Point ───────────────────────────────────────────────
  function render(pageId, auth) {
    _pageId = pageId;
    _auth = auth;
    _submitting = false;
    _selections = new Set();
    _activeSheet = null;
    _activeTab = 'learner';
    _selectedCategory = null;
    _selectedSubject = null;
    _selectedSkill = null;
    Nav.clear(); // Initialize clean navigation stack

    App.setPageHTML(pageId, buildHTML());
    bindEvents();

    // 1. Instant Cache Loading (Zero Firestore wait on Portal Open)
    const cached = localStorage.getItem(`jets_zone_cache_${auth.zone}`);
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData && Array.isArray(cacheData.candidates)) {
          _allCandidates = cacheData.candidates.map(c => _normalise(c));
          _selections = new Set(cacheData.selections || []);
          
          // Render the main dashboard instantly!
          const spinner = document.getElementById('zf-initial-loading');
          if (spinner) spinner.classList.add('hidden');
          const content = document.getElementById('zf-main-content');
          if (content) content.classList.remove('hidden');
          
          updateDashboardState();
        }
      } catch (e) {
        console.warn('Failed to parse zone cache', e);
      }
    }

    // 2. Fresh Fetch in background (silent sync and real-time bind)
    loadAllZoneData();
  }

  function destroy() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  }

  // ── Full Page HTML ────────────────────────────────────────────
  function buildHTML() {
    return `
<!-- Custom styling for the premium selection interface -->
<style>
  :root {
    --db-navy: #1a3c6e;
    --db-navy-dark: #0d2347;
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
    min-height: 100px;
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
    font-size: 12.5px;
    font-weight: 700;
    color: var(--db-navy);
    text-align: center;
    line-height: 1.2;
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
  .btn-sheet-back-header {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
    flex-shrink: 0;
  }
  .btn-sheet-back-header:hover {
    background: rgba(255, 255, 255, 0.3);
  }
  .btn-sheet-back-header:active {
    transform: scale(0.95);
  }

  .sheet-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background: #f8fafe;
  }

  /* Category card filled states */
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
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .category-btn:active { transform: scale(0.99); }
  .category-btn.filled {
    background: var(--db-green-light);
    border-color: var(--db-green);
  }
  .category-btn.available {
    background: var(--db-orange-light);
    border-color: var(--db-orange);
  }
  .category-btn.empty {
    background: #fdf2f2;
    border-color: #f5c6cb;
    opacity: 0.85;
  }
  .category-btn.empty .category-name {
    color: #721c24;
  }
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

  /* Selection Summary circular slot placeholders */
  .summary-sec {
    margin-bottom: 18px;
  }
  .summary-sec-title {
    font-size: 12.5px;
    font-weight: 800;
    color: var(--db-navy);
    letter-spacing: 0.5px;
    text-transform: uppercase;
    background: var(--db-navy-light);
    padding: 8px 12px;
    border-radius: 6px;
    margin-bottom: 8px;
  }
  .summary-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #fff;
    border: 1.5px solid #e8eef7;
    border-radius: var(--radius-md);
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

  .empty-slot-placeholder {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #fff;
    border: 1.5px dashed #cbd5e1;
    border-radius: var(--radius-md);
    margin-bottom: 8px;
    color: #64748b;
  }
  .placeholder-circle {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 1.5px dashed #94a3b8;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
    color: #475569;
    flex-shrink: 0;
  }
  .placeholder-label {
    font-size: 12px;
    font-weight: 600;
  }

  .btn-sum-deselect {
    border: 1.5px solid #c0392b;
    background: none;
    color: #c0392b;
    font-size: 11px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
  }
  .btn-sum-deselect:active { transform: scale(0.96); }

  .summary-tot-card {
    background: var(--db-navy-light);
    border: 1.5px dashed var(--db-navy);
    padding: 14px;
    border-radius: 8px;
    margin-top: 20px;
    font-size: 13px;
    line-height: 1.6;
  }

  /* Completion banner WhatsApp trigger */
  .completion-banner {
    background: #d4edda;
    border: 1.5px solid #c3e6cb;
    color: #155724;
    padding: 16px;
    border-radius: var(--radius-md);
    margin-bottom: 18px;
    text-align: center;
  }
  .completion-title {
    font-weight: 800;
    font-size: 16px;
    margin-bottom: 6px;
  }
  .btn-whatsapp-complete {
    background: #25d366;
    color: #fff;
    border: none;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 13.5px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    text-decoration: none;
  }
  .btn-whatsapp-complete:active { transform: scale(0.96); }
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
    <button class="btn-refresh-portal" onclick="ZoneForm.forceRefresh()" style="background: rgba(255,255,255,0.1); border:none; color:#fff; padding:6px 12px; border-radius:6px; font-weight:600; cursor:pointer; font-size:12px; margin-right:8px;">Sync 🔄</button>
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

    <!-- Grid Buttons Layout (7 Distinct Options) -->
    <div class="selection-grid">
      <button class="selection-btn" onclick="ZoneForm.openLearnerInnovations()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5zM9 7a3 3 0 0 1 6 0v3H9z"/></svg></span>
        <span class="selection-btn-title">LEARNER INNOVATIONS</span>
        <span class="selection-btn-badge badge-empty" id="badge-innovations">0/27</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openTeacherInnovations()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
        <span class="selection-btn-title">TEACHER INNOVATIONS</span>
        <span class="selection-btn-badge badge-empty" id="badge-teachers">0/9</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openYouthInnovations()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></span>
        <span class="selection-btn-title">YOUTH INNOVATIONS</span>
        <span class="selection-btn-badge badge-empty" id="badge-youth">0/9</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openAcademics()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
        <span class="selection-btn-title">ACADEMICS</span>
        <span class="selection-btn-badge badge-empty" id="badge-academics">0/7</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSkills()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>
        <span class="selection-btn-title">SKILLS</span>
        <span class="selection-btn-badge badge-empty" id="badge-skills">0/12</span>
      </button>

      <button class="selection-btn" onclick="ZoneForm.openSummary()">
        <span class="selection-btn-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
        <span class="selection-btn-title">SELECTED PARTICIPANTS</span>
        <span class="selection-btn-badge badge-empty" id="badge-summary" style="background:#f0f4fa; color:var(--db-navy);">VIEW</span>
      </button>

      <button class="selection-btn selection-btn-full" onclick="ZoneForm.openZoneRecords()">
        <span class="selection-btn-title">ZONE RECORDS</span>
      </button>
    </div>
  </div>
</div>

<!-- Backdrop sheet overlay -->
<div id="sheet-overlay" class="sheet-overlay" onclick="ZoneForm.back()"></div>

<!-- Slide Sheet: Innovations -->
<div id="sheet-innovations" class="slide-sheet">
  <div class="sheet-header">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title">Innovations Selection</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body">
    <div class="sheet-tabs" style="display: none;">
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
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title" id="cat-detail-title">Category Title</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="cat-detail-body">
  </div>
</div>

<!-- Slide Sheet: Academics -->
<div id="sheet-academics" class="slide-sheet">
  <div class="sheet-header">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title">Academics Selection</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="academics-body">
  </div>
</div>

<!-- Slide Sheet: Academics Subject Detail -->
<div id="sheet-acad-detail" class="slide-sheet">
  <div class="sheet-header">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title" id="acad-detail-title">Subject Title</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="acad-detail-body">
  </div>
</div>

<!-- Slide Sheet: Technical Skills -->
<div id="sheet-skills" class="slide-sheet">
  <div class="sheet-header">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title">Technical Skills Selection</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="skills-body">
  </div>
</div>

<!-- Slide Sheet: Skills Category Detail -->
<div id="sheet-skill-detail" class="slide-sheet">
  <div class="sheet-header">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title" id="skill-detail-title">Skill Category</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="skill-detail-body">
  </div>
</div>

<!-- Bottom Drawer: Selection Summary -->
<div id="drawer-summary" class="slide-sheet" style="top: auto; bottom: -100%; height: 80%; width: 100%; max-width: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
  <div class="sheet-header" style="border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title">Zonal Selections Summary</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="summary-body">
  </div>
</div>

<!-- Bottom Drawer: Zone Records -->
<div id="drawer-zone-records" class="slide-sheet" style="top: auto; bottom: -100%; height: 85%; width: 100%; max-width: none; border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
  <div class="sheet-header" style="border-radius: var(--radius-lg) var(--radius-lg) 0 0;">
    <button class="btn-sheet-back-header" onclick="ZoneForm.back()">&#8592; Back</button>
    <span class="sheet-title">Zone Records — All Submissions</span>
    <button class="btn-close-sheet" onclick="ZoneForm.back()">&times;</button>
  </div>
  <div class="sheet-body" id="zone-records-body">
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

  function _normalise(data) {
    if (!data.learnerSubType && data.type)       data.learnerSubType = data.type;
    if (!data.fullName && data.participant)       data.fullName = data.participant;
    if (!data.schoolName && data.school)          data.schoolName = data.school;
    if (data.category)       data.category       = (data.category + '').trim();
    if (data.level)          data.level          = (data.level + '').trim();
    if (data.learnerSubType) data.learnerSubType = (data.learnerSubType + '').trim();
    return data;
  }

  // ── Database Data Loading ─────────────────────────────────────
  async function loadAllZoneData() {
    const spinner = document.getElementById('zf-initial-loading');
    const content = document.getElementById('zf-main-content');
    try {
      // 1. Initial manual fetch
      const snap = await db.collection('submissions')
        .where('zone', '==', _auth.zone)
        .get();

      _allCandidates = snap.docs.map(d => {
        const data = _normalise({ ...d.data() });
        return { id: d.id, ...data };
      });

      _selections = new Set(_allCandidates.filter(c => c.selectedForDistrict === true).map(c => c.id));

      // Save to local storage cache for instant offline loading next time
      localStorage.setItem(`jets_zone_cache_${_auth.zone}`, JSON.stringify({
        candidates: _allCandidates,
        selections: Array.from(_selections),
        timestamp: Date.now()
      }));

      // Render the freshly synced data
      updateDashboardState();
      refreshOpenViews();

      // 2. Real-time background sync (onSnapshot)
      if (_unsubscribe) _unsubscribe();
      _unsubscribe = db.collection('submissions')
        .where('zone', '==', _auth.zone)
        .onSnapshot(liveSnap => {
          _allCandidates = liveSnap.docs.map(d => {
            const data = _normalise({ ...d.data() });
            return { id: d.id, ...data };
          });
          _selections = new Set(_allCandidates.filter(c => c.selectedForDistrict === true).map(c => c.id));

          // Silently update cache
          localStorage.setItem(`jets_zone_cache_${_auth.zone}`, JSON.stringify({
            candidates: _allCandidates,
            selections: Array.from(_selections),
            timestamp: Date.now()
          }));

          updateDashboardState();
          refreshOpenViews();
        }, err => {
          console.error('onSnapshot error', err);
        });

    } catch (err) {
      console.error('Failed to load submissions roster', err);
    } finally {
      if (spinner) spinner.classList.add('hidden');
      if (content) content.classList.remove('hidden');
    }
  }

  // Helper to re-draw active sub-panels reactively on Firestore update
  function refreshOpenViews() {
    const summaryDrawer = document.getElementById('drawer-summary');
    if (summaryDrawer && summaryDrawer.classList.contains('active')) renderSummaryBody();

    const recordsDrawer = document.getElementById('drawer-zone-records');
    if (recordsDrawer && recordsDrawer.classList.contains('active')) renderZoneRecordsBody();

    const detailSheet = document.getElementById('sheet-category-detail');
    if (detailSheet && detailSheet.classList.contains('active')) renderCategoryDetailBody();

    const acadDetailSheet = document.getElementById('sheet-acad-detail');
    if (acadDetailSheet && acadDetailSheet.classList.contains('active')) renderAcadDetailBody();

    const skillDetailSheet = document.getElementById('sheet-skill-detail');
    if (skillDetailSheet && skillDetailSheet.classList.contains('active')) renderSkillDetailBody();

    // Rerender sheet-level lists
    const innovationsSheet = document.getElementById('sheet-innovations');
    if (innovationsSheet && innovationsSheet.classList.contains('active')) renderInnovationsList();

    const academicsSheet = document.getElementById('sheet-academics');
    if (academicsSheet && academicsSheet.classList.contains('active')) renderAcademicsSheet();

    const skillsSheet = document.getElementById('sheet-skills');
    if (skillsSheet && skillsSheet.classList.contains('active')) renderSkillsSheet();
  }

  // Manual Force Sync Button Handler
  async function forceRefresh() {
    localStorage.removeItem(`jets_zone_cache_${_auth.zone}`);
    
    const spinner = document.getElementById('zf-initial-loading');
    const content = document.getElementById('zf-main-content');
    if (spinner) {
      spinner.querySelector('.auth-checking-text').textContent = "Syncing live database...";
      spinner.classList.remove('hidden');
    }
    if (content) content.classList.add('hidden');
    
    await loadAllZoneData();
  }

  // Helper to generate info rows
  function ir(lbl, val) {
    return `<div class="info-row"><span class="info-label">${lbl}</span><span class="info-value">${val}</span></div>`;
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
            isLearnerInnov(c) &&
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
  function openSheet(name, title) {
    _activeSheet = name;
    
    // Slide in the sheet
    const sheet = document.getElementById('sheet-' + name);
    if (sheet) {
      const titleEl = sheet.querySelector('.sheet-title');
      if (titleEl && title) titleEl.textContent = title;
      
      const tabsEl = sheet.querySelector('.sheet-tabs');
      if (tabsEl) {
        tabsEl.style.display = 'none'; // Dedicated grid buttons, so hide old tabs
      }
      
      sheet.classList.add('active');
    }

    // Sheet specific initial renders
    if (name === 'innovations') {
      renderInnovationsList();
    } else if (name === 'academics') {
      renderAcademicsSheet();
    } else if (name === 'skills') {
      renderSkillsSheet();
    }
  }

  function closeSheet(name) {
    const sheet = document.getElementById('sheet-' + name);
    if (sheet) sheet.classList.remove('active');
    _activeSheet = null;
    updateDashboardState();
  }

  // Navigation Stack back routing handler
  function back() {
    Nav.pop();
  }

  // ── Innovations Grid Nav Actions ──────────────────────────────
  function openLearnerInnovations() {
    _activeTab = 'learner';
    Nav.push(
      'learner-innovations',
      () => openSheet('innovations', 'Learner Innovations Selection'),
      () => closeSheet('innovations')
    );
  }

  function openTeacherInnovations() {
    _activeTab = 'teacher';
    Nav.push(
      'teacher-innovations',
      () => openSheet('innovations', 'Teacher Innovations Selection'),
      () => closeSheet('innovations')
    );
  }

  function openYouthInnovations() {
    _activeTab = 'youth';
    Nav.push(
      'youth-innovations',
      () => openSheet('innovations', 'Youth Innovations Selection'),
      () => closeSheet('innovations')
    );
  }

  function openAcademics() {
    Nav.push(
      'academics',
      () => openSheet('academics', 'Academics & Quiz Selection'),
      () => closeSheet('academics')
    );
  }

  function openSkills() {
    Nav.push(
      'skills',
      () => openSheet('skills', 'Technical Skills Selection'),
      () => closeSheet('skills')
    );
  }

  // ── Innovations lists rendering with Category Card colors ──
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
            isLearnerInnov(c) &&
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

      // Card visual state colors
      const isFilled = selected === limit;
      const isAvailable = avail > 0 && selected < limit;
      const isEmpty = avail === 0 && selected === 0;

      let cardStateClass = '';
      if (isFilled) cardStateClass = 'filled';
      else if (isAvailable) cardStateClass = 'available';
      else if (isEmpty) cardStateClass = 'empty';

      const metaBadge = isFilled ? '<span class="selection-btn-badge badge-complete">FILLED</span>'
                      : isAvailable ? `<span class="selection-btn-badge badge-partial">${selected}/${limit}</span>`
                      : '<span class="selection-btn-badge badge-empty">0 available</span>';

      return `
        <div class="category-btn ${cardStateClass}" onclick="ZoneForm.showCategoryDetail('${esc(cat)}')">
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
    Nav.push(
      'category-detail',
      () => {
        const detailSheet = document.getElementById('sheet-category-detail');
        const titleEl = document.getElementById('cat-detail-title');
        if (titleEl) titleEl.textContent = cat;
        if (detailSheet) detailSheet.classList.add('active');
        renderCategoryDetailBody();
      },
      () => {
        const detailSheet = document.getElementById('sheet-category-detail');
        if (detailSheet) detailSheet.classList.remove('active');
        _selectedCategory = null;
      }
    );
  }

  function renderCategoryDetailBody() {
    const bodyEl = document.getElementById('cat-detail-body');
    if (!bodyEl || !_selectedCategory) return;

    let html = '';

    if (_activeTab === 'learner') {
      html = LEVELS.map(lvl => {
        const matches = _allCandidates.filter(c => 
          isLearnerInnov(c) &&
          c.category === _selectedCategory &&
          c.level === lvl
        );

        let content = '';
        if (matches.length === 0) {
          content = `<div class="empty-slot-msg">No ${lvl} submissions in this zone for this category</div>`;
        } else {
          const isLvlFull = matches.some(c => _selections.has(c.id));
          content = matches.map(p => buildParticipantCardHTML(p, false, isLvlFull)).join('');
        }

        return `
          <div class="level-section-title">${lvl} Section</div>
          ${content}`;
      }).join('');
    } else {
      // Teacher or Out-of-School Youth
      const matches = _allCandidates.filter(c => 
        c.participantType === (_activeTab === 'teacher' ? 'Teacher' : 'Out-of-School Youth') &&
        c.category === _selectedCategory
      );

      if (matches.length === 0) {
        html = `<div class="empty-slot-msg" style="margin-top:24px;">No submissions in this zone for this category</div>`;
      } else {
        const isFull = matches.some(c => _selections.has(c.id));
        html = matches.map(p => buildParticipantCardHTML(p, false, isFull)).join('');
      }
    }

    bodyEl.innerHTML = html;
  }

  // ── Academics Tab Controllers ─────────────────────────────────
  function renderAcademicsSheet() {
    const bodyEl = document.getElementById('academics-body');
    if (!bodyEl) return;

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
        const isAvailable = matches.length > 0 && !isSelected;
        const isEmpty = matches.length === 0;

        let cardStateClass = '';
        if (isSelected) cardStateClass = 'filled';
        else if (isAvailable) cardStateClass = 'available';
        else if (isEmpty) cardStateClass = 'empty';

        const badge = isSelected ? '<span class="selection-btn-badge badge-complete">FILLED</span>'
                      : isAvailable ? '<span class="selection-btn-badge badge-partial">0/1</span>'
                      : '<span class="selection-btn-badge badge-empty">0 available</span>';

        const cleanSubj = slot.category.replace('Quiz & Olympiads — ', '');

        return `
          <div class="category-btn ${cardStateClass}" onclick="ZoneForm.showAcadSubjectDetail('${esc(slot.category)}', '${esc(lvl)}')">
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
    Nav.push(
      'acad-detail',
      () => {
        const detailSheet = document.getElementById('sheet-acad-detail');
        const titleEl = document.getElementById('acad-detail-title');
        const cleanTitle = subject.replace('Quiz & Olympiads — ', '') + ` (${level})`;
        if (titleEl) titleEl.textContent = cleanTitle;
        if (detailSheet) detailSheet.classList.add('active');
        renderAcadDetailBody();
      },
      () => {
        const detailSheet = document.getElementById('sheet-acad-detail');
        if (detailSheet) detailSheet.classList.remove('active');
        _selectedSubject = null;
      }
    );
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
    } else {
      const isFull = matches.some(c => _selections.has(c.id));
      html = matches.map(p => buildParticipantCardHTML(p, false, isFull)).join('');
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
      const isFilled = selectedCount === limit;
      const isAvailable = matches.length > 0 && selectedCount < limit;
      const isEmpty = matches.length === 0 && selectedCount === 0;

      let cardStateClass = '';
      if (isFilled) cardStateClass = 'filled';
      else if (isAvailable) cardStateClass = 'available';
      else if (isEmpty) cardStateClass = 'empty';

      const badge = isFilled ? '<span class="selection-btn-badge badge-complete">FILLED</span>'
                    : isAvailable ? `<span class="selection-btn-badge badge-partial">${selectedCount}/${limit}</span>`
                    : '<span class="selection-btn-badge badge-empty">0 available</span>';

      return `
        <div class="category-btn ${cardStateClass}" style="margin-bottom:10px;" onclick="ZoneForm.showSkillCategoryDetail('${esc(skill)}')">
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
    Nav.push(
      'skill-detail',
      () => {
        const detailSheet = document.getElementById('sheet-skill-detail');
        const titleEl = document.getElementById('skill-detail-title');
        if (titleEl) titleEl.textContent = skill;
        if (detailSheet) detailSheet.classList.add('active');
        renderSkillDetailBody();
      },
      () => {
        const detailSheet = document.getElementById('sheet-skill-detail');
        if (detailSheet) detailSheet.classList.remove('active');
        _selectedSkill = null;
      }
    );
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
    } else {
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
  function buildParticipantCardHTML(p, _unused, isCategoryFull = false) {
    const isSelected = _selections.has(p.id);
    const cardClass = isSelected ? 'participant-card selected' : 'participant-card';

    const badge = isSelected ? '<span class="card-badge badge-selected-manual">SELECTED</span>' : '';

    let selectBtnHTML;
    if (isSelected) {
      selectBtnHTML = `<button class="btn-select selected" onclick="ZoneForm.deselectParticipant('${p.id}')">DESELECT</button>`;
    } else {
      const disabledAttr = isCategoryFull ? 'disabled style="border-color:#ccc; color:#aaa; cursor:not-allowed;"' : '';
      selectBtnHTML = `<button class="btn-select" ${disabledAttr} onclick="ZoneForm.selectParticipant('${p.id}')">SELECT</button>`;
    }

    const titleInfo = p.titleOfInnovation ? `<div class="p-title"><strong>Title:</strong> ${esc(p.titleOfInnovation)}</div>` : (p.title ? `<div class="p-title"><strong>Title:</strong> ${esc(p.title)}</div>` : '');
    const detailsLine = p.learnerSubType === 'Technical Skills'
      ? `Sub-Skill: ${esc(p.subSkill || p.learnerSubskill || 'General')}`
      : `Level: ${esc(p.level || '—')} &nbsp;|&nbsp; Grade: ${esc(p.grade || p.gradeForm || '—')}`;

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
  async function selectParticipant(id) {
    if (_submitting) return;
    const candidate = _allCandidates.find(c => c.id === id);
    if (!candidate) return;

    let siblingIds = [];

    if (isLearnerInnov(candidate)) {
      siblingIds = _allCandidates
        .filter(c => isLearnerInnov(c) && c.category === candidate.category && c.level === candidate.level && c.id !== id && _selections.has(c.id))
        .map(c => c.id);
    } else if (candidate.participantType === 'Teacher') {
      siblingIds = _allCandidates
        .filter(c => c.participantType === 'Teacher' && c.category === candidate.category && c.id !== id && _selections.has(c.id))
        .map(c => c.id);
    } else if (candidate.participantType === 'Out-of-School Youth') {
      siblingIds = _allCandidates
        .filter(c => c.participantType === 'Out-of-School Youth' && c.category === candidate.category && c.id !== id && _selections.has(c.id))
        .map(c => c.id);
    } else if (candidate.participantType === 'Learner' && candidate.learnerSubType === 'Academics / Quiz & Olympiads') {
      siblingIds = _allCandidates
        .filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Academics / Quiz & Olympiads' && c.category === candidate.category && c.level === candidate.level && c.id !== id && _selections.has(c.id))
        .map(c => c.id);
    } else if (candidate.participantType === 'Learner' && candidate.learnerSubType === 'Technical Skills') {
      const limit = SKILL_LIMITS[candidate.category];
      const currentCount = _allCandidates.filter(c => c.participantType === 'Learner' && c.learnerSubType === 'Technical Skills' && c.category === candidate.category && _selections.has(c.id)).length;
      if (currentCount >= limit) {
        alert(`Maximum ${limit} slot${limit > 1 ? 's' : ''} allowed for ${candidate.category}.`);
        return;
      }
    }

    // Optimistic UI updates
    siblingIds.forEach(sid => _selections.delete(sid));
    _selections.add(id);
    
    // Save cache instantly
    localStorage.setItem(`jets_zone_cache_${_auth.zone}`, JSON.stringify({
      candidates: _allCandidates,
      selections: Array.from(_selections),
      timestamp: Date.now()
    }));

    refreshOpenViews();
    updateDashboardState();

    // Persist changes directly to submissions collection in Firestore
    try {
      _submitting = true;
      await Promise.all([
        FirestoreDB.selectForDistrict(id, _auth.organiserName, _auth.zone),
        ...siblingIds.map(sid => FirestoreDB.deselectFromDistrict(sid))
      ]);
    } catch (err) {
      console.error('Selection save failed', err);
      // Revert optimistic update
      _selections.delete(id);
      siblingIds.forEach(sid => _selections.add(sid));
      
      localStorage.setItem(`jets_zone_cache_${_auth.zone}`, JSON.stringify({
        candidates: _allCandidates,
        selections: Array.from(_selections),
        timestamp: Date.now()
      }));

      refreshOpenViews();
      updateDashboardState();
      alert('Failed to save selection. Checked your connection.');
    } finally {
      _submitting = false;
    }
  }

  async function deselectParticipant(id) {
    if (_submitting) return;

    // Optimistic UI updates
    _selections.delete(id);
    
    // Save cache instantly
    localStorage.setItem(`jets_zone_cache_${_auth.zone}`, JSON.stringify({
      candidates: _allCandidates,
      selections: Array.from(_selections),
      timestamp: Date.now()
    }));

    refreshOpenViews();
    updateDashboardState();

    // Persist deselect directly to submissions in Firestore
    try {
      _submitting = true;
      await FirestoreDB.deselectFromDistrict(id);
    } catch (err) {
      console.error('Deselection save failed', err);
      _selections.add(id);
      
      localStorage.setItem(`jets_zone_cache_${_auth.zone}`, JSON.stringify({
        candidates: _allCandidates,
        selections: Array.from(_selections),
        timestamp: Date.now()
      }));

      refreshOpenViews();
      updateDashboardState();
      alert('Failed to save deselection. Checked your connection.');
    } finally {
      _submitting = false;
    }
  }

  // ── Selected Participants 64-Slots Summary Drawer ──────────────
  function openSummary() {
    Nav.push(
      'summary',
      () => {
        const drawer = document.getElementById('drawer-summary');
        if (drawer) drawer.classList.add('active');
        renderSummaryBody();
      },
      () => {
        const drawer = document.getElementById('drawer-summary');
        if (drawer) drawer.classList.remove('active');
      }
    );
  }

  function getAll64Slots() {
    const slots = [];

    // 1. Learner Innovations (27)
    INNOVATION_CATEGORIES.forEach(cat => {
      LEVELS.forEach(lvl => {
        slots.push({
          type: 'Learner Innovation',
          category: cat,
          level: lvl,
          label: `${lvl} — ${cat.replace(' Innovations', '')}`
        });
      });
    });

    // 2. Teacher Innovations (9)
    INNOVATION_CATEGORIES.forEach(cat => {
      slots.push({
        type: 'Teacher Innovation',
        category: cat,
        level: '',
        label: `Teacher — ${cat.replace(' Innovations', '')}`
      });
    });

    // 3. Youth Innovations (9)
    INNOVATION_CATEGORIES.forEach(cat => {
      slots.push({
        type: 'Youth Innovation',
        category: cat,
        level: '',
        label: `Out-of-School Youth — ${cat.replace(' Innovations', '')}`
      });
    });

    // 4. Academics (7)
    ACADEMIC_SLOTS.forEach(slot => {
      slots.push({
        type: 'Academic Quiz',
        category: slot.category,
        level: slot.level,
        label: `Academics — ${slot.label}`
      });
    });

    // 5. Technical Skills (12)
    SKILL_CATEGORIES.forEach(skill => {
      const limit = SKILL_LIMITS[skill];
      for (let i = 1; i <= limit; i++) {
        slots.push({
          type: 'Technical Skills',
          category: skill,
          level: '',
          label: `${skill} (Slot ${i})`,
          slotIndex: i
        });
      }
    });

    return slots;
  }

  function getFilledAndEmptySlots() {
    const allSlots = getAll64Slots();
    const selectedList = _allCandidates.filter(c => _selections.has(c.id));
    
    const filled = [];
    const empty = [];
    
    let candidatesLeft = [...selectedList];
    
    allSlots.forEach(slot => {
      let matchedIndex = -1;
      
      if (slot.type === 'Learner Innovation') {
        matchedIndex = candidatesLeft.findIndex(c => 
          isLearnerInnov(c) && c.category === slot.category && c.level === slot.level
        );
      } else if (slot.type === 'Teacher Innovation') {
        matchedIndex = candidatesLeft.findIndex(c => 
          c.participantType === 'Teacher' && c.category === slot.category
        );
      } else if (slot.type === 'Youth Innovation') {
        matchedIndex = candidatesLeft.findIndex(c => 
          c.participantType === 'Out-of-School Youth' && c.category === slot.category
        );
      } else if (slot.type === 'Academic Quiz') {
        matchedIndex = candidatesLeft.findIndex(c => 
          c.participantType === 'Learner' && c.learnerSubType === 'Academics / Quiz & Olympiads' && 
          c.category === slot.category && c.level === slot.level
        );
      } else if (slot.type === 'Technical Skills') {
        matchedIndex = candidatesLeft.findIndex(c => 
          c.participantType === 'Learner' && c.learnerSubType === 'Technical Skills' && 
          c.category === slot.category
        );
      }
      
      if (matchedIndex !== -1) {
        const candidate = candidatesLeft.splice(matchedIndex, 1)[0];
        filled.push({ slot, candidate });
      } else {
        empty.push(slot);
      }
    });
    
    return { filled, empty };
  }

  function renderSummaryBody() {
    const bodyEl = document.getElementById('summary-body');
    if (!bodyEl) return;

    const { filled, empty } = getFilledAndEmptySlots();
    const totalFilled = filled.length;

    // 1. Completion Banner & WhatsApp share button
    let completionBannerHTML = '';
    if (totalFilled === ZONE_SLOT_TOTAL) {
      const waText = encodeURIComponent(
        `🏆 JETS 2026 DISTRICT SELECTION COMPLETE 🏆\n\n` +
        `Zone: ${_auth.zone} Zone\n` +
        `Coordinator: ${_auth.organiserName}\n` +
        `Status: All 64 district slots fully selected and validated!\n\n` +
        `Ready for DEC compilation.`
      );
      completionBannerHTML = `
        <div class="completion-banner">
          <div class="completion-title">🎉 Congratulations! Zone Selection Complete!</div>
          <p>All 64 selection slots have been filled. You can now notify the District Organiser.</p>
          <a class="btn-whatsapp-complete" href="https://wa.me/?text=${waText}" target="_blank" rel="noopener">
            Share Completion on WhatsApp 🟢
          </a>
        </div>
      `;
    }

    // 2. Filled Slots List
    const filledHTML = filled.map(({ slot, candidate }) => {
      return `
        <div class="summary-item">
          <div class="sum-p-info">
            <span class="sum-p-title">${esc(candidate.fullName)}</span>
            <span style="font-size:12px; font-weight:600; color:#555;">🏫 ${esc(candidate.schoolName)}</span>
            <span class="sum-p-cat">${esc(slot.label)}</span>
          </div>
          <button class="btn-sum-deselect" onclick="ZoneForm.deselectParticipant('${candidate.id}')">DESELECT</button>
        </div>`;
    }).join('');

    // 3. Empty Slots List
    const emptyHTML = empty.map(slot => {
      return `
        <div class="empty-slot-placeholder">
          <div class="placeholder-circle">Empty</div>
          <span class="placeholder-label">${esc(slot.label)}</span>
        </div>`;
    }).join('');

    bodyEl.innerHTML = `
      ${completionBannerHTML}

      <div class="summary-tot-card" style="margin-top:0; margin-bottom:16px;">
        <strong>Selection Overview:</strong> ${totalFilled} / ${ZONE_SLOT_TOTAL} Slots Filled
        <div class="progress-track" style="margin-top:8px; margin-bottom:0;">
          <div class="progress-fill green" style="width: ${(totalFilled/ZONE_SLOT_TOTAL)*100}%"></div>
        </div>
      </div>

      <div class="summary-sec">
        <div class="summary-sec-title">Selected Candidates (${totalFilled})</div>
        ${totalFilled === 0 ? '<div class="empty-slot-msg">No selections made yet. Go to grid categories to select winners!</div>' : filledHTML}
      </div>

      <div class="summary-sec">
        <div class="summary-sec-title">Remaining Empty Slots (${empty.length})</div>
        ${empty.length === 0 ? '<div class="empty-slot-msg">All selection slots are filled!</div>' : emptyHTML}
      </div>
    `;
  }

  // ── Zone Records Drawer ─────────────────────────────────────────
  function openZoneRecords() {
    Nav.push(
      'zone-records',
      () => {
        const drawer = document.getElementById('drawer-drawer-zone-records') || document.getElementById('drawer-zone-records');
        if (drawer) drawer.classList.add('active');
        renderZoneRecordsBody();
      },
      () => {
        const drawer = document.getElementById('drawer-drawer-zone-records') || document.getElementById('drawer-zone-records');
        if (drawer) drawer.classList.remove('active');
      }
    );
  }

  function renderZoneRecordsBody() {
    const bodyEl = document.getElementById('zone-records-body');
    if (!bodyEl) return;

    if (_allCandidates.length === 0) {
      bodyEl.innerHTML = '<div class="empty-slot-msg" style="margin:24px 0;">No school submissions found for your zone.</div>';
      return;
    }

    // Group candidates by School Name
    const bySchool = {};
    _allCandidates.forEach(c => {
      const sn = c.schoolName || c.school || 'Unknown School';
      if (!bySchool[sn]) bySchool[sn] = [];
      bySchool[sn].push(c);
    });

    const sections = Object.keys(bySchool).sort().map(school => {
      const list = bySchool[school];
      const rows = list.map(p => {
        const selBadge = _selections.has(p.id)
          ? '<span style="font-size:9px; font-weight:800; background:var(--db-green-light); color:var(--db-green); padding:2px 6px; border-radius:4px; margin-left:6px;">SELECTED</span>'
          : '';
        const sub = p.learnerSubType === 'Technical Skills' ? 'Skills'
                  : p.learnerSubType === 'Academics / Quiz & Olympiads' ? 'Academics'
                  : p.participantType === 'Teacher' ? 'Teacher'
                  : p.participantType === 'Out-of-School Youth' ? 'Youth'
                  : 'Learner';
        return `<div style="padding:8px 12px; border-bottom:1px solid #f0f4fa; font-size:12px; display:flex; justify-content:space-between; align-items:center;">
          <span>
            <strong style="color:var(--db-navy);">${esc(p.fullName)}</strong>${selBadge}<br>
            <span style="color:#555;">${sub} &bull; ${esc(p.category || '—')}</span>
          </span>
        </div>`;
      }).join('');

      return `
        <div class="collapsible-card" style="margin-bottom:10px;">
          <div class="collapsible-trigger" style="font-size:13px;" onclick="this.nextElementSibling.classList.toggle('hidden')">
            <span>🏫 ${esc(school)}</span>
            <span style="font-size:11px; color:var(--db-gray);">${list.length} submission${list.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="hidden" style="border-top:1.5px solid #e8eef7;">${rows}</div>
        </div>`;
    }).join('');

    const total = _allCandidates.length;
    const selected = _selections.size;

    bodyEl.innerHTML = `
      <div style="background:var(--db-navy-light); padding:12px 16px; border-radius:8px; margin-bottom:16px; font-size:13px; line-height:1.6;">
        <strong>${_auth.zone} Zone — All School Submissions</strong><br>
        Total: <strong>${total}</strong> &nbsp;|&nbsp; Selected for District: <strong style="color:var(--db-green);">${selected}</strong>
      </div>
      ${sections}`;
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
    back,
    openLearnerInnovations,
    openTeacherInnovations,
    openYouthInnovations,
    openAcademics,
    openSkills,
    switchSubTab,
    showCategoryDetail,
    selectParticipant,
    deselectParticipant,
    showAcadSubjectDetail,
    showSkillCategoryDetail,
    openSummary,
    openZoneRecords,
    forceRefresh
  };

})();
