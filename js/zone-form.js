// zone-form.js — Zonal JETS Coordinator submission form
// JETS 2024-2026 | Lavushimanda District

const ZoneForm = (() => {

  let _pageId, _auth, _activeMain, _activeSub, _schoolFieldEl;
  let _draftTimer, _restoring = false, _draftListenersAdded = false;
  const ZONE_SLOT_TOTAL = 64;
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
    _pageId        = pageId;
    _auth          = auth;
    _activeMain    = 'innovations';
    _activeSub     = 'learner';
    _schoolFieldEl = null;

    App.setPageHTML(pageId, buildHTML());
    bindEvents();
    moveSchoolField();
    loadSlotCount();
    startAutoSave();
    checkAndShowDraft();
  }

  function effectiveTab() {
    if (_activeMain === 'innovations') return _activeSub; // 'learner'|'teacher'|'youth'
    if (_activeMain === 'academics')   return 'quiz';
    return 'skills';
  }

  // ── Full Page HTML ────────────────────────────────────────────
  function buildHTML() {
    return `
<div class="form-topbar">
  <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
  <span class="topbar-title">Zone Submission</span>
  <button class="btn-signout-form" onclick="App.signOut()">Sign Out</button>
</div>

<header class="sf-header">
  <div class="sf-header-logos">
    <img src="assets/coat-of-arms.png" alt="Zambia Coat of Arms" class="sf-logo"
         onerror="this.classList.add('logo-missing')">
    <div class="sf-header-text">
      <p class="sf-h-title">JETS 2024&#8211;2026</p>
      <p class="sf-h-sub">ZONE SUBMISSION FORM</p>
      <p class="sf-h-district">Lavushimanda District &nbsp;|&nbsp; Muchinga Region</p>
    </div>
    <img src="assets/jets-logo.png" alt="JETS Logo" class="sf-logo"
         onerror="this.classList.add('logo-missing')">
  </div>
  <div class="sf-signedin-bar">
    Signed in as: &nbsp;<strong>${App.maskPhone(_auth.phone)}</strong>
  </div>
</header>

<div class="sf-body">

  <div class="form-card">
    <div class="card-title">Zone Information</div>
    ${ir('Zone Name', _auth.zone)}
    ${ir('Zonal JETS Coordinator Name', _auth.organiserName)}
    ${ir('Phone', _auth.phone)}
    <p class="sf-wrong-details">Wrong details? Contact the District JETS Organiser.</p>
  </div>

  <div class="form-card">
    <div class="sf-slot-row">
      <span class="sf-slot-label">Zone slots used</span>
      <span id="sf-slot-display" class="sf-slot-display">Loading&hellip;</span>
    </div>
    <div class="sf-slot-track">
      <div id="sf-slot-fill" class="sf-slot-fill" style="width:0%"></div>
    </div>
    <p class="sf-slot-note">Total: <strong>${ZONE_SLOT_TOTAL}</strong> &mdash; ${_auth.zone} Zone</p>
  </div>

  <!-- ── VIEW MY SUBMISSIONS ── -->
  <button class="btn-view-history"
          onclick="SubmissionHistory.show('page-zone', App.authData, 'zone', ${ZONE_SLOT_TOTAL})">
    &#128203; VIEW MY SUBMISSIONS
  </button>

  <!-- ── MAIN TAB BAR ── -->
  <div class="sf-tab-bar" id="sf-main-tab-bar">
    <button class="sf-tab-btn active" data-tab="innovations">INNOVATIONS</button>
    <button class="sf-tab-btn" data-tab="academics">ACADEMICS</button>
    <button class="sf-tab-btn" data-tab="skills">SKILLS</button>
  </div>

  <!-- ── INNOVATIONS PANEL ── -->
  <div id="tab-innovations" class="sf-tab-panel">
    <div class="sf-tab-bar sf-sub-tab-bar" id="sf-sub-tab-bar">
      <button class="sf-sub-tab-btn active" data-subtab="learner">Learner</button>
      <button class="sf-sub-tab-btn" data-subtab="teacher">Teacher</button>
      <button class="sf-sub-tab-btn" data-subtab="youth">Youth</button>
    </div>

    <!-- Learner sub-tab: Level → Grade → Category → Title + Report -->
    <div id="subtab-learner" class="sf-subtab-panel">
      <div class="form-card">
        <div class="card-title">Learner Participant</div>
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
        <div class="field">
          <label for="l-level">Level <span class="req">*</span></label>
          <select id="l-level" disabled>
            <option value="">&#8212; Select School First &#8212;</option>
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
        <div class="field hidden" id="l-title-field">
          <label for="l-title">Title of Innovation <span class="req">*</span></label>
          <input type="text" id="l-title" placeholder="Enter title of innovation">
        </div>
        <div class="field hidden" id="l-report-field">
          <label for="l-report">Innovation Report <span class="req">*</span></label>
          <input type="file" id="l-report" accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf">
          <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
        </div>
        <div class="field">
          <label for="l-teacher">Supervising Teacher Name <span class="req">*</span></label>
          <input type="text" id="l-teacher" placeholder="Full name of supervising teacher">
        </div>
      </div>
    </div>

    <!-- Teacher sub-tab: Category → Title + Report -->
    <div id="subtab-teacher" class="sf-subtab-panel hidden">
      <div class="form-card">
        <div class="card-title">Teacher Participant</div>
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
          <label for="t-cat">Category <span class="req">*</span></label>
          <select id="t-cat">
            <option value="">&#8212; Select Category &#8212;</option>
            ${INNOVATION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="t-title">Title of Innovation <span class="req">*</span></label>
          <input type="text" id="t-title" placeholder="Enter title of innovation">
        </div>
        <div class="field">
          <label for="t-report">Innovation Report <span class="req">*</span></label>
          <input type="file" id="t-report" accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf">
          <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
        </div>
      </div>
    </div>

    <!-- Youth sub-tab: Category → Title + Report -->
    <div id="subtab-youth" class="sf-subtab-panel hidden">
      <div class="form-card">
        <div class="card-title">Out-of-School Youth Participant</div>
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
          <label for="y-cat">Category <span class="req">*</span></label>
          <select id="y-cat">
            <option value="">&#8212; Select Category &#8212;</option>
            ${INNOVATION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="y-title">Title of Innovation <span class="req">*</span></label>
          <input type="text" id="y-title" placeholder="Enter title of innovation">
        </div>
        <div class="field">
          <label for="y-report">Innovation Report <span class="req">*</span></label>
          <input type="file" id="y-report" accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf">
          <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
        </div>
        <div class="field">
          <label for="y-mentor">Mentor Name <span class="req">*</span></label>
          <input type="text" id="y-mentor" placeholder="Full name of mentor">
        </div>
      </div>
    </div>
  </div>

  <!-- ── ACADEMICS PANEL: Level → Grade → Subject ── -->
  <div id="tab-academics" class="sf-tab-panel hidden">
    <div class="form-card">
      <div class="card-title">Academics / Quiz &amp; Olympiads Participant</div>
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
        <label for="ac-level">Level <span class="req">*</span></label>
        <select id="ac-level" disabled>
          <option value="">&#8212; Select School First &#8212;</option>
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
      <div class="field">
        <label for="ac-teacher">Supervising Teacher Name <span class="req">*</span></label>
        <input type="text" id="ac-teacher" placeholder="Full name of supervising teacher">
      </div>
    </div>
  </div>

  <!-- ── SKILLS PANEL ── -->
  <div id="tab-skills" class="sf-tab-panel hidden">
    <div class="form-card" id="sk-tracker-card">
      <div class="card-title">Skills Slots Tracker</div>
      <p id="sk-tracker-loading" class="sk-tracker-loading">Loading slot counts&hellip;</p>
      <div id="sk-tracker-rows" class="hidden">
        ${Object.entries(SKILLS).map(([cat, info]) => {
          const slug = SKILL_SLUGS[cat];
          return `<div class="sk-tracker-row" id="sk-tr-${slug}">
            <span class="sk-tr-label">${cat}</span>
            <span class="sk-tr-count"><span id="sk-used-${slug}">?</span>/${info.slots}</span>
            <span class="sk-tr-remain" id="sk-rem-${slug}">? remaining</span>
          </div>`;
        }).join('')}
        <div class="sk-tracker-total-row">
          <span>TOTAL</span>
          <span><span id="sk-used-total">?</span>/${Object.values(SKILLS).reduce((a, s) => a + s.slots, 0)}</span>
        </div>
      </div>
      <p id="sk-tracker-error" class="hidden sk-tracker-error"></p>
    </div>
    <div class="form-card hidden" id="sk-unavail-card">
      <div class="alert alert-info">Technical Skills is not available for this school type.<br>It applies to Junior Secondary and Senior Secondary levels only.</div>
    </div>
    <div class="form-card" id="sk-form-card">
      <div class="card-title">Technical Skills Participant</div>
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
      <div class="field">
        <label for="sk-level">Level <span class="req">*</span></label>
        <select id="sk-level" disabled>
          <option value="">&#8212; Select School First &#8212;</option>
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
        <select id="sk-cat" disabled>
          <option value="">&#8212; Select School First &#8212;</option>
        </select>
        <p id="sk-cat-warn" class="field-warn hidden"></p>
      </div>
      <div class="field">
        <label for="sk-subskill">Sub-Skill <span class="req">*</span></label>
        <select id="sk-subskill" disabled>
          <option value="">&#8212; Select Category First &#8212;</option>
        </select>
      </div>
      <div class="field hidden" id="sk-title-field">
        <label for="sk-title">Title of Innovation <span class="req">*</span></label>
        <input type="text" id="sk-title" placeholder="Enter title of innovation">
      </div>
      <div class="field hidden" id="sk-report-field">
        <label for="sk-report">Innovation Report <span class="req">*</span></label>
        <input type="file" id="sk-report" accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf">
        <span class="field-hint">Accepted: .doc .docx .pdf &nbsp;&bull;&nbsp; Max 10 MB</span>
      </div>
      <div class="field">
        <label for="sk-teacher">Supervising Teacher Name <span class="req">*</span></label>
        <input type="text" id="sk-teacher" placeholder="Full name of supervising teacher">
      </div>
    </div>
  </div>

  <!-- ── DECLARATION ── -->
  <div class="form-card">
    <div class="card-title">Declaration</div>
    <label class="decl-label">
      <input type="checkbox" id="sf-decl" class="decl-checkbox">
      <span class="decl-text">I confirm participant has been selected to represent their zone at the District JETS Fair.</span>
    </label>
    <div class="decl-meta">
      ${ir('Submitted by', _auth.organiserName)}
      ${ir('Date', todayDate())}
    </div>
  </div>

  <!-- ── SUBMIT ── -->
  <div class="sf-actions">
    <button id="sf-submit" class="btn-form-submit" disabled>SUBMIT PARTICIPANT</button>
    <div id="sf-msg"></div>
    <div id="sf-draft-indicator" class="draft-indicator"></div>
  </div>

</div>`;
  }

  // ── School Field — single element moved between panels ────────
  function createSchoolField() {
    const opts = zoneSchools()
      .map(s => `<option value="${s.name}">${s.name} (${s.type})</option>`)
      .join('');
    const card = document.createElement('div');
    card.className = 'form-card';
    card.innerHTML = `
      <div class="field">
        <label for="zf-school">School Participant is Coming From <span class="req">*</span></label>
        <select id="zf-school">
          <option value="">&#8212; Select School &#8212;</option>
          ${opts}
        </select>
      </div>`;
    return card;
  }

  function activePanel() {
    if (_activeMain === 'innovations') return document.getElementById('subtab-' + _activeSub);
    return document.getElementById('tab-' + _activeMain);
  }

  function moveSchoolField() {
    if (!_schoolFieldEl) _schoolFieldEl = createSchoolField();
    const panel = activePanel();
    if (!panel) return;
    panel.insertBefore(_schoolFieldEl, panel.firstChild);
  }

  // ── Events ────────────────────────────────────────────────────
  function bindEvents() {
    window._sfValidate = validateForm;

    document.getElementById('sf-main-tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.sf-tab-btn');
      if (btn) switchMainTab(btn.dataset.tab);
    });

    document.getElementById('sf-sub-tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.sf-sub-tab-btn');
      if (btn) switchSubTab(btn.dataset.subtab);
    });

    document.getElementById('sf-submit').addEventListener('click', handleSubmit);

    const page = document.getElementById(_pageId);
    page.addEventListener('change', e => {
      if      (e.target.id === 'zf-school') onSchoolChange();
      else if (e.target.id === 'l-level')   onLevelChange();
      else if (e.target.id === 'l-cat')     onInnovCatChange();
      else if (e.target.id === 'ac-level')  onAcadLevelChange();
      else if (e.target.id === 'sk-level')  onSkillLevelChange();
      else if (e.target.id === 'sk-cat')    onSkillCatChange();
      validateForm();
    });
    page.addEventListener('input', () => validateForm());
  }

  // ── Tab Switching ─────────────────────────────────────────────
  function switchMainTab(tab) {
    saveDraft();
    _activeMain = tab;
    document.querySelectorAll('#sf-main-tab-bar .sf-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    ['innovations', 'academics', 'skills'].forEach(t =>
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab));
    moveSchoolField();
    if (tab === 'skills') loadSkillCounts();
    validateForm();
    window.scrollTo(0, 0);
  }

  function switchSubTab(subtab) {
    saveDraft();
    _activeSub = subtab;
    document.querySelectorAll('#sf-sub-tab-bar .sf-sub-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.subtab === subtab));
    ['learner', 'teacher', 'youth'].forEach(t =>
      document.getElementById('subtab-' + t).classList.toggle('hidden', t !== subtab));
    moveSchoolField();
    validateForm();
    window.scrollTo(0, 0);
  }

  // ── School Change — cascades to all panels ────────────────────
  function onSchoolChange() {
    const school      = v('zf-school');
    const type        = schoolTypeFor(school);
    const levels      = LEVELS_BY_SCHOOL_TYPE[type] || [];
    const skillLevels = levels.filter(l => l === 'Junior Secondary' || l === 'Senior Secondary');

    // Learner level
    const lSel = document.getElementById('l-level');
    if (levels.length) {
      lSel.innerHTML = '<option value="">&#8212; Select Level &#8212;</option>' +
        levels.map(l => `<option value="${l}">${l}</option>`).join('');
      lSel.disabled = false;
    } else {
      lSel.innerHTML = '<option value="">&#8212; Select School First &#8212;</option>';
      lSel.disabled = true;
    }
    const lGrade = document.getElementById('l-grade');
    lGrade.innerHTML = '<option value="">&#8212; Select Level First &#8212;</option>';
    lGrade.disabled = true;
    document.getElementById('l-cat').value = '';
    hide('l-cat-field'); hide('l-title-field'); hide('l-report-field');

    // Academics level
    const acSel = document.getElementById('ac-level');
    if (levels.length) {
      acSel.innerHTML = '<option value="">&#8212; Select Level &#8212;</option>' +
        levels.map(l => `<option value="${l}">${l}</option>`).join('');
      acSel.disabled = false;
    } else {
      acSel.innerHTML = '<option value="">&#8212; Select School First &#8212;</option>';
      acSel.disabled = true;
    }
    const acGrade = document.getElementById('ac-grade');
    acGrade.innerHTML = '<option value="">&#8212; Select Level First &#8212;</option>';
    acGrade.disabled = true;
    const acCat = document.getElementById('ac-cat');
    acCat.innerHTML = '<option value="">&#8212; Select Level First &#8212;</option>';
    acCat.disabled = true;

    // Skills level (secondary only)
    const skSel    = document.getElementById('sk-level');
    const skCat    = document.getElementById('sk-cat');
    const skSub    = document.getElementById('sk-subskill');
    const skGrade  = document.getElementById('sk-grade');
    const skForm   = document.getElementById('sk-form-card');
    const skUnavail= document.getElementById('sk-unavail-card');
    if (skillLevels.length) {
      skSel.innerHTML = '<option value="">&#8212; Select Level &#8212;</option>' +
        skillLevels.map(l => `<option value="${l}">${l}</option>`).join('');
      skSel.disabled = false;
      skCat.innerHTML = '<option value="">&#8212; Select Skill Category &#8212;</option>' +
        Object.keys(SKILLS).map(c => `<option value="${c}">${c}</option>`).join('');
      skCat.disabled = false;
      if (skForm)    skForm.classList.remove('hidden');
      if (skUnavail) skUnavail.classList.add('hidden');
    } else {
      skSel.innerHTML = '<option value="">&#8212; Select Level &#8212;</option>';
      skSel.disabled = true;
      skCat.innerHTML = '<option value="">&#8212; Select Skill Category &#8212;</option>';
      skCat.disabled = true;
      if (skForm)    skForm.classList.add('hidden');
      if (skUnavail) skUnavail.classList.remove('hidden');
    }
    skGrade.innerHTML = '<option value="">&#8212; Select Level First &#8212;</option>';
    skGrade.disabled = true;
    skSub.innerHTML = '<option value="">&#8212; Select Category First &#8212;</option>';
    skSub.disabled = true;
    hide('sk-report-field');
    hide('sk-title-field');
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
  }

  function onInnovCatChange() {
    const cat = v('l-cat');
    cat ? show('l-title-field')  : hide('l-title-field');
    cat ? show('l-report-field') : hide('l-report-field');
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
    const warn = document.getElementById('sk-cat-warn');
    if (warn && cat) {
      const skCatSel = document.getElementById('sk-cat');
      const opt = skCatSel && Array.from(skCatSel.options).find(o => o.value === cat);
      const full = opt && opt.disabled;
      warn.textContent = full ? cat + ' is full. No more participants.' : '';
      warn.classList.toggle('hidden', !full);
    }
  }

  // ── Validation ────────────────────────────────────────────────
  function validateForm() {
    const btn = document.getElementById('sf-submit');
    if (btn) btn.disabled = !isValid() || (window.NetStatus && window.NetStatus.isOffline);
  }

  function isValid() {
    if (!document.getElementById('sf-decl').checked) return false;
    if (!v('zf-school')) return false;
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
           filled('l-title') && hasFile('l-report') &&
           filled('l-teacher');
  }

  function teacherValid() {
    return filled('t-name') && rval('t-sex') && v('t-cat') &&
           filled('t-title') && hasFile('t-report');
  }

  function youthValid() {
    return filled('y-name') && filled('y-age') && rval('y-sex') &&
           v('y-cat') && filled('y-title') && hasFile('y-report') && filled('y-mentor');
  }

  function academicsValid() {
    return filled('ac-name') && filled('ac-age') && rval('ac-sex') &&
           v('ac-level') && v('ac-grade') && v('ac-cat') &&
           filled('ac-teacher');
  }

  function skillsValid() {
    if (!vis('sk-form-card')) return false;
    return filled('sk-name') && filled('sk-age') && rval('sk-sex') &&
           v('sk-level') && v('sk-grade') && v('sk-cat') && v('sk-subskill') &&
           (!vis('sk-report-field') || hasFile('sk-report')) &&
           (!vis('sk-title-field')  || filled('sk-title')) &&
           filled('sk-teacher');
  }

  // ── Submit ────────────────────────────────────────────────────
  async function handleSubmit() {
    const btn = document.getElementById('sf-submit');
    const msg = document.getElementById('sf-msg');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting&hellip;';
    msg.innerHTML = '';

    try {
      const payload = collectData();
      const fi = activeFileInput();
      if (fi && fi.files[0]) {
        const f = fi.files[0];
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['pdf', 'doc', 'docx'].includes(ext)) {
          throw new Error('Invalid file type ".' + ext + '". Only .pdf, .doc, and .docx files are accepted.');
        }
        if (f.size > 10 * 1024 * 1024) throw new Error('File exceeds 10 MB. Please reduce the file size and try again.');
        payload.reportFileBase64 = await toBase64(f);
        payload.reportFileName   = f.name;
        payload.reportFileType   = f.type;
      }

      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'submitZone', ...payload }),
      });
      if (!res.ok) throw new Error('Server error (' + res.status + ').');
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Submission failed.');

      const waText = encodeURIComponent(
        `JETS 2024-2026 Submission Confirmed\n` +
        `Zone: ${_auth.zone}\n` +
        `School: ${payload.participantSchool || ''}\n` +
        `Participant: ${payload.fullName}\n` +
        (payload.category ? `Category: ${payload.category}\n` : '') +
        `Reference No: ${data.refNumber || ''}\n` +
        `Submitted by: ${_auth.organiserName}\n` +
        `Date: ${todayDate()}`
      );
      msg.innerHTML = `
        <div class="alert alert-success"><strong>${payload.fullName}</strong> submitted successfully. Ref: ${data.refNumber || ''}</div>
        <a class="btn-whatsapp" href="https://wa.me/?text=${waText}" target="_blank" rel="noopener">&#128172; Send Confirmation via WhatsApp</a>
        <button class="btn-add-another" id="sf-add-btn">+ ADD ANOTHER PARTICIPANT</button>`;
      document.getElementById('sf-add-btn').addEventListener('click', () => render(_pageId, _auth));
      clearDraft();
      loadSlotCount();
      if (effectiveTab() === 'skills') loadSkillCounts();
      if (typeof WelcomeStats !== 'undefined') WelcomeStats.refresh();

    } catch (err) {
      msg.innerHTML = `
        <div class="alert alert-error">${err.message}</div>
        <button class="btn-retry" id="sf-retry-btn">Try Again</button>`;
      document.getElementById('sf-retry-btn').addEventListener('click', () => {
        msg.innerHTML = '';
        btn.disabled = false;
        btn.textContent = 'SUBMIT PARTICIPANT';
      });
      btn.disabled = false;
      btn.textContent = 'SUBMIT PARTICIPANT';
    }
  }

  function collectData() {
    const school = v('zf-school');
    const base = {
      formType:          'zone',
      phone:             _auth.phone,
      zone:              _auth.zone,
      coordinatorName:   _auth.organiserName,
      submittedBy:       _auth.organiserName,
      submittedDate:     new Date().toISOString(),
      participantSchool: school,
      schoolType:        schoolTypeFor(school),
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
      sex:                rval('sk-sex'),
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
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getZoneCount', zone: _auth.zone }),
      });
      const data = await res.json();
      if (typeof data.count === 'number') updateSlot(data.count);
    } catch (_) {
      const el = document.getElementById('sf-slot-display');
      if (el) el.textContent = '&#8212; of ' + ZONE_SLOT_TOTAL;
    }
  }

  function updateSlot(n) {
    const pct  = Math.min(100, Math.round((n / ZONE_SLOT_TOTAL) * 100));
    const disp = document.getElementById('sf-slot-display');
    const fill = document.getElementById('sf-slot-fill');
    if (disp) disp.textContent = n + ' of ' + ZONE_SLOT_TOTAL;
    if (fill) {
      fill.style.width = pct + '%';
      fill.classList.toggle('sf-slot-warn', pct >= 80 && pct < 100);
      fill.classList.toggle('sf-slot-full', pct >= 100);
    }
  }

  // ── Skill Slot Tracker ────────────────────────────────────────
  async function loadSkillCounts() {
    const loading = document.getElementById('sk-tracker-loading');
    const rows    = document.getElementById('sk-tracker-rows');
    const errEl   = document.getElementById('sk-tracker-error');
    if (!loading) return;
    loading.classList.remove('hidden');
    if (rows)  rows.classList.add('hidden');
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
    try {
      const res  = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body:   JSON.stringify({ action: 'getZoneSkillCounts', zone: _auth.zone }),
      });
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Failed to load counts.');
      updateSkillTracker(data.counts || {});
      loading.classList.add('hidden');
      if (rows) rows.classList.remove('hidden');
    } catch (err) {
      loading.classList.add('hidden');
      if (errEl) { errEl.classList.remove('hidden'); errEl.textContent = 'Could not load slot counts: ' + err.message; }
    }
  }

  function updateSkillTracker(counts) {
    const skCatSel = document.getElementById('sk-cat');
    let totalUsed  = 0;
    Object.entries(SKILLS).forEach(([cat, info]) => {
      const slug   = SKILL_SLUGS[cat];
      const used   = counts[cat] || 0;
      const rem    = Math.max(0, info.slots - used);
      totalUsed   += used;
      const usedEl = document.getElementById('sk-used-' + slug);
      const remEl  = document.getElementById('sk-rem-'  + slug);
      const rowEl  = document.getElementById('sk-tr-'   + slug);
      if (usedEl) usedEl.textContent = used;
      if (remEl)  { remEl.textContent = rem + ' remaining'; remEl.classList.toggle('sk-tr-full', rem === 0); }
      if (rowEl)  rowEl.classList.toggle('sk-tr-full-row', rem === 0);
      if (skCatSel) {
        const opt = Array.from(skCatSel.options).find(o => o.value === cat);
        if (opt) { opt.disabled = rem === 0; opt.textContent = rem === 0 ? cat + ' (FULL)' : cat; }
      }
    });
    const totalEl = document.getElementById('sk-used-total');
    if (totalEl) totalEl.textContent = totalUsed;
  }

  // ── Draft Auto-Save ───────────────────────────────────────────
  function draftKey() { return 'jets_draft_zone_' + _auth.phone; }

  function collectDraftData() {
    const fields = {};
    [
      'zf-school',
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
    const decl = document.getElementById('sf-decl');
    if (decl) fields['sf-decl'] = decl.checked;
    const fileNames = {};
    ['l-report','t-report','y-report','sk-report'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.files && el.files.length > 0) fileNames[id] = el.files[0].name;
    });
    return { savedAt: new Date().toISOString(), activeMain: _activeMain, activeSub: _activeSub, fields, fileNames };
  }

  function saveDraft() {
    if (_restoring || !document.getElementById('sf-submit')) return;
    try { localStorage.setItem(draftKey(), JSON.stringify(collectDraftData())); updateDraftIndicator(); } catch (_) {}
  }

  function clearDraft() {
    try { localStorage.removeItem(draftKey()); } catch (_) {}
    const ind = document.getElementById('sf-draft-indicator');
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
    const ind = document.getElementById('sf-draft-indicator');
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
        <span class="draft-banner-msg">&#128203; Draft restored from ${fmtSavedTime(draft.savedAt)}.</span>
      </div>
      <div class="draft-banner-btns">
        <button class="draft-btn-continue" id="sf-draft-continue">CONTINUE DRAFT</button>
        <button class="draft-btn-fresh" id="sf-draft-fresh">START FRESH</button>
      </div>`;
    body.insertBefore(banner, body.firstChild);
    document.getElementById('sf-draft-continue').addEventListener('click', () => {
      restoreDraft(draft);
      banner.remove();
      const msg = document.getElementById('sf-msg');
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
    if (draft.activeMain) switchMainTab(draft.activeMain);
    if (draft.activeSub)  switchSubTab(draft.activeSub);

    const setVal = (id, val) => { if (val === undefined) return; const el = document.getElementById(id); if (el) el.value = val; };
    const setRadio = (name, val) => { if (!val) return; const el = document.querySelector(`input[name="${name}"][value="${val}"]`); if (el) el.checked = true; };

    // Restore school first — cascades levels into all panels
    if (f['zf-school']) { setVal('zf-school', f['zf-school']); onSchoolChange(); }

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

    const decl = document.getElementById('sf-decl');
    if (decl && f['sf-decl'] !== undefined) decl.checked = f['sf-decl'];

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

  // ── DOM Helpers ───────────────────────────────────────────────
  function v(id)       { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function rval(nm)    { const e = document.querySelector(`input[name="${nm}"]:checked`); return e ? e.value : ''; }
  function filled(id)  { return v(id).length > 0; }
  function hasFile(id) { const e = document.getElementById(id); return e && e.files && e.files.length > 0; }
  function vis(id)     { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }
  function show(id)    { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
  function hide(id)    { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
  function ir(lbl, val) {
    return `<div class="info-row"><span class="info-label">${lbl}</span><span class="info-value">${val || '&#8212;'}</span></div>`;
  }

  // ── Data Helpers ──────────────────────────────────────────────
  function zoneSchools() {
    return (ZONES[_auth.zone] && ZONES[_auth.zone].schools) ? ZONES[_auth.zone].schools : [];
  }

  function schoolTypeFor(schoolName) {
    const s = zoneSchools().find(s => s.name === schoolName);
    return s ? s.type : '';
  }

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

  return { render };

})();
