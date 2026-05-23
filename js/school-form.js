// school-form.js — School JETS Organiser submission form
// JETS 2024-2026 | Lavushimanda District

const SchoolForm = (() => {

  let _pageId, _auth, _activeTab, _slotTotal;

  // ── Entry Point ───────────────────────────────────────────────
  function render(pageId, auth) {
    _pageId    = pageId;
    _auth      = auth;
    _activeTab = 'learner';
    _slotTotal = SLOT_TOTALS[auth.schoolType] || 30;

    App.setPageHTML(pageId, buildHTML());
    bindEvents();
    buildPtypeRadios(['Learner Innovation', 'Academics / Quiz & Olympiads']);
    loadSlotCount();
  }

  // ── Full Page HTML ────────────────────────────────────────────
  function buildHTML() {
    return `
<div class="form-topbar">
  <button class="btn-back" onclick="App.backToLanding()">&#8592; Back</button>
  <span class="topbar-title">School Submission</span>
  <button class="btn-signout-form" onclick="App.signOut()">Sign Out</button>
</div>

<header class="sf-header">
  <div class="sf-header-logos">
    <img src="assets/coat-of-arms.png" alt="Zambia Coat of Arms" class="sf-logo"
         onerror="this.classList.add('logo-missing')">
    <div class="sf-header-text">
      <p class="sf-h-title">JETS 2024&#8211;2026</p>
      <p class="sf-h-sub">School Submission Form</p>
      <p class="sf-h-district">Lavushimanda District &nbsp;|&nbsp; Muchinga Region</p>
    </div>
    <img src="assets/jets-logo.png" alt="JETS Logo" class="sf-logo"
         onerror="this.classList.add('logo-missing')">
  </div>
  <div class="sf-signedin-bar">
    Signed in as: &nbsp;<strong>${App.maskGmail(_auth.gmail)}</strong>
  </div>
</header>

<div class="sf-body">

  <div class="form-card">
    <div class="card-title">School Information</div>
    ${ir('Zone', _auth.zone)}
    ${ir('School Name', _auth.schoolName)}
    ${ir('School Type', _auth.schoolType)}
    ${ir('School JETS Organiser', _auth.organiserName)}
    ${ir('Phone', _auth.phone)}
    <p class="sf-wrong-details">Wrong details? Contact the District JETS Organiser.</p>
  </div>

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

  <div class="sf-tab-bar" id="sf-tab-bar">
    <button class="sf-tab-btn active" data-tab="learner">LEARNER</button>
    <button class="sf-tab-btn" data-tab="teacher">TEACHER</button>
    <button class="sf-tab-btn" data-tab="youth">YOUTH</button>
  </div>

  <!-- ── LEARNER TAB ── -->
  <div id="tab-learner" class="sf-tab-panel">
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
        <label for="l-grade">Grade / Form <span class="req">*</span></label>
        <input type="text" id="l-grade" placeholder="e.g. Grade 5, Form 2">
      </div>
      <div class="field">
        <label for="l-level">Level <span class="req">*</span></label>
        <select id="l-level">
          <option value="">&#8212; Select Level &#8212;</option>
          ${levelsFor(_auth.schoolType).map(l => `<option value="${l}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label>Participant Type <span class="req">*</span></label>
        <div class="radio-group" id="l-ptype-group"></div>
      </div>
      <div class="field hidden" id="l-cat-field">
        <label for="l-cat">Category <span class="req">*</span></label>
        <select id="l-cat"><option value="">&#8212; Select Category &#8212;</option></select>
      </div>
      <div class="field hidden" id="l-subskill-field">
        <label for="l-subskill">Sub-Skill <span class="req">*</span></label>
        <select id="l-subskill"><option value="">&#8212; Select Sub-Skill &#8212;</option></select>
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

  <!-- ── TEACHER TAB ── -->
  <div id="tab-teacher" class="sf-tab-panel hidden">
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

  <!-- ── OUT-OF-SCHOOL YOUTH TAB ── -->
  <div id="tab-youth" class="sf-tab-panel hidden">
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

  <!-- ── DECLARATION ── -->
  <div class="form-card">
    <div class="card-title">Declaration</div>
    <label class="decl-label">
      <input type="checkbox" id="sf-decl" class="decl-checkbox">
      <span class="decl-text">I confirm that the information provided is correct and the participant is eligible to participate in the Zone JETS Fair.</span>
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
  </div>

</div>`;
  }

  // ── Events ────────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('sf-tab-bar').addEventListener('click', e => {
      const btn = e.target.closest('.sf-tab-btn');
      if (btn) switchTab(btn.dataset.tab);
    });

    document.getElementById('sf-submit').addEventListener('click', handleSubmit);

    const page = document.getElementById(_pageId);
    page.addEventListener('change', e => {
      if (e.target.id === 'l-level')       onLevelChange();
      else if (e.target.name === 'l-ptype') onPtypeChange();
      else if (e.target.id === 'l-cat')    onCategoryChange();
      validateForm();
    });
    page.addEventListener('input', () => validateForm());
  }

  // ── Tab Switching ─────────────────────────────────────────────
  function switchTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('.sf-tab-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.tab === tab));
    ['learner', 'teacher', 'youth'].forEach(t =>
      document.getElementById('tab-' + t).classList.toggle('hidden', t !== tab));
    validateForm();
    window.scrollTo(0, 0);
  }

  // ── Learner Field Cascades ────────────────────────────────────
  function buildPtypeRadios(ptypes) {
    document.getElementById('l-ptype-group').innerHTML = ptypes.map(p =>
      `<label class="radio-opt"><input type="radio" name="l-ptype" value="${p}"> <span>${p}</span></label>`
    ).join('');
  }

  function onLevelChange() {
    const level = v('l-level');
    buildPtypeRadios(ptypesFor(level));
    // clear cascade
    document.getElementById('l-cat').innerHTML     = '<option value="">&#8212; Select Category &#8212;</option>';
    document.getElementById('l-subskill').innerHTML = '<option value="">&#8212; Select Sub-Skill &#8212;</option>';
    hide('l-cat-field'); hide('l-subskill-field'); hide('l-title-field'); hide('l-report-field');
  }

  function onPtypeChange() {
    const ptype = rval('l-ptype');
    const level = v('l-level');
    const cats  = catsFor(ptype, level);
    const sel   = document.getElementById('l-cat');
    sel.innerHTML = '<option value="">&#8212; Select Category &#8212;</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');
    cats.length ? show('l-cat-field') : hide('l-cat-field');
    document.getElementById('l-subskill').innerHTML = '<option value="">&#8212; Select Sub-Skill &#8212;</option>';
    hide('l-subskill-field'); hide('l-title-field'); hide('l-report-field');
  }

  function onCategoryChange() {
    const ptype = rval('l-ptype');
    const cat   = v('l-cat');
    if (ptype === 'Technical Skills' && cat) {
      const subs = (SKILLS[cat] && SKILLS[cat].subSkills) ? SKILLS[cat].subSkills : [];
      document.getElementById('l-subskill').innerHTML =
        '<option value="">&#8212; Select Sub-Skill &#8212;</option>' +
        subs.map(s => `<option value="${s}">${s}</option>`).join('');
      show('l-subskill-field');
    } else {
      hide('l-subskill-field');
    }
    const needsDoc = ptype === 'Learner Innovation' ||
                     (ptype === 'Technical Skills' && cat === 'Cosmetology');
    needsDoc ? show('l-title-field')  : hide('l-title-field');
    needsDoc ? show('l-report-field') : hide('l-report-field');
  }

  // ── Validation ────────────────────────────────────────────────
  function validateForm() {
    const btn = document.getElementById('sf-submit');
    if (btn) btn.disabled = !isValid();
  }

  function isValid() {
    if (!document.getElementById('sf-decl').checked) return false;
    if (_activeTab === 'learner') return learnerValid();
    if (_activeTab === 'teacher') return teacherValid();
    if (_activeTab === 'youth')   return youthValid();
    return false;
  }

  function learnerValid() {
    return filled('l-name') && filled('l-age') && rval('l-sex') &&
           filled('l-grade') && v('l-level') && rval('l-ptype') &&
           (!vis('l-cat-field')      || v('l-cat'))       &&
           (!vis('l-subskill-field') || v('l-subskill'))  &&
           (!vis('l-title-field')    || filled('l-title')) &&
           (!vis('l-report-field')   || hasFile('l-report')) &&
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
        body: JSON.stringify({ action: 'submitSchool', ...payload }),
      });
      if (!res.ok) throw new Error('Server error (' + res.status + ').');
      const data = await res.json();
      if (data.status !== 'ok') throw new Error(data.message || 'Submission failed.');

      const waText = encodeURIComponent(
        `JETS 2024-2026 Submission Confirmed\n` +
        `Zone: ${_auth.zone}\n` +
        `School: ${_auth.schoolName}\n` +
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
      loadSlotCount();

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
    const base = {
      formType:      'school',
      gmail:         _auth.gmail,
      zone:          _auth.zone,
      schoolName:    _auth.schoolName,
      schoolType:    _auth.schoolType,
      organiserName: _auth.organiserName,
      phone:         _auth.phone,
      submittedBy:   _auth.organiserName,
      submittedDate: new Date().toISOString(),
    };
    if (_activeTab === 'learner') return { ...base,
      participantType:    'Learner',
      learnerSubType:     rval('l-ptype'),
      fullName:           v('l-name'),
      age:                v('l-age'),
      sex:                rval('l-sex'),
      gradeForm:          v('l-grade'),
      level:              v('l-level'),
      category:           v('l-cat'),
      subSkill:           v('l-subskill'),
      titleOfInnovation:  v('l-title'),
      supervisingTeacher: v('l-teacher'),
    };
    if (_activeTab === 'teacher') return { ...base,
      participantType:   'Teacher',
      fullName:          v('t-name'),
      sex:               rval('t-sex'),
      category:          v('t-cat'),
      titleOfInnovation: v('t-title'),
    };
    return { ...base,
      participantType:   'Out-of-School Youth',
      fullName:          v('y-name'),
      age:               v('y-age'),
      sex:               rval('y-sex'),
      category:          v('y-cat'),
      titleOfInnovation: v('y-title'),
      mentor:            v('y-mentor'),
    };
  }

  // ── Slot Counter ──────────────────────────────────────────────
  async function loadSlotCount() {
    try {
      const res = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'getCount', gmail: _auth.gmail, schoolName: _auth.schoolName }),
      });
      const data = await res.json();
      if (typeof data.count === 'number') updateSlot(data.count);
    } catch (_) {
      const el = document.getElementById('sf-slot-display');
      if (el) el.textContent = '&#8212; of ' + _slotTotal;
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

  // ── DOM Helpers ───────────────────────────────────────────────
  function v(id)      { const e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function rval(nm)   { const e = document.querySelector(`input[name="${nm}"]:checked`); return e ? e.value : ''; }
  function filled(id) { return v(id).length > 0; }
  function hasFile(id){ const e = document.getElementById(id); return e && e.files && e.files.length > 0; }
  function vis(id)    { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); }
  function show(id)   { const e = document.getElementById(id); if (e) e.classList.remove('hidden'); }
  function hide(id)   { const e = document.getElementById(id); if (e) e.classList.add('hidden'); }
  function ir(lbl, val) {
    return `<div class="info-row"><span class="info-label">${lbl}</span><span class="info-value">${val || '&#8212;'}</span></div>`;
  }

  // ── Data Helpers ──────────────────────────────────────────────
  function levelsFor(type) { return LEVELS_BY_SCHOOL_TYPE[type] || []; }

  function ptypesFor(level) {
    const base = ['Learner Innovation', 'Academics / Quiz & Olympiads'];
    if (level === 'Junior Secondary (Form 1-2)' || level === 'Senior Secondary (Grade 10-12)') {
      base.push('Technical Skills');
    }
    return base;
  }

  function catsFor(ptype, level) {
    if (ptype === 'Learner Innovation')          return INNOVATION_CATEGORIES;
    if (ptype === 'Academics / Quiz & Olympiads') return ACADEMICS_BY_LEVEL[level] || [];
    if (ptype === 'Technical Skills')            return Object.keys(SKILLS);
    return [];
  }

  function activeFileInput() {
    if (_activeTab === 'learner' && vis('l-report-field')) return document.getElementById('l-report');
    if (_activeTab === 'teacher') return document.getElementById('t-report');
    if (_activeTab === 'youth')   return document.getElementById('y-report');
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
