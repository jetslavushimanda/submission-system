let _schoolUser = null;

// ── Navigation helpers ────────────────────────────────────────
function sShowMain() {
  document.getElementById('schoolMain').style.display = '';
  document.querySelectorAll('#page-school .sub-screen').forEach(s => s.classList.remove('active'));
}
function sShowScreen(id) {
  document.getElementById('schoolMain').style.display = 'none';
  document.querySelectorAll('#page-school .sub-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── Validation ────────────────────────────────────────────────
function sValidate(fields) {
  let ok = true;
  let first = null;
  fields.forEach(({ el, errEl, check }) => {
    const valid = check ? check(el) : el.value.trim() !== '';
    if (!valid) {
      el.classList.add('err');
      errEl.classList.add('show');
      if (!first) first = el;
      ok = false;
    } else {
      el.classList.remove('err');
      errEl.classList.remove('show');
    }
  });
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return ok;
}

function sValidateCheckbox(cb, errEl, row) {
  if (!cb.checked) {
    row.classList.add('err');
    errEl.classList.add('show');
    return false;
  }
  row.classList.remove('err');
  errEl.classList.remove('show');
  return true;
}

// ── Submit ────────────────────────────────────────────────────
async function submitParticipant(data, btn, successEl, anotherEl, formEl) {
  btn.disabled = true;
  btn.textContent = 'Submitting…';
  try {
    const ref = 'SCH-' + Date.now();
    await db.collection('submissions').add({
      timestamp: new Date().toISOString(),
      refNumber: ref,
      zone: _schoolUser.zone,
      school: _schoolUser.name,
      schoolType: _schoolUser.type,
      organiserName: _schoolUser.organiser,
      phone: _schoolUser.phone,
      tab: data.tab,
      subTab: data.subTab || '',
      level: data.level || '',
      grade: data.grade || '',
      fullName: data.fullName,
      age: data.age ? parseInt(data.age) : null,
      sex: data.sex || '',
      category: data.category || '',
      subSkill: data.subSkill || '',
      innovationTitle: data.innovationTitle || '',
      mentorName: data.mentorName || '',
      subject: data.subject || '',
      selectedForDistrict: false,
      selectedBy: null,
      selectedAt: null
    });
    successEl.textContent = 'Submitted! Ref: ' + ref;
    successEl.classList.add('show');
    anotherEl.classList.add('show');
    formEl.style.display = 'none';
  } catch (err) {
    showToast('Submission failed. Try again.', 'error');
    btn.disabled = false;
    btn.textContent = 'SUBMIT';
  }
}

function bindAnother(anotherEl, successEl, formEl, resetFn) {
  anotherEl.addEventListener('click', () => {
    successEl.classList.remove('show');
    anotherEl.classList.remove('show');
    formEl.style.display = '';
    resetFn();
  });
}

// ── ECE & Primary ─────────────────────────────────────────────
function sBindEce() {
  const btn = document.getElementById('sEceSubmit');
  const fields = [
    { el: document.getElementById('sEceName'),     errEl: document.getElementById('sEceNameErr') },
    { el: document.getElementById('sEceAge'),      errEl: document.getElementById('sEceAgeErr') },
    { el: document.getElementById('sEceSex'),      errEl: document.getElementById('sEceSexErr') },
    { el: document.getElementById('sEceGrade'),    errEl: document.getElementById('sEceGradeErr') },
    { el: document.getElementById('sEceCategory'), errEl: document.getElementById('sEceCategoryErr') },
    { el: document.getElementById('sEceTitle'),    errEl: document.getElementById('sEceTitleErr') }
  ];
  const cb    = document.getElementById('sEceDecl');
  const cbErr = document.getElementById('sEceDeclErr');
  const cbRow = document.getElementById('sEceDeclRow');
  const succ  = document.getElementById('sEceSuccess');
  const anoth = document.getElementById('sEceAnother');
  const form  = document.getElementById('sEceForm');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Innovations', subTab: 'Learner', level: 'ECE & Primary',
      grade: document.getElementById('sEceGrade').value,
      fullName: document.getElementById('sEceName').value.trim(),
      age: document.getElementById('sEceAge').value,
      sex: document.getElementById('sEceSex').value,
      category: document.getElementById('sEceCategory').value,
      innovationTitle: document.getElementById('sEceTitle').value.trim()
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, reset);
}

// ── Junior Secondary ──────────────────────────────────────────
function sBindJunior() {
  const btn = document.getElementById('sJuniorSubmit');
  const fields = [
    { el: document.getElementById('sJuniorName'),     errEl: document.getElementById('sJuniorNameErr') },
    { el: document.getElementById('sJuniorAge'),      errEl: document.getElementById('sJuniorAgeErr') },
    { el: document.getElementById('sJuniorSex'),      errEl: document.getElementById('sJuniorSexErr') },
    { el: document.getElementById('sJuniorGrade'),    errEl: document.getElementById('sJuniorGradeErr') },
    { el: document.getElementById('sJuniorCategory'), errEl: document.getElementById('sJuniorCategoryErr') },
    { el: document.getElementById('sJuniorTitle'),    errEl: document.getElementById('sJuniorTitleErr') }
  ];
  const cb    = document.getElementById('sJuniorDecl');
  const cbErr = document.getElementById('sJuniorDeclErr');
  const cbRow = document.getElementById('sJuniorDeclRow');
  const succ  = document.getElementById('sJuniorSuccess');
  const anoth = document.getElementById('sJuniorAnother');
  const form  = document.getElementById('sJuniorForm');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Innovations', subTab: 'Learner', level: 'Junior Secondary',
      grade: document.getElementById('sJuniorGrade').value,
      fullName: document.getElementById('sJuniorName').value.trim(),
      age: document.getElementById('sJuniorAge').value,
      sex: document.getElementById('sJuniorSex').value,
      category: document.getElementById('sJuniorCategory').value,
      innovationTitle: document.getElementById('sJuniorTitle').value.trim()
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, reset);
}

// ── Senior Secondary ──────────────────────────────────────────
function sBindSenior() {
  const btn = document.getElementById('sSeniorSubmit');
  const fields = [
    { el: document.getElementById('sSeniorName'),     errEl: document.getElementById('sSeniorNameErr') },
    { el: document.getElementById('sSeniorAge'),      errEl: document.getElementById('sSeniorAgeErr') },
    { el: document.getElementById('sSeniorSex'),      errEl: document.getElementById('sSeniorSexErr') },
    { el: document.getElementById('sSeniorGrade'),    errEl: document.getElementById('sSeniorGradeErr') },
    { el: document.getElementById('sSeniorCategory'), errEl: document.getElementById('sSeniorCategoryErr') },
    { el: document.getElementById('sSeniorTitle'),    errEl: document.getElementById('sSeniorTitleErr') }
  ];
  const cb    = document.getElementById('sSeniorDecl');
  const cbErr = document.getElementById('sSeniorDeclErr');
  const cbRow = document.getElementById('sSeniorDeclRow');
  const succ  = document.getElementById('sSeniorSuccess');
  const anoth = document.getElementById('sSeniorAnother');
  const form  = document.getElementById('sSeniorForm');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Innovations', subTab: 'Learner', level: 'Senior Secondary',
      grade: document.getElementById('sSeniorGrade').value,
      fullName: document.getElementById('sSeniorName').value.trim(),
      age: document.getElementById('sSeniorAge').value,
      sex: document.getElementById('sSeniorSex').value,
      category: document.getElementById('sSeniorCategory').value,
      innovationTitle: document.getElementById('sSeniorTitle').value.trim()
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, reset);
}

// ── Teacher ───────────────────────────────────────────────────
function sBindTeacher() {
  const btn = document.getElementById('sTeacherSubmit');
  const fields = [
    { el: document.getElementById('sTeacherName'),     errEl: document.getElementById('sTeacherNameErr') },
    { el: document.getElementById('sTeacherSex'),      errEl: document.getElementById('sTeacherSexErr') },
    { el: document.getElementById('sTeacherCategory'), errEl: document.getElementById('sTeacherCategoryErr') },
    { el: document.getElementById('sTeacherTitle'),    errEl: document.getElementById('sTeacherTitleErr') }
  ];
  const cb    = document.getElementById('sTeacherDecl');
  const cbErr = document.getElementById('sTeacherDeclErr');
  const cbRow = document.getElementById('sTeacherDeclRow');
  const succ  = document.getElementById('sTeacherSuccess');
  const anoth = document.getElementById('sTeacherAnother');
  const form  = document.getElementById('sTeacherForm');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Innovations', subTab: 'Teacher',
      fullName: document.getElementById('sTeacherName').value.trim(),
      sex: document.getElementById('sTeacherSex').value,
      category: document.getElementById('sTeacherCategory').value,
      innovationTitle: document.getElementById('sTeacherTitle').value.trim()
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, reset);
}

// ── Youth ─────────────────────────────────────────────────────
function sBindYouth() {
  const btn = document.getElementById('sYouthSubmit');
  const fields = [
    { el: document.getElementById('sYouthName'),     errEl: document.getElementById('sYouthNameErr') },
    { el: document.getElementById('sYouthAge'),      errEl: document.getElementById('sYouthAgeErr') },
    { el: document.getElementById('sYouthSex'),      errEl: document.getElementById('sYouthSexErr') },
    { el: document.getElementById('sYouthCategory'), errEl: document.getElementById('sYouthCategoryErr') },
    { el: document.getElementById('sYouthTitle'),    errEl: document.getElementById('sYouthTitleErr') },
    { el: document.getElementById('sYouthMentor'),   errEl: document.getElementById('sYouthMentorErr') }
  ];
  const cb    = document.getElementById('sYouthDecl');
  const cbErr = document.getElementById('sYouthDeclErr');
  const cbRow = document.getElementById('sYouthDeclRow');
  const succ  = document.getElementById('sYouthSuccess');
  const anoth = document.getElementById('sYouthAnother');
  const form  = document.getElementById('sYouthForm');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Innovations', subTab: 'Youth',
      fullName: document.getElementById('sYouthName').value.trim(),
      age: document.getElementById('sYouthAge').value,
      sex: document.getElementById('sYouthSex').value,
      category: document.getElementById('sYouthCategory').value,
      innovationTitle: document.getElementById('sYouthTitle').value.trim(),
      mentorName: document.getElementById('sYouthMentor').value.trim()
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, reset);
}

// ── Academics ─────────────────────────────────────────────────
function sBindAcademics() {
  const levelSel   = document.getElementById('sAcadLevel');
  const gradeSel   = document.getElementById('sAcadGrade');
  const subjectSel = document.getElementById('sAcadSubject');
  const btn = document.getElementById('sAcadSubmit');
  const succ  = document.getElementById('sAcademicsSuccess');
  const anoth = document.getElementById('sAcademicsAnother');
  const form  = document.getElementById('sAcademicsForm');

  // Populate level options from school type
  function populateLevels() {
    const levels = LEVELS_BY_TYPE[_schoolUser.type] || [];
    levelSel.innerHTML = '<option value="">— Select —</option>' +
      levels.map(l => `<option>${l}</option>`).join('');
    gradeSel.innerHTML = '<option value="">— Select —</option>';
    subjectSel.innerHTML = '<option value="">— Select Level first —</option>';
  }

  levelSel.addEventListener('change', () => {
    const lv = levelSel.value;
    const grades = GRADES_BY_LEVEL[lv] || [];
    gradeSel.innerHTML = '<option value="">— Select —</option>' +
      grades.map(g => `<option>${g}</option>`).join('');
    const subjects = ACADEMICS_BY_LEVEL[lv] || [];
    subjectSel.innerHTML = '<option value="">— Select —</option>' +
      subjects.map(s => `<option>${s}</option>`).join('');
  });

  const fields = [
    { el: document.getElementById('sAcadName'),    errEl: document.getElementById('sAcadNameErr') },
    { el: document.getElementById('sAcadAge'),     errEl: document.getElementById('sAcadAgeErr') },
    { el: document.getElementById('sAcadSex'),     errEl: document.getElementById('sAcadSexErr') },
    { el: levelSel,   errEl: document.getElementById('sAcadLevelErr') },
    { el: gradeSel,   errEl: document.getElementById('sAcadGradeErr') },
    { el: subjectSel, errEl: document.getElementById('sAcadSubjectErr') }
  ];
  const cb    = document.getElementById('sAcadDecl');
  const cbErr = document.getElementById('sAcadDeclErr');
  const cbRow = document.getElementById('sAcadDeclRow');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    gradeSel.innerHTML = '<option value="">— Select —</option>';
    subjectSel.innerHTML = '<option value="">— Select Level first —</option>';
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Academics', subTab: '',
      level: levelSel.value,
      grade: gradeSel.value,
      fullName: document.getElementById('sAcadName').value.trim(),
      age: document.getElementById('sAcadAge').value,
      sex: document.getElementById('sAcadSex').value,
      subject: subjectSel.value,
      category: subjectSel.value
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, () => { populateLevels(); reset(); });

  // expose so initSchool can call it
  populateLevels._bound = true;
  return populateLevels;
}

// ── Skills ────────────────────────────────────────────────────
function sBindSkills() {
  const levelSel    = document.getElementById('sSkillLevel');
  const gradeSel    = document.getElementById('sSkillGrade');
  const categorySel = document.getElementById('sSkillCategory');
  const subSkillSel = document.getElementById('sSkillSubSkill');
  const btn  = document.getElementById('sSkillSubmit');
  const succ  = document.getElementById('sSkillsSuccess');
  const anoth = document.getElementById('sSkillsAnother');
  const form  = document.getElementById('sSkillsForm');

  levelSel.addEventListener('change', () => {
    const lv = levelSel.value;
    const grades = GRADES_BY_LEVEL[lv] || [];
    gradeSel.innerHTML = '<option value="">— Select —</option>' +
      grades.map(g => `<option>${g}</option>`).join('');
  });

  categorySel.addEventListener('change', () => {
    const cat = SKILLS[categorySel.value];
    subSkillSel.innerHTML = '<option value="">— Select —</option>' +
      (cat ? cat.subSkills.map(s => `<option>${s}</option>`).join('') : '');
  });

  const fields = [
    { el: document.getElementById('sSkillName'),    errEl: document.getElementById('sSkillNameErr') },
    { el: document.getElementById('sSkillAge'),     errEl: document.getElementById('sSkillAgeErr') },
    { el: document.getElementById('sSkillSex'),     errEl: document.getElementById('sSkillSexErr') },
    { el: levelSel,    errEl: document.getElementById('sSkillLevelErr') },
    { el: gradeSel,    errEl: document.getElementById('sSkillGradeErr') },
    { el: categorySel, errEl: document.getElementById('sSkillCategoryErr') },
    { el: subSkillSel, errEl: document.getElementById('sSkillSubSkillErr') }
  ];
  const cb    = document.getElementById('sSkillDecl');
  const cbErr = document.getElementById('sSkillDeclErr');
  const cbRow = document.getElementById('sSkillDeclRow');

  const reset = () => {
    fields.forEach(f => { f.el.value = ''; f.el.classList.remove('err'); f.errEl.classList.remove('show'); });
    cb.checked = false; cbRow.classList.remove('err'); cbErr.classList.remove('show');
    gradeSel.innerHTML = '<option value="">— Select —</option>';
    subSkillSel.innerHTML = '<option value="">— Select Category first —</option>';
    btn.disabled = false; btn.textContent = 'SUBMIT';
  };

  btn.addEventListener('click', () => {
    if (!sValidate(fields)) return;
    if (!sValidateCheckbox(cb, cbErr, cbRow)) return;
    submitParticipant({
      tab: 'Skills', subTab: '',
      level: levelSel.value,
      grade: gradeSel.value,
      fullName: document.getElementById('sSkillName').value.trim(),
      age: document.getElementById('sSkillAge').value,
      sex: document.getElementById('sSkillSex').value,
      category: categorySel.value,
      subSkill: subSkillSel.value
    }, btn, succ, anoth, form);
  });

  bindAnother(anoth, succ, form, reset);
}

// ── My Submissions ────────────────────────────────────────────
async function loadMySubs() {
  const el = document.getElementById('sMySubsContent');
  el.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await db.collection('submissions')
      .where('school', '==', _schoolUser.name)
      .orderBy('timestamp', 'desc')
      .get();
    if (snap.empty) {
      el.innerHTML = '<div class="empty-msg">No submissions yet.</div>';
      return;
    }
    let html = '<div class="subs-list">';
    snap.docs.forEach(doc => {
      const d = doc.data();
      const date = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';
      html += `<div class="sub-card">
        <div class="sub-card-name">${d.fullName || '—'}</div>
        <div class="sub-card-meta">${d.tab} · ${d.level || d.subTab || ''} · ${d.category || d.subject || ''}</div>
        <div class="sub-card-ref">Ref: ${d.refNumber} &nbsp;·&nbsp; ${date}</div>
      </div>`;
    });
    html += '</div>';
    el.innerHTML = html;
  } catch {
    el.innerHTML = '<div class="empty-msg">Failed to load. Check connection.</div>';
  }
}

// ── Init ──────────────────────────────────────────────────────
function initSchool(user) {
  _schoolUser = user;
  document.getElementById('schoolHeaderInfo').textContent = user.name + ' | ' + user.zone + ' Zone';

  // Bind forms
  sBindEce();
  sBindJunior();
  sBindSenior();
  sBindTeacher();
  sBindYouth();
  const populateLevels = sBindAcademics();
  sBindSkills();

  // Skills visibility
  const skillsNotice = document.getElementById('sSkillsNotice');
  const skillsForm   = document.getElementById('sSkillsForm');
  const skillsAnother = document.getElementById('sSkillsAnother');
  const skillsSuccess = document.getElementById('sSkillsSuccess');
  const hiddenTypes = ['Primary School', 'Community School'];
  const hideSkills = hiddenTypes.includes(user.type);

  // Main grid navigation
  document.getElementById('sBtnLearner').addEventListener('click', () => sShowScreen('sScreenLearner'));
  document.getElementById('sBtnTeacher').addEventListener('click', () => sShowScreen('sScreenTeacher'));
  document.getElementById('sBtnYouth').addEventListener('click', () => sShowScreen('sScreenYouth'));
  document.getElementById('sBtnAcademics').addEventListener('click', () => {
    populateLevels();
    sShowScreen('sScreenAcademics');
  });
  document.getElementById('sBtnSkills').addEventListener('click', () => {
    sShowScreen('sScreenSkills');
    if (hideSkills) {
      skillsNotice.style.display = '';
      skillsForm.style.display = 'none';
      skillsAnother.classList.remove('show');
      skillsSuccess.classList.remove('show');
    } else {
      skillsNotice.style.display = 'none';
      skillsForm.style.display = '';
    }
  });
  document.getElementById('sBtnMySubs').addEventListener('click', () => {
    sShowScreen('sScreenMySubs');
    loadMySubs();
  });

  // Learner sub-tabs
  document.getElementById('sBtnEce').addEventListener('click', () => sShowScreen('sScreenEce'));
  document.getElementById('sBtnJunior').addEventListener('click', () => {
    // Only show Junior if school type allows it
    const allowed = LEVELS_BY_TYPE[user.type] || [];
    if (!allowed.includes('Junior Secondary')) {
      showToast('Junior Secondary not available for this school type.', 'error');
      return;
    }
    sShowScreen('sScreenJunior');
  });
  document.getElementById('sBtnSenior').addEventListener('click', () => {
    const allowed = LEVELS_BY_TYPE[user.type] || [];
    if (!allowed.includes('Senior Secondary')) {
      showToast('Senior Secondary not available for this school type.', 'error');
      return;
    }
    sShowScreen('sScreenSenior');
  });

  // Back buttons
  document.getElementById('sLearnerBack').addEventListener('click', sShowMain);
  document.getElementById('sEceBack').addEventListener('click', () => sShowScreen('sScreenLearner'));
  document.getElementById('sJuniorBack').addEventListener('click', () => sShowScreen('sScreenLearner'));
  document.getElementById('sSeniorBack').addEventListener('click', () => sShowScreen('sScreenLearner'));
  document.getElementById('sTeacherBack').addEventListener('click', sShowMain);
  document.getElementById('sYouthBack').addEventListener('click', sShowMain);
  document.getElementById('sAcademicsBack').addEventListener('click', sShowMain);
  document.getElementById('sSkillsBack').addEventListener('click', sShowMain);
  document.getElementById('sMySubsBack').addEventListener('click', sShowMain);
}
