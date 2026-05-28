// school-form.js — School JETS Organiser submission form
// JETS 2024-2026 | Lavushimanda District

const SchoolForm = (() => {

  let _pageId, _auth, _activeMain, _activeSub, _slotTotal;
  let _draftTimer, _restoring = false, _draftListenersAdded = false, _submitting = false;
  let existingSubmissions = [];
  let fileDataInMemory = { base64: null, name: null, type: null };
  let _bypassDuplicateOnce = false;

  const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

  const SKILL_SLUGS = {
    'Civil Engineering':     'civil',
    'Mechanical Engineering':'mech',
    'Electronics Services':  'elec',
    'Fashion Technology':    'fashion',
    'Cosmetology':           'cosm',
  };

  // ── Entry Point ───────────────────────────────────────────────
  function render(pageId, auth) {
    _pageId     = pageId;
    _auth       = auth;
    _activeMain = 'innovations';
    _activeSub  = 'learner';
    _slotTotal  = SLOT_TOTALS[auth.schoolType] || 30;
    
    fileDataInMemory = { base64: null, name: null, type: null };
    _bypassDuplicateOnce = false;

    App.setPageHTML(pageId, buildHTML());
    bindEvents();
    bindFileChangeEvents();
    loadSlotCount();
    loadProgressData();
    startAutoSave();
    checkAndShowDraft();
    fetchExistingSubmissions();
  }

  function effectiveTab() {
    if (_activeMain === 'innovations') return _activeSub; // 'learner'|'teacher'|'youth'
    if (_activeMain === 'academics')   return 'quiz';
    return 'skills';
  }

  // ── Form Actions block generator ──
  function buildCommonFormActionsHTML(prefix) {
    return `
      <div class="form-card decl-card" id="${prefix}-decl-card">
        <div class="card-title">Declaration</div>
        <label class="decl-label">
          <input type="checkbox" id="${prefix}-sf-decl" class="decl-checkbox">
          <span class="decl-text">I confirm that the information provided is correct and the participant is eligible to participate in the Zone JETS Fair.</span>
        </label>
        <div class="decl-meta">
          <div class="info-row"><span class="info-label">Submitted by</span><span class="info-value">${_auth.organiserName}</span></div>
          <div class="info-row"><span class="info-label">Date</span><span class="info-value">${todayDate()}</span></div>
        </div>
      </div>
      <div class="sf-actions">
        <button id="${prefix}-sf-submit" class="btn-form-submit">SUBMIT PARTICIPANT</button>
        <div id="${prefix}-sf-msg" class="sf-msg-container"></div>
        <div id="${prefix}-sf-draft-indicator" class="draft-indicator"></div>
      </div>
    `;
  }

  // ── Full Page HTML ────────────────────────────────────────────
  function buildHTML() {
    const skillLevels = levelsFor(_auth.schoolType)
      .filter(l => l === 'Junior Secondary' || l === 'Senior Secondary');

    return `
<!-- Main Dashboard Grid View -->
<div class="sf-main-view">
  <div class="form-topbar">
    <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
    <span class="topbar-title">School Submission Portal</span>
    <button class="btn-signout-form" onclick="App.signOut()">Sign Out</button>
  </div>

  <header class="sf-header">
    <div class="sf-header-logos">
      <img src="assets/coat-of-arms.png" alt="Zambia Coat of Arms" class="sf-logo" onerror="this.outerHTML='<span class=&quot;logo-text-fb&quot;></span>'">
      <div class="sf-header-text">
        <p class="sf-h-title">JETS 2026 SUBMISSION SYSTEM</p>
        <p class="sf-h-sub">School Submission Form</p>
        <p class="sf-h-district">Lavushimanda District &nbsp;|&nbsp; Muchinga Region</p>
      </div>
      <img src="assets/jets-logo.png" alt="JETS Logo" class="sf-logo" onerror="this.outerHTML='<span class=&quot;logo-text-fb&quot;></span>'">
    </div>
    <div class="sf-signedin-bar">
      Signed in as: &nbsp;<strong>${App.maskPhone(_auth.phone)}</strong> &mdash; ${_auth.organiserName}
    </div>
  </header>

  <div class="sf-body">
    <!-- School Information Card (Collapsible) -->
    <div class="form-card collapsible-card" id="sf-info-card">
      <div class="card-title collapsible-trigger" onclick="SchoolForm.toggleInfoCard()">
        <span>School Information</span>
        <span class="collapsible-arrow">&#9662;</span>
      </div>
      <div class="collapsible-content hidden" id="sf-info-content">
        ${ir('Zone', _auth.zone)}
        ${ir('School Name', _auth.schoolName)}
        ${ir('School Type', _auth.schoolType)}
        ${ir('School JETS Organiser', _auth.organiserName)}
        ${ir('Phone', _auth.phone)}
        <p class="sf-wrong-details">Wrong details? Contact the District JETS Organiser.</p>
      </div>
    </div>

    <!-- Slots Tracker Card -->
    <div class="form-card">
      <div class="sf-slot-row">
        <span class="sf-slot-label">Slots used</span>
        <span id="sf-slot-display" class="sf-slot-display">Loading&hellip;</span>
      </div>
      <div class="sf-slot-track">
        <div id="sf-slot-fill" class="sf-slot-fill" style="width:0%"></div>
      </div>
      <p class="sf-slot-note">Total: <strong>${_slotTotal}</strong> &mdash; ${_auth.schoolType}</p>
    </div>

    <!-- Mobile-First Tab Grids -->
    <div class="sf-button-grid">
      <button class="sf-grid-btn" data-sheet="innovations">
        <span class="sf-grid-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6L15 17H9l-.7-2C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7z"/></svg></span>
        <span class="sf-grid-title">Innovations</span>
        <span class="sf-grid-desc">Learner, Teacher & Youth</span>
      </button>
      <button class="sf-grid-btn" data-sheet="academics">
        <span class="sf-grid-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
        <span class="sf-grid-title">Academics</span>
        <span class="sf-grid-desc">Quiz & Olympiads</span>
      </button>
      ${skillLevels.length ? `
      <button class="sf-grid-btn" data-sheet="skills">
        <span class="sf-grid-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg></span>
        <span class="sf-grid-title">Technical Skills</span>
        <span class="sf-grid-desc">Practical task tasks</span>
      </button>
      ` : ''}
      <button class="sf-grid-btn" data-sheet="tracker">
        <span class="sf-grid-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
        <span class="sf-grid-title">Submission Tracker</span>
        <span class="sf-grid-desc">Check category quotas</span>
      </button>
      <button class="sf-grid-btn" data-sheet="history">
        <span class="sf-grid-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span>
        <span class="sf-grid-title">View My Submissions</span>
        <span class="sf-grid-desc">History & corrections</span>
      </button>
    </div>
  </div>
</div>

<!-- Backdrop Sheet Overlay -->
<div id="sheet-overlay" class="sheet-overlay"></div>

<!-- Slide-in Sheet: Innovations -->
<div id="sheet-innovations" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">Submit Innovations</span>
    <button class="btn-close-sheet" data-close="innovations">&times;</button>
  </div>
  <div class="sheet-body">
    <div class="sf-tab-bar sf-sub-tab-bar" id="sf-sub-tab-bar">
      <button class="sf-sub-tab-btn active" data-subtab="learner">Learner</button>
      <button class="sf-sub-tab-btn" data-subtab="teacher">Teacher</button>
      <button class="sf-sub-tab-btn" data-subtab="youth">Youth</button>
    </div>

    <!-- Learner subtab -->
    <div id="subtab-learner" class="sf-subtab-panel">
      <div class="form-card">
        <div class="card-title">Learner Participant</div>
        <div class="field">
          <label for="l-level">Level <span class="req">*</span></label>
          <select id="l-level">
            <option value="">&#8212; Select Level &#8212;</option>
            ${levelsFor(_auth.schoolType).map(l => `<option value="${l}">${l}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="l-grade">Grade / Form <span class="req">*</span></label>
          <select id="l-grade" disabled>
            <option value="">&#8212; Select Level First &#8212;</option>
          </select>
        </div>
        <div class="field hidden" id="l-cat-field">
          <label for="l-cat">Innovation Category <span class="req">*</span></label>
          <select id="l-cat">
            <option value="">&#8212; Select Category &#8212;</option>
            ${INNOVATION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        
        <!-- Swappable learner content wrapper -->
        <div id="l-swappable-fields">
          <div class="field">
            <label for="l-name">Full Name <span class="req">*</span></label>
            <input type="text" id="l-name" placeholder="Full name of learner">
          </div>
          <div class="field">
            <label for="l-age">Age <span class="req">*</span></label>
            <input type="number" id="l-age" min="3" max="25" placeholder="Age">
          </div>
          <div class="field">
            <label>Sex <span class="req">*</span></label>
            <div class="radio-group">
              <label class="radio-opt"><input type="radio" name="l-sex" value="Male"> Male</label>
              <label class="radio-opt"><input type="radio" name="l-sex" value="Female"> Female</label>
            </div>
          </div>
          <div class="field hidden" id="l-title-field">
            <label for="l-title">Title of Innovation</label>
            <input type="text" id="l-title" placeholder="Enter title of innovation">
          </div>
          <div class="field hidden" id="l-report-field">
            <label for="l-report">Innovation Report</label>
            <input type="file" id="l-report" accept=".doc,.docx,.pdf">
            <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
          </div>
          <div class="field">
            <label for="l-teacher">Supervising Teacher Name <span class="req">*</span></label>
            <input type="text" id="l-teacher" placeholder="Full name of supervising teacher">
          </div>
        </div>
      </div>
    </div>

    <!-- Teacher subtab -->
    <div id="subtab-teacher" class="sf-subtab-panel hidden">
      <div class="form-card">
        <div class="card-title">Teacher Participant</div>
        <div class="field">
          <label for="t-cat">Category <span class="req">*</span></label>
          <select id="t-cat">
            <option value="">&#8212; Select Category &#8212;</option>
            ${INNOVATION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        
        <div id="t-swappable-fields">
          <div class="field">
            <label for="t-name">Full Name <span class="req">*</span></label>
            <input type="text" id="t-name" placeholder="Full name of teacher">
          </div>
          <div class="field">
            <label>Sex <span class="req">*</span></label>
            <div class="radio-group">
              <label class="radio-opt"><input type="radio" name="t-sex" value="Male"> Male</label>
              <label class="radio-opt"><input type="radio" name="t-sex" value="Female"> Female</label>
            </div>
          </div>
          <div class="field">
            <label for="t-title">Title of Innovation</label>
            <input type="text" id="t-title" placeholder="Enter title of innovation">
          </div>
          <div class="field">
            <label for="t-report">Innovation Report</label>
            <input type="file" id="t-report" accept=".doc,.docx,.pdf">
            <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Youth subtab -->
    <div id="subtab-youth" class="sf-subtab-panel hidden">
      <div class="form-card">
        <div class="card-title">Out-of-School Youth Participant</div>
        <div class="field">
          <label for="y-cat">Category <span class="req">*</span></label>
          <select id="y-cat">
            <option value="">&#8212; Select Category &#8212;</option>
            ${INNOVATION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        
        <div id="y-swappable-fields">
          <div class="field">
            <label for="y-name">Full Name <span class="req">*</span></label>
            <input type="text" id="y-name" placeholder="Full name">
          </div>
          <div class="field">
            <label for="y-age">Age <span class="req">*</span></label>
            <input type="number" id="y-age" min="14" max="35" placeholder="Age">
          </div>
          <div class="field">
            <label>Sex <span class="req">*</span></label>
            <div class="radio-group">
              <label class="radio-opt"><input type="radio" name="y-sex" value="Male"> Male</label>
              <label class="radio-opt"><input type="radio" name="y-sex" value="Female"> Female</label>
            </div>
          </div>
          <div class="field">
            <label for="y-title">Title of Innovation</label>
            <input type="text" id="y-title" placeholder="Enter title of innovation">
          </div>
          <div class="field">
            <label for="y-report">Innovation Report</label>
            <input type="file" id="y-report" accept=".doc,.docx,.pdf">
            <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
          </div>
          <div class="field">
            <label for="y-mentor">Mentor Name <span class="req">*</span></label>
            <input type="text" id="y-mentor" placeholder="Full name of mentor">
          </div>
        </div>
      </div>
    </div>

    ${buildCommonFormActionsHTML('innovations')}
  </div>
</div>

<!-- Slide-in Sheet: Academics -->
<div id="sheet-academics" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">Submit Academics</span>
    <button class="btn-close-sheet" data-close="academics">&times;</button>
  </div>
  <div class="sheet-body">
    <div class="form-card">
      <div class="card-title">Academics / Quiz &amp; Olympiads Participant</div>
      <div class="field">
        <label for="ac-level">Level <span class="req">*</span></label>
        <select id="ac-level">
          <option value="">&#8212; Select Level &#8212;</option>
          ${levelsFor(_auth.schoolType).map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="ac-grade">Grade / Form <span class="req">*</span></label>
        <select id="ac-grade" disabled>
          <option value="">&#8212; Select Level First &#8212;</option>
        </select>
      </div>
      <div class="field">
        <label for="ac-cat">Subject <span class="req">*</span></label>
        <select id="ac-cat" disabled>
          <option value="">&#8212; Select Level First &#8212;</option>
        </select>
      </div>
      
      <div id="ac-swappable-fields">
        <div class="field">
          <label for="ac-name">Full Name <span class="req">*</span></label>
          <input type="text" id="ac-name" placeholder="Full name of learner">
        </div>
        <div class="field">
          <label for="ac-age">Age <span class="req">*</span></label>
          <input type="number" id="ac-age" min="3" max="25" placeholder="Age">
        </div>
        <div class="field">
          <label>Sex <span class="req">*</span></label>
          <div class="radio-group">
            <label class="radio-opt"><input type="radio" name="ac-sex" value="Male"> Male</label>
            <label class="radio-opt"><input type="radio" name="ac-sex" value="Female"> Female</label>
          </div>
        </div>
        <div class="field">
          <label for="ac-teacher">Supervising Teacher Name <span class="req">*</span></label>
          <input type="text" id="ac-teacher" placeholder="Full name of supervising teacher">
        </div>
      </div>
    </div>

    ${buildCommonFormActionsHTML('academics')}
  </div>
</div>

<!-- Slide-in Sheet: Skills -->
<div id="sheet-skills" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">Submit Skills</span>
    <button class="btn-close-sheet" data-close="skills">&times;</button>
  </div>
  <div class="sheet-body">
    ${skillLevels.length ? `
    <div class="form-card">
      <div class="card-title">Technical Skills Participant</div>
      <div class="field">
        <label for="sk-level">Level <span class="req">*</span></label>
        <select id="sk-level">
          <option value="">&#8212; Select Level &#8212;</option>
          ${skillLevels.map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="sk-grade">Grade / Form <span class="req">*</span></label>
        <select id="sk-grade" disabled>
          <option value="">&#8212; Select Level First &#8212;</option>
        </select>
      </div>
      <div class="field">
        <label for="sk-cat">Skill Category <span class="req">*</span></label>
        <select id="sk-cat">
          <option value="">&#8212; Select Skill Category &#8212;</option>
          ${Object.keys(SKILLS).map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      </div>
      
      <div id="sk-swappable-fields">
        <div class="field">
          <label for="sk-subskill">Sub-Skill <span class="req">*</span></label>
          <select id="sk-subskill" disabled>
            <option value="">&#8212; Select Category First &#8212;</option>
          </select>
        </div>
        <div class="field">
          <label for="sk-name">Full Name <span class="req">*</span></label>
          <input type="text" id="sk-name" placeholder="Full name of learner">
        </div>
        <div class="field">
          <label for="sk-age">Age <span class="req">*</span></label>
          <input type="number" id="sk-age" min="10" max="25" placeholder="Age">
        </div>
        <div class="field">
          <label>Sex <span class="req">*</span></label>
          <div class="radio-group">
            <label class="radio-opt"><input type="radio" name="sk-sex" value="Male"> Male</label>
            <label class="radio-opt"><input type="radio" name="sk-sex" value="Female"> Female</label>
          </div>
        </div>
        <div class="field hidden" id="sk-title-field">
          <label for="sk-title">Title of Innovation</label>
          <input type="text" id="sk-title" placeholder="Enter title of innovation">
        </div>
        <div class="field hidden" id="sk-report-field">
          <label for="sk-report">Innovation Report</label>
          <input type="file" id="sk-report" accept=".doc,.docx,.pdf">
          <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
        </div>
        <div class="field">
          <label for="sk-teacher">Supervising Teacher Name <span class="req">*</span></label>
          <input type="text" id="sk-teacher" placeholder="Full name of supervising teacher">
        </div>
      </div>
    </div>
    ${buildCommonFormActionsHTML('skills')}
    ` : `
    <div class="form-card">
      <div class="alert alert-info">Technical Skills not available for Primary/Community school types.</div>
    </div>`}
  </div>
</div>

<!-- Slide-in Sheet: History -->
<div id="sheet-history" class="slide-sheet">
  <div class="sheet-header">
    <span class="sheet-title">My Submissions</span>
    <button class="btn-close-sheet" data-close="history">&times;</button>
  </div>
  <div class="sheet-body" id="sheet-history-body">
    <!-- Loaded and rendered by history.js inside sheet -->
  </div>
</div>

<!-- Bottom Slide-Up Progress Drawer -->
<div id="drawer-tracker" class="bottom-drawer">
  <div class="drawer-header">
    <div class="drawer-handle"></div>
    <span class="drawer-title">Submission Progress Tracker</span>
    <button class="btn-close-drawer">&times;</button>
  </div>
  <div class="drawer-body">
    <div id="sf-progress-body">
      <div class="sf-progress-loading" id="sf-progress-loading">Loading progress&hellip;</div>
      <div id="sf-progress-data" class="hidden"></div>
    </div>
  </div>
</div>
`;
  }

  // ── Events ────────────────────────────────────────────────────
  function bindEvents() {
    window._sfValidate = validateForm;

    // Grid buttons to open sheets & bottom drawer
    document.querySelectorAll('.sf-grid-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sheetName = btn.dataset.sheet;
        if (sheetName === 'tracker') {
          openDrawer('tracker');
        } else {
          openSheet(sheetName);
        }
      });
    });

    // Sub-tab toggling in innovations sheet
    const subTabBar = document.getElementById('sf-sub-tab-bar');
    if (subTabBar) {
      subTabBar.addEventListener('click', e => {
        const btn = e.target.closest('.sf-sub-tab-btn');
        if (btn) switchSubTab(btn.dataset.subtab);
      });
    }

    // Close button events
    document.querySelectorAll('.btn-close-sheet').forEach(btn => {
      btn.addEventListener('click', () => {
        closeSheet(btn.dataset.close);
      });
    });

    document.querySelectorAll('.btn-close-drawer').forEach(btn => {
      btn.addEventListener('click', () => {
        closeDrawer('tracker');
      });
    });

    const overlay = document.getElementById('sheet-overlay');
    if (overlay) {
      overlay.addEventListener('click', () => {
        const activeSheet = document.querySelector('.slide-sheet.active');
        if (activeSheet) {
          closeSheet(activeSheet.id.replace('sheet-', ''));
        }
        closeDrawer('tracker');
      });
    }

    // Bind submit buttons inside sheets
    ['innovations', 'academics', 'skills'].forEach(prefix => {
      const btn = document.getElementById(`${prefix}-sf-submit`);
      if (btn) {
        btn.addEventListener('click', handleSubmit);
      }
    });

    // Cascades & changes
    const page = document.getElementById(_pageId);
    page.addEventListener('change', e => {
      clearFieldErrorForEl(e.target);
      if      (e.target.id === 'l-level')  onLevelChange();
      else if (e.target.id === 'l-cat')    onInnovCatChange();
      else if (e.target.id === 't-cat')    onTeacherCatChange();
      else if (e.target.id === 'y-cat')    onYouthCatChange();
      else if (e.target.id === 'ac-level') onAcadLevelChange();
      else if (e.target.id === 'ac-cat')   onAcadCatChange();
      else if (e.target.id === 'sk-level') onSkillLevelChange();
      else if (e.target.id === 'sk-cat')   onSkillCatChange();
      validateForm();
    });
    
    page.addEventListener('input', e => {
      clearFieldErrorForEl(e.target);
      validateForm();
    });

    validateForm();
  }

  // ── Sheet & Drawer Utilities ──────────────────────────────────
  function openSheet(name) {
    if (name === 'history') {
      SubmissionHistory.show('sheet-history-body', _auth, 'school', _slotTotal);
      
      // Override history.js default header back button behavior to close sheet instead of rendering form page
      setTimeout(() => {
        const backBtn = document.querySelector('#sheet-history-body .btn-back');
        if (backBtn) {
          backBtn.innerHTML = '&#10005; Close';
          backBtn.setAttribute('onclick', '');
          backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            closeSheet('history');
          });
        }
      }, 100);
    }

    const sheet = document.getElementById('sheet-' + name);
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.add('active');
    if (overlay) overlay.classList.add('active');

    _activeMain = name;
    clearAllValidationErrors();
    document.body.style.overflow = 'hidden';
  }

  function closeSheet(name) {
    const sheet = document.getElementById('sheet-' + name);
    const overlay = document.getElementById('sheet-overlay');
    if (sheet) sheet.classList.remove('active');

    const activeSheets = document.querySelectorAll('.slide-sheet.active');
    if (activeSheets.length === 0 && overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }

    loadSlotCount();
    loadProgressData();
  }

  function openDrawer(name) {
    const drawer = document.getElementById('drawer-' + name);
    const overlay = document.getElementById('sheet-overlay');
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    loadProgressData();
  }

  function closeDrawer(name) {
    const drawer = document.getElementById('drawer-' + name);
    const overlay = document.getElementById('sheet-overlay');
    if (drawer) drawer.classList.remove('active');

    const activeSheets = document.querySelectorAll('.slide-sheet.active');
    if (activeSheets.length === 0 && overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // ── Tab Toggling ──────────────────────────────────────────────
  function switchSubTab(subtab) {
    saveDraft();
    _activeSub = subtab;
    document.querySelectorAll('#sf-sub-tab-bar .sf-sub-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.subtab === subtab));
    ['learner', 'teacher', 'youth'].forEach(t =>
      document.getElementById('subtab-' + t).classList.toggle('hidden', t !== subtab));
    
    // Trigger quota check on subtab change
    if (subtab === 'learner') onInnovCatChange();
    else if (subtab === 'teacher') onTeacherCatChange();
    else if (subtab === 'youth') onYouthCatChange();

    validateForm();
  }

  // ── File Selection Encoding to memory ──────────────────────────
  function bindFileChangeEvents() {
    ['l-report', 't-report', 'y-report', 'sk-report'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        fileDataInMemory = { base64: null, name: null, type: null };

        // Clean ready labels
        const parent = el.parentNode;
        const oldLabel = parent.querySelector('.file-ready-label');
        if (oldLabel) oldLabel.remove();
        clearFieldErrorForEl(el);

        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'doc', 'docx'].includes(ext)) {
          markFieldErrorWithMsg(id, 'Only .pdf, .doc, and .docx files are accepted');
          el.value = '';
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          markFieldErrorWithMsg(id, 'File size exceeds 10 MB limit');
          el.value = '';
          return;
        }

        try {
          const base64 = await toBase64(file);
          fileDataInMemory = {
            base64: base64,
            name: file.name,
            type: file.type
          };

          const readyLabel = document.createElement('span');
          readyLabel.className = 'file-ready-label';
          readyLabel.innerHTML = `&#10003; Ready: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
          parent.appendChild(readyLabel);
        } catch (_) {
          markFieldErrorWithMsg(id, 'Could not read file.');
          el.value = '';
        }
      });
    });
  }

  // ── Frontend Quota Limit Check & Template Swap ─────────────────
  function checkSlotUsageAndLimit(cat, lvl, pType) {
    if (!cat) return { count: 0, max: 99, isFull: false };

    let count = 0;
    existingSubmissions.forEach(s => {
      const subType = s.learnerSubType || s.type || '';
      let matchPType;
      if (pType === 'Academics / Quiz & Olympiads') {
        matchPType = s.participantType === 'Learner' && subType === 'Academics / Quiz & Olympiads';
      } else if (pType === 'Technical Skills') {
        matchPType = s.participantType === 'Learner' && subType === 'Technical Skills';
      } else {
        matchPType = s.participantType === pType || (pType === 'Learner' && (s.participantType || '').indexOf('Learner') === 0);
      }
      const matchCat = s.category === cat;

      if (matchPType && matchCat) {
        if (pType === 'Academics / Quiz & Olympiads') {
          if (s.level === lvl) count++;
        } else if (pType === 'Technical Skills') {
          count++;
        } else {
          count++;
        }
      }
    });

    let max = 1;
    const schoolType = _auth.schoolType;

    if (pType.indexOf('Technical Skills') !== -1) {
      if (cat === 'Civil Engineering') max = 4;
      else if (cat === 'Mechanical Engineering') max = 4;
      else if (cat === 'Electronics Services') max = 2;
      else if (cat === 'Fashion Technology') max = 1;
      else if (cat === 'Cosmetology') max = 1;
    } else if (pType.indexOf('Academics') !== -1) {
      if (schoolType === 'Secondary School') max = 2;
      else if (schoolType === 'Private School') {
        max = (lvl === 'ECE & Primary') ? 1 : 2;
      } else {
        max = 1;
      }
    } else if (pType === 'Teacher' || pType.indexOf('Youth') !== -1) {
      max = 1;
    } else {
      // Learner Innovations
      if (schoolType === 'Primary School') max = 1;
      else if (schoolType === 'Open Centre School') max = 2;
      else if (schoolType === 'Secondary School') max = 2;
      else if (schoolType === 'Private School') max = 3;
      else if (schoolType === 'Community School') max = 1;
    }

    return {
      count: count,
      max: max,
      isFull: count >= max
    };
  }

  function handleSlotQuotaAlert(swappableContainerId, cat, lvl, pType, submitPrefix) {
    const container = document.getElementById(swappableContainerId);
    if (!container) return;

    // Cache the original HTML template inside the container on first render
    const origKey = `orig_html_${swappableContainerId}`;
    if (!container.dataset[origKey]) {
      container.dataset[origKey] = container.innerHTML;
    }

    const quota = checkSlotUsageAndLimit(cat, lvl, pType);
    const submitBtn = document.getElementById(`${submitPrefix}-sf-submit`);
    const declCard = document.getElementById(`${submitPrefix}-decl-card`);

    if (quota.isFull) {
      container.innerHTML = `
        <div class="slot-full-template">
          <div class="slot-full-icon">🚫</div>
          <div class="slot-full-title">This slot is already full</div>
          <p class="slot-full-desc">The school quota limit for category <strong>"${cat}"</strong> at level <strong>"${lvl || 'All'}"</strong> has been reached.</p>
          <p class="slot-full-count">Current: <strong>${quota.count} of ${quota.max}</strong> slots filled.</p>
          <p class="slot-full-hint">To submit a new participant, please select a different category or level.</p>
        </div>
      `;
      if (submitBtn) submitBtn.disabled = true;
      if (declCard) declCard.classList.add('hidden');
    } else {
      container.innerHTML = container.dataset[origKey];
      if (submitBtn) submitBtn.disabled = false;
      if (declCard) declCard.classList.remove('hidden');
      
      // Re-bind listeners inside restored swappable content (like file inputs)
      bindFileChangeEvents();
    }
  }

  // ── Learner (Innovation) Cascades ────────────────────────────
  function onLevelChange() {
    const level  = v('l-level');
    const grades = GRADES_BY_LEVEL[level] || [];
    const gSel   = document.getElementById('l-grade');
    gSel.innerHTML = '<option value="">&#8212; Select Grade / Form &#8212;</option>' +
      grades.map(g => `<option value="${g}">${g}</option>`).join('');
    gSel.disabled = !grades.length;
    level ? show('l-cat-field') : hide('l-cat-field');
    document.getElementById('l-cat').value = '';
    hide('l-title-field'); hide('l-report-field');
    
    // Check quota slots
    onInnovCatChange();
  }

  function onInnovCatChange() {
    const cat = v('l-cat');
    cat ? show('l-title-field')  : hide('l-title-field');
    cat ? show('l-report-field') : hide('l-report-field');
    
    handleSlotQuotaAlert('l-swappable-fields', cat, v('l-level'), 'Learner', 'innovations');
  }

  function onTeacherCatChange() {
    handleSlotQuotaAlert('t-swappable-fields', v('t-cat'), '', 'Teacher', 'innovations');
  }

  function onYouthCatChange() {
    handleSlotQuotaAlert('y-swappable-fields', v('y-cat'), '', 'Out-of-School Youth', 'innovations');
  }

  // ── Academics Cascades ────────────────────────────────────────
  function onAcadLevelChange() {
    const level  = v('ac-level');
    const grades = GRADES_BY_LEVEL[level] || [];
    const cats   = ACADEMICS_BY_LEVEL[level] || [];
    const gSel   = document.getElementById('ac-grade');
    const cSel   = document.getElementById('ac-cat');
    gSel.innerHTML = '<option value="">&#8212; Select Grade / Form &#8212;</option>' +
      grades.map(g => `<option value="${g}">${g}</option>`).join('');
    gSel.disabled = !grades.length;
    cSel.innerHTML = '<option value="">&#8212; Select Subject &#8212;</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    cSel.disabled = !cats.length;
    
    onAcadCatChange();
  }

  function onAcadCatChange() {
    handleSlotQuotaAlert('ac-swappable-fields', v('ac-cat'), v('ac-level'), 'Academics / Quiz & Olympiads', 'academics');
  }

  // ── Skills Cascades ───────────────────────────────────────────
  function onSkillLevelChange() {
    const level  = v('sk-level');
    const grades = GRADES_BY_LEVEL[level] || [];
    const gSel   = document.getElementById('sk-grade');
    if (gSel) {
      gSel.innerHTML = '<option value="">&#8212; Select Grade / Form &#8212;</option>' +
        grades.map(g => `<option value="${g}">${g}</option>`).join('');
      gSel.disabled = !grades.length;
    }
    onSkillCatChange();
  }

  function onSkillCatChange() {
    const cat  = v('sk-cat');
    const subs = (SKILLS[cat] && SKILLS[cat].subSkills) ? SKILLS[cat].subSkills : [];
    const sSel = document.getElementById('sk-subskill');
    if (sSel) {
      sSel.innerHTML = '<option value="">&#8212; Select Sub-Skill &#8212;</option>' +
        subs.map(s => `<option value="${s}">${s}</option>`).join('');
      sSel.disabled = !subs.length;
    }
    const cosm = cat === 'Cosmetology';
    cosm ? show('sk-report-field') : hide('sk-report-field');
    cosm ? show('sk-title-field')  : hide('sk-title-field');
    
    handleSlotQuotaAlert('sk-swappable-fields', cat, v('sk-level'), 'Technical Skills', 'skills');
  }

  // ── Validation ────────────────────────────────────────────────
  function validateForm() {
    const prefix = _activeMain;
    const btn = document.getElementById(`${prefix}-sf-submit`);
    if (!btn || _submitting) return;
    const offline = !!(window.NetStatus && window.NetStatus.isOffline);
    btn.disabled = offline;
    btn.classList.toggle('btn-form-submit--invalid', !isValid() || offline);
  }

  function isValid() {
    const prefix = _activeMain;
    const declCheckbox = document.getElementById(`${prefix}-sf-decl`);
    if (!declCheckbox || !declCheckbox.checked) return false;

    const tab = effectiveTab();
    if (tab === 'learner') return learnerValid();
    if (tab === 'teacher') return teacherValid();
    if (tab === 'youth')   return youthValid();
    if (tab === 'quiz')    return academicsValid();
    if (tab === 'skills')  return skillsValid();
    return false;
  }

  function learnerValid() {
    return filled('l-name') && filled('l-age') && rval('l-sex') &&
           v('l-level') && v('l-grade') && v('l-cat') &&
           filled('l-teacher');
  }

  function teacherValid() {
    return filled('t-name') && rval('t-sex') && v('t-cat');
  }

  function youthValid() {
    return filled('y-name') && filled('y-age') && rval('y-sex') &&
           v('y-cat') && filled('y-mentor');
  }

  function academicsValid() {
    return filled('ac-name') && filled('ac-age') && rval('ac-sex') &&
           v('ac-level') && v('ac-grade') && v('ac-cat') &&
           filled('ac-teacher');
  }

  function skillsValid() {
    if (!document.getElementById('sk-name')) return false;
    return filled('sk-name') && filled('sk-age') && rval('sk-sex') &&
           v('sk-level') && v('sk-grade') && v('sk-cat') && v('sk-subskill') &&
           filled('sk-teacher');
  }

  // ── Duplicate check ──
  function checkFrontendDuplicate(payload) {
    const name = payload.fullName.toLowerCase().trim();
    const cat = (payload.category || '').toLowerCase().trim();
    const lvl = (payload.level || '').toLowerCase().trim();
    return existingSubmissions.some(s => 
      (s.fullName || '').toLowerCase().trim() === name &&
      (s.category || '').toLowerCase().trim() === cat &&
      (s.grade || '').toLowerCase().trim() === lvl
    );
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    if (window.NetStatus && window.NetStatus.isOffline) return;
    if (!showValidationErrors()) return;

    const prefix = _activeMain;
    const btn = document.getElementById(`${prefix}-sf-submit`);
    const msg = document.getElementById(`${prefix}-sf-msg`);

    const payload = collectData();
    
    // Check duplicates on frontend
    const isDup = checkFrontendDuplicate(payload);
    if (isDup && !_bypassDuplicateOnce) {
      showDuplicateWarningBanner(payload);
      return;
    }

    if (_bypassDuplicateOnce) {
      payload.bypassDuplicate = true;
      _bypassDuplicateOnce = false;
    }

    _submitting = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting&hellip;';
    msg.innerHTML = '';

    try {
      if (fileDataInMemory.base64) {
        btn.innerHTML = '<span class="spinner"></span> Uploading Report&hellip;';
        const fileData = await FirestoreDB.uploadFile(
          fileDataInMemory.base64, fileDataInMemory.name, fileDataInMemory.type, _auth.phone
        );
        if (fileData.status !== 'ok') throw new Error(fileData.message || 'Report upload failed.');
        payload.fileUrl = fileData.url;
      }

      btn.innerHTML = '<span class="spinner"></span> Submitting&hellip;';
      const data = await FirestoreDB.submitSchool(payload);

      if (data.status !== 'ok') throw new Error(data.message || 'Submission failed.');

      const waText = encodeURIComponent(
        `JETS 2026 Submission Confirmed\n` +
        `Zone: ${_auth.zone}\n` +
        `School: ${_auth.schoolName}\n` +
        `Participant: ${payload.fullName}\n` +
        (payload.category ? `Category: ${payload.category}\n` : '') +
        `Reference No: ${data.refNumber || ''}\n` +
        `Submitted by: ${_auth.organiserName}\n` +
        `Date: ${todayDate()}`
      );

      btn.innerHTML = 'Submitted ✓';
      btn.disabled = true;

      msg.innerHTML = `
        <div class="alert alert-success">
          <strong>${payload.fullName}</strong> submitted successfully!<br>
          Ref: <strong>${data.refNumber || ''}</strong>
          <div class="success-actions-row">
            <a class="btn-whatsapp sf-wa-inline" href="https://wa.me/?text=${waText}" target="_blank" rel="noopener">Send WhatsApp</a>
            <button class="btn-success-action btn-add-another" onclick="SchoolForm.resetAndReuseForm('${prefix}')">Add Another</button>
            <button class="btn-success-action btn-goto-history" onclick="SchoolForm.viewSubmissionsFromSuccess('${prefix}')">View My Submissions</button>
          </div>
        </div>`;

      _submitting = false;
      clearDraft();
      loadSlotCount();
      loadProgressData();
      fetchExistingSubmissions();
      if (typeof WelcomeStats !== 'undefined') WelcomeStats.refresh();
      
      const sheet = document.getElementById('sheet-' + prefix);
      if (sheet) sheet.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      _submitting = false;
      msg.innerHTML = `
        <div class="alert alert-error">${err.message}</div>
        <button class="btn-retry" id="${prefix}-retry-btn">Try Again</button>`;
      document.getElementById(`${prefix}-retry-btn`).addEventListener('click', () => {
        msg.innerHTML = '';
        btn.disabled = false;
        btn.innerHTML = 'SUBMIT PARTICIPANT';
      });
      btn.disabled = false;
      btn.innerHTML = 'SUBMIT PARTICIPANT';
    }
  }

  function showDuplicateWarningBanner(payload) {
    const prefix = _activeMain;
    const msg = document.getElementById(`${prefix}-sf-msg`);
    msg.innerHTML = `
      <div class="alert alert-warning">
        <strong>Duplicate Warning:</strong> ${payload.fullName} is already submitted in category "${payload.category}".
        <div class="warning-actions-row">
          <button class="btn-warning-action btn-bypass-dup" onclick="SchoolForm.submitWithBypass()">Submit Anyway</button>
          <button class="btn-warning-action btn-dismiss-warning" onclick="document.getElementById('${prefix}-sf-msg').innerHTML=''">Cancel</button>
        </div>
      </div>`;
    shakeSubmitBtn(prefix);
    
    const sheet = document.getElementById('sheet-' + prefix);
    if (sheet) {
      const msgWrap = document.getElementById(`${prefix}-sf-msg`);
      setTimeout(() => msgWrap.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
  }

  function submitWithBypass() {
    _bypassDuplicateOnce = true;
    handleSubmit();
  }

  function resetAndReuseForm(prefix) {
    resetFormFields();
    fileDataInMemory = { base64: null, name: null, type: null };
    _bypassDuplicateOnce = false;

    const btn = document.getElementById(`${prefix}-sf-submit`);
    const msg = document.getElementById(`${prefix}-sf-msg`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'SUBMIT PARTICIPANT';
    }
    if (msg) msg.innerHTML = '';

    validateForm();
  }

  function viewSubmissionsFromSuccess(prefix) {
    closeSheet(prefix);
    openSheet('history');
    resetAndReuseForm(prefix);
  }

  function collectData() {
    const base = {
      formType:      'school',
      zone:          _auth.zone,
      schoolName:    _auth.schoolName,
      schoolType:    _auth.schoolType,
      organiserName: _auth.organiserName,
      phone:         _auth.phone,
      submittedBy:   _auth.organiserName,
      submittedDate: new Date().toISOString(),
    };
    const tab = effectiveTab();
    if (tab === 'learner') return { ...base,
      participantType:    'Learner',
      learnerSubType:     'Learner Innovation',
      fullName:           v('l-name'),
      age:                v('l-age'),
      sex:                rval('l-sex'),
      gradeForm:          v('l-grade'),
      level:              v('l-level'),
      category:           v('l-cat'),
      titleOfInnovation:  v('l-title'),
      supervisingTeacher: v('l-teacher'),
    };
    if (tab === 'teacher') return { ...base,
      participantType:   'Teacher',
      fullName:          v('t-name'),
      sex:               rval('t-sex'),
      category:          v('t-cat'),
      titleOfInnovation: v('t-title'),
    };
    if (tab === 'youth') return { ...base,
      participantType:   'Out-of-School Youth',
      fullName:          v('y-name'),
      age:               v('y-age'),
      sex:               rval('y-sex'),
      category:          v('y-cat'),
      titleOfInnovation: v('y-title'),
      mentor:            v('y-mentor'),
    };
    if (tab === 'quiz') return { ...base,
      participantType:    'Learner',
      learnerSubType:     'Academics / Quiz & Olympiads',
      fullName:           v('ac-name'),
      age:                v('ac-age'),
      sex:                rval('ac-sex'),
      gradeForm:          v('ac-grade'),
      level:              v('ac-level'),
      category:           v('ac-cat'),
      supervisingTeacher: v('ac-teacher'),
    };
    return { ...base,
      participantType:    'Learner',
      learnerSubType:     'Technical Skills',
      fullName:           v('sk-name'),
      age:                v('sk-age'),
      sex:               rval('sk-sex'),
      gradeForm:          v('sk-grade'),
      level:              v('sk-level'),
      category:           v('sk-cat'),
      subSkill:           v('sk-subskill'),
      titleOfInnovation:  v('sk-title'),
      supervisingTeacher: v('sk-teacher'),
    };
  }

  // ── Slot Counter ──────────────────────────────────────────────
  async function loadSlotCount() {
    try {
      const data = await FirestoreDB.getSchoolCount(_auth.phone, _auth.schoolName);
      if (typeof data.total === 'number') updateSlot(data.total);
    } catch (_) {
      const el = document.getElementById('sf-slot-display');
      if (el) el.innerHTML = '&#8212; of ' + _slotTotal;
    }
  }

  function updateSlot(n) {
    const pct  = Math.min(100, Math.round((n / _slotTotal) * 100));
    const disp = document.getElementById('sf-slot-display');
    const fill = document.getElementById('sf-slot-fill');
    if (disp) disp.textContent = n + ' of ' + _slotTotal;
    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.toggle('sf-slot-warn', pct >= 80 && pct < 100);
      fill.classList.toggle('sf-slot-full', pct >= 100);
    }
  }

  // ── Submission list loader for quota checking ──
  async function fetchExistingSubmissions() {
    try {
      const data = await FirestoreDB.getSubmissionHistory(
        _auth.phone, 'school', _auth.zone, _auth.schoolName
      );
      if (data.status === 'ok') {
        existingSubmissions = data.rows || [];
      }
    } catch (_) {}
  }

  // ── Progress Bars ─────────────────────────────────────────────
  async function loadProgressData() {
    try {
      const data = await FirestoreDB.getProgressData(
        _auth.phone, 'school', _auth.zone, _auth.schoolName
      );
      if (data.status !== 'ok') throw new Error(data.message);
      renderProgressBars(data);
      const loading = document.getElementById('sf-progress-loading');
      const body    = document.getElementById('sf-progress-data');
      if (loading) loading.classList.add('hidden');
      if (body)    body.classList.remove('hidden');
    } catch (_) {
      const loading = document.getElementById('sf-progress-loading');
      if (loading) loading.textContent = 'Could not load progress.';
    }
  }

  function renderProgressBars(data) {
    const el = document.getElementById('sf-progress-data');
    if (!el) return;

    const inn         = data.innovations || { learner: {}, teacher: {}, youth: {} };
    const acadBySL    = data.academicsBySubjectLevel || {};
    const skillsByCat = data.skillsByCategory || {};

    const levels    = LEVELS_BY_SCHOOL_TYPE[_auth.schoolType] || [];
    const hasSkills = _auth.schoolType !== 'Primary School' && _auth.schoolType !== 'Community School';

    function barRow(label, n, max) {
      const pct      = max > 0 ? Math.min(100, Math.round((n / max) * 100)) : 0;
      const isDone   = max > 0 && n >= max;
      const isOver   = n > max;
      const barClass = isOver ? 'sf-prog-bar-over'
                     : isDone ? 'sf-prog-bar-full'
                     : n > 0  ? 'sf-prog-bar-partial'
                     : '';
      const cntClass = isOver ? ' sf-prog-count-over' : isDone ? ' sf-prog-count-done' : '';
      const badge    = isDone && !isOver ? ' &#10003; DONE' : isOver ? ' &#9888;' : '';
      return `<div class="sf-prog-row">
        <span class="sf-prog-label">${label}</span>
        <div class="sf-prog-bar-wrap"><div class="sf-prog-bar ${barClass}" style="width:${isDone || isOver ? 100 : pct}%"></div></div>
        <span class="sf-prog-count${cntClass}">${n}/${max}${badge}</span>
      </div>`;
    }

    function innovSection(title, counts, max) {
      const used = INNOVATION_CATEGORIES.reduce((a, c) => a + (counts[c] || 0), 0);
      const tot  = INNOVATION_CATEGORIES.length * max;
      const rows = INNOVATION_CATEGORIES.map(c => barRow(c, counts[c] || 0, max)).join('');
      return `<div class="sf-prog-section">
        <div class="sf-prog-section-title">${title} (${used}/${tot})</div>${rows}
      </div>`;
    }

    let acadRowsHtml = '', acadTotal = 0, acadMax = 0;
    levels.forEach(level => {
      (ACADEMICS_BY_LEVEL[level] || []).forEach(subj => {
        const key    = level + ':' + subj;
        const n      = acadBySL[key] || 0;
        const lShort = level === 'ECE & Primary' ? 'ECE/Prim'
                     : level === 'Junior Secondary' ? 'Junior' : 'Senior';
        const label  = subj.replace('Quiz & Olympiads — ', '') + ' (' + lShort + ')';
        acadTotal   += n;
        acadMax     += 1;
        acadRowsHtml += barRow(label, n, 1);
      });
    });
    const acadHtml = acadMax > 0
      ? `<div class="sf-prog-section">
        <div class="sf-prog-section-title">Academics / Quiz &amp; Olympiads (${acadTotal}/${acadMax})</div>
        ${acadRowsHtml}
      </div>`
      : '';

    let skillsHtml = '';
    if (hasSkills) {
      let skillTotal = 0, skillMax = 0, skillRowsHtml = '';
      Object.entries(SKILLS).forEach(([cat, info]) => {
        const n = skillsByCat[cat] || 0;
        skillTotal += n;
        skillMax   += info.slots;
        skillRowsHtml += barRow(cat, n, info.slots);
      });
      skillsHtml = `<div class="sf-prog-section">
        <div class="sf-prog-section-title">Technical Skills (${skillTotal}/${skillMax})</div>
        ${skillRowsHtml}
      </div>`;
    }

    el.innerHTML =
      levels.map(lvl => innovSection(lvl + ' Innovations', (inn.learner[lvl] || {}), 1)).join('') +
      innovSection('Teacher Innovations', inn.teacher || {}, 1) +
      innovSection('Out-of-School Youth Innovations', inn.youth || {}, 1) +
      acadHtml + skillsHtml +
      `<div class="sf-prog-totals">
        <div class="sf-prog-total-row sf-prog-total-main"><span>Total slots used:</span><span>${data.total || 0} of ${_slotTotal}</span></div>
      </div>`;
  }

  // ── Draft Auto-Save ───────────────────────────────────────────
  function draftKey() { return 'jets_draft_school_' + _auth.phone; }

  function collectDraftData() {
    const fields = {};
    [
      'l-name','l-age','l-level','l-grade','l-cat','l-title','l-teacher',
      't-name','t-cat','t-title',
      'y-name','y-age','y-cat','y-title','y-mentor',
      'ac-name','ac-age','ac-level','ac-grade','ac-cat','ac-teacher',
      'sk-name','sk-age','sk-level','sk-grade','sk-cat','sk-subskill','sk-title','sk-teacher',
    ].forEach(id => { const el = document.getElementById(id); if (el) fields[id] = el.value; });
    ['l-sex','t-sex','y-sex','ac-sex','sk-sex'].forEach(nm => {
      const el = document.querySelector(`input[name="${nm}"]:checked`);
      if (el) fields[nm] = el.value;
    });
    
    // Read checkboxes for current active main tab declaration
    const prefix = _activeMain;
    const decl = document.getElementById(`${prefix}-sf-decl`);
    if (decl) fields[`${prefix}-sf-decl`] = decl.checked;

    const fileNames = {};
    ['l-report','t-report','y-report','sk-report'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.files && el.files.length > 0) fileNames[id] = el.files[0].name;
    });
    return { savedAt: new Date().toISOString(), activeMain: _activeMain, activeSub: _activeSub, fields, fileNames };
  }

  function saveDraft() {
    if (_restoring || !document.getElementById(`${_activeMain}-sf-submit`)) return;
    try { localStorage.setItem(draftKey(), JSON.stringify(collectDraftData())); updateDraftIndicator(); } catch (_) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (_) {}
    const ind = document.getElementById(`${_activeMain}-sf-draft-indicator`);
    if (ind) ind.textContent = '';
  }

  function loadDraftData() {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return null;
      const draft = JSON.parse(raw);
      if (!draft || !draft.savedAt) return null;
      if (Date.now() - new Date(draft.savedAt).getTime() > DRAFT_EXPIRY_MS) { clearDraft(); return null; }
      return draft;
    } catch (_) { return null; }
  }

  function fmtSavedTime(iso) {
    const d = new Date(iso);
    const h = d.getHours(), mi = d.getMinutes(), ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(mi).padStart(2, '0')} ${ampm}`;
  }

  function updateDraftIndicator() {
    const prefix = _activeMain;
    const ind = document.getElementById(`${prefix}-sf-draft-indicator`);
    if (!ind) return;
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) { ind.textContent = ''; return; }
      ind.textContent = 'Draft saved at ' + fmtSavedTime(JSON.parse(raw).savedAt);
    } catch (_) {}
  }

  function showDraftBanner(draft) {
    const body = document.querySelector('#' + _pageId + ' .sf-body');
    if (!body) return;
    const banner = document.createElement('div');
    banner.id = 'sf-draft-banner';
    banner.className = 'draft-banner';
    banner.innerHTML = `
      <div class="draft-banner-top">
        <span class="draft-banner-msg">Draft restored from ${fmtSavedTime(draft.savedAt)}.</span>
      </div>
      <div class="draft-banner-btns">
        <button class="draft-btn-continue" id="sf-draft-continue">CONTINUE DRAFT</button>
        <button class="draft-btn-fresh" id="sf-draft-fresh">START FRESH</button>
      </div>`;
    body.insertBefore(banner, body.firstChild);
    document.getElementById('sf-draft-continue').addEventListener('click', () => {
      restoreDraft(draft);
      banner.remove();
      const prefix = _activeMain;
      const msg = document.getElementById(`${prefix}-sf-msg`);
      if (msg) msg.innerHTML = '<div class="alert alert-info">Draft loaded. Please re-select your report file.</div>';
    });
    document.getElementById('sf-draft-fresh').addEventListener('click', () => {
      clearDraft();
      banner.remove();
    });
  }

  function restoreDraft(draft) {
    _restoring = true;
    const f = draft.fields || {}, fn = draft.fileNames || {};
    if (draft.activeMain) openSheet(draft.activeMain);
    if (draft.activeSub)  switchSubTab(draft.activeSub);

    const setVal = (id, val) => { if (val === undefined) return; const el = document.getElementById(id); if (el) el.value = val; };
    const setRadio = (name, val) => { if (!val) return; const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; };

    ['l-name','l-age','l-teacher','t-name','t-title','y-name','y-age','y-mentor','y-title',
     'ac-name','ac-age','ac-teacher','sk-name','sk-age','sk-teacher','sk-title',
    ].forEach(id => setVal(id, f[id]));
    ['l-sex','t-sex','y-sex','ac-sex','sk-sex'].forEach(nm => setRadio(nm, f[nm]));
    setVal('t-cat', f['t-cat']);
    setVal('y-cat', f['y-cat']);

    if (f['l-level'])    { setVal('l-level', f['l-level']); onLevelChange(); }
    if (f['l-grade'])    setVal('l-grade', f['l-grade']);
    if (f['l-cat'])      { setVal('l-cat', f['l-cat']); onInnovCatChange(); }
    setVal('l-title', f['l-title']);

    if (f['ac-level'])   { setVal('ac-level', f['ac-level']); onAcadLevelChange(); }
    if (f['ac-grade'])   setVal('ac-grade', f['ac-grade']);
    if (f['ac-cat'])     setVal('ac-cat', f['ac-cat']);

    if (f['sk-level'])   { setVal('sk-level', f['sk-level']); onSkillLevelChange(); }
    if (f['sk-grade'])   setVal('sk-grade', f['sk-grade']);
    if (f['sk-cat'])     { setVal('sk-cat', f['sk-cat']); onSkillCatChange(); }
    if (f['sk-subskill']) setVal('sk-subskill', f['sk-subskill']);

    const prefix = _activeMain;
    const decl = document.getElementById(`${prefix}-sf-decl`);
    if (decl && f[`${prefix}-sf-decl`] !== undefined) decl.checked = f[`${prefix}-sf-decl`];

    ['l-report','t-report','y-report','sk-report'].forEach(id => {
      if (!fn[id]) return;
      const el = document.getElementById(id);
      if (el && !el.parentNode.querySelector('.draft-file-note')) {
        const note = document.createElement('span');
        note.className = 'draft-file-note';
        note.textContent = 'Previously: ' + fn[id];
        el.parentNode.insertBefore(note, el.nextSibling);
      }
    });

    _restoring = false;
    validateForm();
    updateDraftIndicator();
  }

  function startAutoSave() {
    if (_draftTimer) clearInterval(_draftTimer);
    _draftTimer = setInterval(saveDraft, 30000);
    if (!_draftListenersAdded) {
      document.addEventListener('visibilitychange', saveDraft);
      window.addEventListener('blur', saveDraft);
      _draftListenersAdded = true;
    }
  }

  function checkAndShowDraft() {
    const draft = loadDraftData();
    if (draft) showDraftBanner(draft);
    updateDraftIndicator();
  }

  // ── Reset form fields after successful submission ─────────────
  function resetFormFields() {
    clearAllValidationErrors();
    ['l-name','l-age','l-title','l-teacher',
     't-name','t-title',
     'y-name','y-age','y-title','y-mentor',
     'ac-name','ac-age','ac-teacher',
     'sk-name','sk-age','sk-title','sk-teacher',
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    ['l-sex','t-sex','y-sex','ac-sex','sk-sex'].forEach(nm =>
      document.querySelectorAll(`input[name="${nm}"]`).forEach(r => r.checked = false));

    const lLvl = document.getElementById('l-level');
    if (lLvl) lLvl.selectedIndex = 0;
    onLevelChange();

    ['t-cat','y-cat'].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });

    const acLvl = document.getElementById('ac-level');
    if (acLvl) acLvl.selectedIndex = 0;
    onAcadLevelChange();

    const skLvl = document.getElementById('sk-level');
    if (skLvl) skLvl.selectedIndex = 0;
    onSkillLevelChange();

    const skCat = document.getElementById('sk-cat');
    if (skCat) skCat.selectedIndex = 0;
    onSkillCatChange();

    ['l-report','t-report','y-report','sk-report'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const c = el.cloneNode(true); 
        el.parentNode.replaceChild(c, el);
      }
      const note = el && el.parentNode.querySelector('.file-ready-label');
      if (note) note.remove();
    });

    ['innovations', 'academics', 'skills'].forEach(prefix => {
      const decl = document.getElementById(`${prefix}-sf-decl`);
      if (decl) decl.checked = false;
    });
  }

  // ── DOM Helpers ───────────────────────────────────────────────
  function v(id)      { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function rval(nm)   { const e = document.querySelector(`input[name="${nm}"]:checked`); return e ? e.value : ''; }
  function filled(id) { return v(id).length > 0; }
  function vis(id)    { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }
  function show(id)   { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
  function hide(id)   { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
  function ir(lbl, val) {
    return `<div class="info-row"><span class="info-label">${lbl}</span><span class="info-value">${val || '&#8212;'}</span></div>`;
  }

  function levelsFor(type) { return LEVELS_BY_SCHOOL_TYPE[type] || []; }

  function activeFileInput() {
    const tab = effectiveTab();
    if (tab === 'learner' && vis('l-report-field')) return document.getElementById('l-report');
    if (tab === 'teacher') return document.getElementById('t-report');
    if (tab === 'youth')   return document.getElementById('y-report');
    if (tab === 'skills'  && vis('sk-report-field')) return document.getElementById('sk-report');
    return null;
  }

  function toBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(new Error('Could not read file.'));
      r.readAsDataURL(file);
    });
  }

  function todayDate() {
    const d = new Date();
    const m = ['January','February','March','April','May','June',
               'July','August','September','October','November','December'];
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}`;
  }

  // ── Validation UI ─────────────────────────────────────────────
  function showValidationErrors() {
    clearAllValidationErrors();
    const tab = effectiveTab();
    const prefix = _activeMain;
    const errEls = [];

    function chkFilled(id) {
      if (!filled(id)) { const f = markFieldError(id); if (f) errEls.push(f); }
    }
    function chkSel(id) {
      const el = document.getElementById(id);
      if (!el || !el.value) { const f = markFieldError(id); if (f) errEls.push(f); }
    }
    function chkRadio(name) {
      if (!rval(name)) { const f = markRadioError(name); if (f) errEls.push(f); }
    }

    if (tab === 'learner') {
      chkFilled('l-name'); chkFilled('l-age'); chkRadio('l-sex');
      chkSel('l-level'); chkSel('l-grade'); chkSel('l-cat');
      chkFilled('l-teacher');
    } else if (tab === 'teacher') {
      chkFilled('t-name'); chkRadio('t-sex'); chkSel('t-cat');
    } else if (tab === 'youth') {
      chkFilled('y-name'); chkFilled('y-age'); chkRadio('y-sex');
      chkSel('y-cat'); chkFilled('y-mentor');
    } else if (tab === 'quiz') {
      chkFilled('ac-name'); chkFilled('ac-age'); chkRadio('ac-sex');
      chkSel('ac-level'); chkSel('ac-grade'); chkSel('ac-cat');
      chkFilled('ac-teacher');
    } else if (tab === 'skills') {
      chkFilled('sk-name'); chkFilled('sk-age'); chkRadio('sk-sex');
      chkSel('sk-level'); chkSel('sk-grade'); chkSel('sk-cat'); chkSel('sk-subskill');
      chkFilled('sk-teacher');
    }

    const declCheckbox = document.getElementById(`${prefix}-sf-decl`);
    if (!declCheckbox || !declCheckbox.checked) {
      const f = markDeclError(prefix); if (f) errEls.push(f);
    }

    if (!errEls.length) return true;

    showValidationBanner(prefix);
    shakeSubmitBtn(prefix);
    
    // Scroll sheet to first error
    const sheet = document.getElementById('sheet-' + prefix);
    if (sheet) {
      setTimeout(() => errEls[0].scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    }
    return false;
  }

  function markFieldError(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const field = el.closest('.field');
    if (!field) return null;
    field.classList.add('field--error');
    if (!field.querySelector('.field-error-msg')) {
      const msg = document.createElement('span');
      msg.className = 'field-error-msg';
      msg.textContent = 'This field is required';
      field.appendChild(msg);
    }
    return field;
  }

  function markFieldErrorWithMsg(id, errorText) {
    const el = document.getElementById(id);
    if (!el) return null;
    const field = el.closest('.field');
    if (!field) return null;
    field.classList.add('field--error');
    let msg = field.querySelector('.field-error-msg');
    if (!msg) {
      msg = document.createElement('span');
      msg.className = 'field-error-msg';
      field.appendChild(msg);
    }
    msg.textContent = errorText;
    return field;
  }

  function markRadioError(name) {
    const el = document.querySelector(`input[name="${name}"]`);
    if (!el) return null;
    const field = el.closest('.field');
    if (!field) return null;
    field.classList.add('field--error');
    if (!field.querySelector('.field-error-msg')) {
      const msg = document.createElement('span');
      msg.className = 'field-error-msg';
      msg.textContent = 'This field is required';
      field.appendChild(msg);
    }
    return field;
  }

  function markDeclError(prefix) {
    const lbl = document.querySelector(`#sheet-${prefix} .decl-label`);
    if (!lbl) return null;
    lbl.classList.add('decl--error');
    if (!lbl.parentNode.querySelector('.field-error-msg')) {
      const msg = document.createElement('span');
      msg.className = 'field-error-msg';
      msg.style.marginTop = '6px';
      msg.textContent = 'This field is required';
      lbl.parentNode.insertBefore(msg, lbl.nextSibling);
    }
    return lbl.closest('.form-card') || lbl;
  }

  function clearFieldErrorForEl(el) {
    if (!el) return;
    const prefix = _activeMain;
    if (el.id === `${prefix}-sf-decl`) {
      const lbl = document.querySelector(`#sheet-${prefix} .decl-label`);
      if (lbl) {
        lbl.classList.remove('decl--error');
        const m = lbl.parentNode.querySelector('.field-error-msg');
        if (m) m.remove();
      }
    } else {
      const field = el.closest('.field');
      if (field) {
        field.classList.remove('field--error');
        const m = field.querySelector('.field-error-msg');
        if (m) m.remove();
      }
    }
    
    // Remove banner if no errors left
    const sheet = document.getElementById('sheet-' + prefix);
    if (sheet && !sheet.querySelector('.field--error') && !sheet.querySelector('.decl--error')) {
      const banner = sheet.querySelector('.sf-val-banner');
      if (banner) banner.remove();
    }
  }

  function clearAllValidationErrors() {
    document.querySelectorAll('.field--error').forEach(f => {
      f.classList.remove('field--error');
      const m = f.querySelector('.field-error-msg');
      if (m) m.remove();
    });
    document.querySelectorAll('.decl-label').forEach(lbl => {
      lbl.classList.remove('decl--error');
      const m = lbl.parentNode.querySelector('.field-error-msg');
      if (m) m.remove();
    });
    document.querySelectorAll('.sf-val-banner').forEach(banner => banner.remove());
  }

  function showValidationBanner(prefix) {
    const msg = document.getElementById(`${prefix}-sf-msg`);
    if (!msg) return;
    const existing = msg.querySelector('.sf-val-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.className = 'sf-val-banner';
    banner.textContent = 'Please fill in all highlighted fields';
    msg.insertBefore(banner, msg.firstChild);
  }

  function shakeSubmitBtn(prefix) {
    const btn = document.getElementById(`${prefix}-sf-submit`);
    if (!btn) return;
    btn.classList.remove('btn-shake');
    void btn.offsetWidth;
    btn.classList.add('btn-shake');
    btn.addEventListener('animationend', () => btn.classList.remove('btn-shake'), { once: true });
  }

  function toggleInfoCard() {
    const trigger = document.querySelector('#sf-info-card .collapsible-trigger');
    const content = document.getElementById('sf-info-content');
    if (!trigger || !content) return;
    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
      content.classList.remove('hidden');
      trigger.classList.add('expanded');
    } else {
      content.classList.add('hidden');
      trigger.classList.remove('expanded');
    }
  }

  return { 
    render, 
    resetAndReuseForm,
    viewSubmissionsFromSuccess,
    submitWithBypass,
    toggleInfoCard
  };

})();
