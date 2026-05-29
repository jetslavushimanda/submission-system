let _zoneUser = null;
const _zoneCache = {};   // key -> { data, ts }
const CACHE_TTL = 5 * 60 * 1000;

// ── Cache helpers ─────────────────────────────────────────────
function cacheGet(key) {
  const c = _zoneCache[key];
  if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
  return null;
}
function cacheSet(key, data) { _zoneCache[key] = { data, ts: Date.now() }; }

// ── Navigation ────────────────────────────────────────────────
function zShowMain() {
  document.getElementById('zoneMain').style.display = '';
  document.querySelectorAll('#page-zone .sub-screen').forEach(s => s.classList.remove('active'));
}
function zShowScreen(id) {
  document.getElementById('zoneMain').style.display = 'none';
  document.querySelectorAll('#page-zone .sub-screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ── Drawer helpers ────────────────────────────────────────────
function openDrawer(overlayId) {
  document.getElementById(overlayId).classList.add('open');
}
function closeDrawer(overlayId) {
  document.getElementById(overlayId).classList.remove('open');
}

// ── Selected badge ────────────────────────────────────────────
let _selectedDocs = [];   // all submissions in zone with selectedForDistrict status

function updateBadge() {
  const count = _selectedDocs.filter(d => d.selectedForDistrict).length;
  document.getElementById('zSelectedBadge').textContent = count + '/64';
}

// ── Optimistic select/deselect ────────────────────────────────
async function zSelect(docId, cardEl, btnEl) {
  // optimistic UI
  const doc = _selectedDocs.find(d => d.id === docId);
  if (doc) doc.selectedForDistrict = true;
  cardEl.classList.add('selected');
  btnEl.textContent = 'DESELECT';
  btnEl.className = 'btn-desel';
  updateBadge();
  try {
    await db.collection('submissions').doc(docId).update({
      selectedForDistrict: true,
      selectedBy: _zoneUser.organiser,
      selectedAt: new Date().toISOString()
    });
  } catch {
    // revert
    if (doc) doc.selectedForDistrict = false;
    cardEl.classList.remove('selected');
    btnEl.textContent = 'SELECT';
    btnEl.className = 'btn-sel';
    updateBadge();
    showToast('Failed. Try again.', 'error');
  }
}

async function zDeselect(docId, cardEl, btnEl) {
  const doc = _selectedDocs.find(d => d.id === docId);
  if (doc) doc.selectedForDistrict = false;
  cardEl.classList.remove('selected');
  btnEl.textContent = 'SELECT';
  btnEl.className = 'btn-sel';
  updateBadge();
  try {
    await db.collection('submissions').doc(docId).update({
      selectedForDistrict: false,
      selectedBy: null,
      selectedAt: null
    });
  } catch {
    if (doc) doc.selectedForDistrict = true;
    cardEl.classList.add('selected');
    btnEl.textContent = 'DESELECT';
    btnEl.className = 'btn-desel';
    updateBadge();
    showToast('Failed. Try again.', 'error');
  }
}

// ── Slot limit check ──────────────────────────────────────────
function slotFilled(docs, slotKey) {
  return docs.filter(d => d.selectedForDistrict && d._slotKey === slotKey).length > 0;
}

// ── Render participant card ───────────────────────────────────
function renderCard(d, slotKey, groupDocs) {
  const isSel = d.selectedForDistrict;
  const filled = groupDocs.filter(x => x.selectedForDistrict && x._slotKey === slotKey && x.id !== d.id).length > 0;
  const date = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';

  const card = document.createElement('div');
  card.className = 'p-card' + (isSel ? ' selected' : '');
  card.dataset.id = d.id;

  let infoHtml = `<div class="p-card-info">
    <p><strong>School:</strong> ${d.school || '—'}</p>
    <p><strong>Name:</strong> ${d.fullName || '—'}</p>`;
  if (d.grade)    infoHtml += `<p><strong>Grade:</strong> ${d.grade}</p>`;
  if (d.level && !d.grade) infoHtml += `<p><strong>Level:</strong> ${d.level}</p>`;
  if (d.subject)  infoHtml += `<p><strong>Subject:</strong> ${d.subject}</p>`;
  if (d.subSkill) infoHtml += `<p><strong>Sub-Skill:</strong> ${d.subSkill}</p>`;
  if (d.innovationTitle) infoHtml += `<p><strong>Title:</strong> ${d.innovationTitle}</p>`;
  if (d.mentorName)      infoHtml += `<p><strong>Mentor:</strong> ${d.mentorName}</p>`;
  infoHtml += `<p><strong>Ref:</strong> ${d.refNumber || '—'} &nbsp;·&nbsp; ${date}</p>`;
  infoHtml += `</div>`;

  const disabled = !isSel && filled ? ' disabled' : '';
  const btnClass = isSel ? 'btn-desel' : 'btn-sel';
  const btnText  = isSel ? 'DESELECT'  : 'SELECT';
  const actionHtml = `<div class="p-card-actions">
    <button class="${btnClass}"${disabled}>${btnText}</button>
  </div>`;

  card.innerHTML = infoHtml + actionHtml;

  const btn = card.querySelector('button');
  if (!disabled) {
    btn.addEventListener('click', () => {
      if (d.selectedForDistrict) {
        zDeselect(d.id, card, btn);
      } else {
        // re-check live slot state
        const nowFilled = groupDocs.filter(x => x.selectedForDistrict && x._slotKey === slotKey && x.id !== d.id).length > 0;
        if (nowFilled) {
          // find who filled it
          const filler = groupDocs.find(x => x.selectedForDistrict && x._slotKey === slotKey && x.id !== d.id);
          showToast('Slot filled. Deselect ' + (filler ? filler.fullName : 'current selection') + ' first.', 'error');
          btn.disabled = true;
          return;
        }
        zSelect(d.id, card, btn);
      }
    });
  }

  return card;
}

// ── Render a grouped innovation section ───────────────────────
function renderInnovationSection(container, docs, level) {
  const byCategory = {};
  INNOVATION_CATEGORIES.forEach(cat => { byCategory[cat] = []; });
  docs.forEach(d => {
    if (byCategory[d.category]) byCategory[d.category].push(d);
    else if (d.category) {
      byCategory[d.category] = byCategory[d.category] || [];
      byCategory[d.category].push(d);
    }
  });

  let html = '';
  let hasAny = false;
  const frag = document.createDocumentFragment();

  INNOVATION_CATEGORIES.forEach(cat => {
    const group = byCategory[cat] || [];
    const slotKey = level + '|' + cat;
    group.forEach(d => { d._slotKey = slotKey; });
    const selCount = group.filter(d => d.selectedForDistrict).length;

    const hdr = document.createElement('div');
    hdr.className = 'cat-hdr';
    hdr.innerHTML = `<h3>${cat}</h3><span>Available: ${group.length} | Selected: ${selCount}/1</span>`;
    frag.appendChild(hdr);

    if (group.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-msg';
      empty.style.padding = '8px 0';
      empty.textContent = 'No submissions in this category.';
      frag.appendChild(empty);
    } else {
      hasAny = true;
      group.forEach(d => frag.appendChild(renderCard(d, slotKey, group)));
    }
  });

  container.innerHTML = '';
  container.appendChild(frag);
}

// ── Load a section with cache ─────────────────────────────────
async function zLoadSection(cacheKey, query, renderFn, contentEl) {
  const cached = cacheGet(cacheKey);
  if (cached) { renderFn(cached); return; }
  contentEl.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await query.get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // merge with _selectedDocs to keep selection state in sync
    docs.forEach(d => {
      const existing = _selectedDocs.find(x => x.id === d.id);
      if (existing) {
        d.selectedForDistrict = existing.selectedForDistrict;
      } else {
        _selectedDocs.push(d);
      }
    });
    cacheSet(cacheKey, docs);
    renderFn(docs);
  } catch (err) {
    contentEl.innerHTML = `<div class="empty-msg">Failed to load. <button class="btn-retry" onclick="zRetry('${cacheKey}')">Retry</button></div>`;
  }
}

// ── Innovations sections ──────────────────────────────────────
async function zLoadEce() {
  const el = document.getElementById('zEceContent');
  const key = 'ece|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Innovations')
      .where('subTab', '==', 'Learner')
      .where('level', '==', 'ECE & Primary'),
    docs => renderInnovationSection(el, docs, 'ECE & Primary'),
    el
  );
}

async function zLoadJunior() {
  const el = document.getElementById('zJuniorContent');
  const key = 'junior|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Innovations')
      .where('subTab', '==', 'Learner')
      .where('level', '==', 'Junior Secondary'),
    docs => renderInnovationSection(el, docs, 'Junior Secondary'),
    el
  );
}

async function zLoadSenior() {
  const el = document.getElementById('zSeniorContent');
  const key = 'senior|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Innovations')
      .where('subTab', '==', 'Learner')
      .where('level', '==', 'Senior Secondary'),
    docs => renderInnovationSection(el, docs, 'Senior Secondary'),
    el
  );
}

// ── Teacher ───────────────────────────────────────────────────
async function zLoadTeacher() {
  const el = document.getElementById('zTeacherContent');
  const key = 'teacher|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Innovations')
      .where('subTab', '==', 'Teacher'),
    docs => {
      if (!docs.length) {
        el.innerHTML = '<div class="empty-msg">No teacher submissions yet.<br><button class="btn-retry" onclick="zLoadTeacher()">Refresh</button></div>';
        return;
      }
      const byCategory = {};
      docs.forEach(d => {
        const k = d.category || 'Uncategorised';
        if (!byCategory[k]) byCategory[k] = [];
        d._slotKey = 'Teacher|' + k;
        byCategory[k].push(d);
      });
      el.innerHTML = '';
      INNOVATION_CATEGORIES.forEach(cat => {
        const group = byCategory[cat] || [];
        const selCount = group.filter(d => d.selectedForDistrict).length;
        const hdr = document.createElement('div');
        hdr.className = 'cat-hdr';
        hdr.innerHTML = `<h3>${cat}</h3><span>Available: ${group.length} | Selected: ${selCount}/1</span>`;
        el.appendChild(hdr);
        if (!group.length) {
          const e = document.createElement('div');
          e.className = 'empty-msg'; e.style.padding = '8px 0';
          e.textContent = 'No submissions.';
          el.appendChild(e);
        } else {
          group.forEach(d => el.appendChild(renderCard(d, d._slotKey, group)));
        }
      });
    },
    el
  );
}

// ── Youth ─────────────────────────────────────────────────────
async function zLoadYouth() {
  const el = document.getElementById('zYouthContent');
  const key = 'youth|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Innovations')
      .where('subTab', '==', 'Youth'),
    docs => {
      if (!docs.length) {
        el.innerHTML = '<div class="empty-msg">No youth submissions yet.<br><button class="btn-retry" onclick="zLoadYouth()">Refresh</button></div>';
        return;
      }
      const byCategory = {};
      docs.forEach(d => {
        const k = d.category || 'Uncategorised';
        if (!byCategory[k]) byCategory[k] = [];
        d._slotKey = 'Youth|' + k;
        byCategory[k].push(d);
      });
      el.innerHTML = '';
      INNOVATION_CATEGORIES.forEach(cat => {
        const group = byCategory[cat] || [];
        const selCount = group.filter(d => d.selectedForDistrict).length;
        const hdr = document.createElement('div');
        hdr.className = 'cat-hdr';
        hdr.innerHTML = `<h3>${cat}</h3><span>Available: ${group.length} | Selected: ${selCount}/1</span>`;
        el.appendChild(hdr);
        if (!group.length) {
          const e = document.createElement('div');
          e.className = 'empty-msg'; e.style.padding = '8px 0';
          e.textContent = 'No submissions.';
          el.appendChild(e);
        } else {
          group.forEach(d => el.appendChild(renderCard(d, d._slotKey, group)));
        }
      });
    },
    el
  );
}

// ── Academics ─────────────────────────────────────────────────
async function zLoadAcademics() {
  const el = document.getElementById('zAcademicsContent');
  const key = 'academics|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Academics'),
    docs => {
      if (!docs.length) {
        el.innerHTML = '<div class="empty-msg">No academic submissions yet.<br><button class="btn-retry" onclick="zLoadAcademics()">Refresh</button></div>';
        return;
      }
      // Sections: ECE Math/Sci/CTS, Junior Phys/Bio, Senior Phys/Bio
      const sections = [
        { label: 'ECE Mathematics',           level: 'ECE & Primary',    subject: 'Mathematics' },
        { label: 'ECE Science',               level: 'ECE & Primary',    subject: 'Science' },
        { label: 'ECE CTS',                   level: 'ECE & Primary',    subject: 'CTS' },
        { label: 'Junior Physics/Mathematics',level: 'Junior Secondary', subject: 'Physics/Mathematics' },
        { label: 'Junior Biology/Chemistry',  level: 'Junior Secondary', subject: 'Biology/Chemistry' },
        { label: 'Senior Physics/Mathematics',level: 'Senior Secondary', subject: 'Physics/Mathematics' },
        { label: 'Senior Biology/Chemistry',  level: 'Senior Secondary', subject: 'Biology/Chemistry' }
      ];

      el.innerHTML = '';
      sections.forEach(sec => {
        const group = docs.filter(d =>
          (d.level === sec.level || d.level === sec.level) &&
          (d.subject === sec.subject || d.category === sec.subject)
        );
        const slotKey = 'Acad|' + sec.label;
        group.forEach(d => { d._slotKey = slotKey; });
        const selCount = group.filter(d => d.selectedForDistrict).length;

        const hdr = document.createElement('div');
        hdr.className = 'cat-hdr';
        hdr.innerHTML = `<h3>${sec.label}</h3><span>Available: ${group.length} | Selected: ${selCount}/1</span>`;
        el.appendChild(hdr);

        if (!group.length) {
          const e = document.createElement('div');
          e.className = 'empty-msg'; e.style.padding = '8px 0';
          e.textContent = 'No submissions.';
          el.appendChild(e);
        } else {
          group.forEach(d => el.appendChild(renderCard(d, slotKey, group)));
        }
      });
    },
    el
  );
}

// ── Skills ────────────────────────────────────────────────────
async function zLoadSkills() {
  const el = document.getElementById('zSkillsContent');
  const key = 'skills|' + _zoneUser.zone;
  await zLoadSection(key,
    db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('tab', '==', 'Skills'),
    docs => {
      if (!docs.length) {
        el.innerHTML = '<div class="empty-msg">No skills submissions yet.<br><button class="btn-retry" onclick="zLoadSkills()">Refresh</button></div>';
        return;
      }
      el.innerHTML = '';
      Object.entries(SKILLS).forEach(([skillName, skillDef]) => {
        const group = docs.filter(d => d.category === skillName);
        const slotKey = 'Skill|' + skillName;
        group.forEach(d => { d._slotKey = slotKey; });
        const selCount = group.filter(d => d.selectedForDistrict).length;

        const hdr = document.createElement('div');
        hdr.className = 'cat-hdr';
        hdr.innerHTML = `<h3>${skillName}</h3><span>Available: ${group.length} | Selected: ${selCount}/${skillDef.max}</span>`;
        el.appendChild(hdr);

        if (!group.length) {
          const e = document.createElement('div');
          e.className = 'empty-msg'; e.style.padding = '8px 0';
          e.textContent = 'No submissions.';
          el.appendChild(e);
        } else {
          group.forEach(d => {
            // For skills, slot limit = max per category (not 1)
            const card = document.createElement('div');
            card.className = 'p-card' + (d.selectedForDistrict ? ' selected' : '');
            card.dataset.id = d.id;
            const date = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';
            const selInGroup = group.filter(x => x.selectedForDistrict && x.id !== d.id).length;
            const atMax = !d.selectedForDistrict && selInGroup >= skillDef.max;
            card.innerHTML = `<div class="p-card-info">
              <p><strong>School:</strong> ${d.school || '—'}</p>
              <p><strong>Name:</strong> ${d.fullName || '—'}</p>
              <p><strong>Grade:</strong> ${d.grade || '—'}</p>
              <p><strong>Sub-Skill:</strong> ${d.subSkill || '—'}</p>
              <p><strong>Ref:</strong> ${d.refNumber || '—'} &nbsp;·&nbsp; ${date}</p>
            </div>
            <div class="p-card-actions">
              <button class="${d.selectedForDistrict ? 'btn-desel' : 'btn-sel'}"${atMax ? ' disabled' : ''}>
                ${d.selectedForDistrict ? 'DESELECT' : 'SELECT'}
              </button>
            </div>`;
            const btn = card.querySelector('button');
            if (!atMax || d.selectedForDistrict) {
              btn.addEventListener('click', () => {
                if (d.selectedForDistrict) {
                  zDeselect(d.id, card, btn);
                } else {
                  const nowSel = group.filter(x => x.selectedForDistrict && x.id !== d.id).length;
                  if (nowSel >= skillDef.max) {
                    showToast(`Max ${skillDef.max} slots for ${skillName}. Deselect one first.`, 'error');
                    btn.disabled = true;
                    return;
                  }
                  zSelect(d.id, card, btn);
                }
              });
            }
            el.appendChild(card);
          });
        }
      });
    },
    el
  );
}

// ── Selected drawer ───────────────────────────────────────────
async function zOpenSelected() {
  openDrawer('zSelectedOverlay');
  const body = document.getElementById('zSelectedBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';

  try {
    const snap = await db.collection('submissions')
      .where('zone', '==', _zoneUser.zone)
      .where('selectedForDistrict', '==', true)
      .get();

    const selected = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total = selected.length;

    // Update live _selectedDocs from Firestore truth
    selected.forEach(d => {
      const ex = _selectedDocs.find(x => x.id === d.id);
      if (ex) ex.selectedForDistrict = true;
      else _selectedDocs.push({ ...d });
    });
    updateBadge();

    // Helper: find selected doc matching predicate
    const find = (pred) => selected.find(pred);

    let html = `<p style="font-size:14px;margin-bottom:8px;"><strong>${total} of 64 slots filled</strong></p>
    <div class="prog-bar"><div class="prog-fill" style="width:${(total/64*100).toFixed(1)}%"></div></div>`;
    body.innerHTML = html;

    // ECE Innovations
    const eceSection = document.createElement('div');
    eceSection.innerHTML = '<div class="sec-title">ECE & Primary Innovations (' +
      selected.filter(d => d.level === 'ECE & Primary' && d.tab === 'Innovations' && d.subTab === 'Learner').length +
      '/9)</div>';
    INNOVATION_CATEGORIES.forEach(cat => {
      const d = find(x => x.level === 'ECE & Primary' && x.tab === 'Innovations' && x.subTab === 'Learner' && x.category === cat);
      eceSection.appendChild(makeSlotRow(d, cat, 'ECE & Primary', 'Innovations', 'Learner', cat));
    });
    body.appendChild(eceSection);

    // Junior Innovations
    const jnrSection = document.createElement('div');
    jnrSection.innerHTML = '<div class="sec-title">Junior Secondary Innovations (' +
      selected.filter(d => d.level === 'Junior Secondary' && d.tab === 'Innovations' && d.subTab === 'Learner').length +
      '/9)</div>';
    INNOVATION_CATEGORIES.forEach(cat => {
      const d = find(x => x.level === 'Junior Secondary' && x.tab === 'Innovations' && x.subTab === 'Learner' && x.category === cat);
      jnrSection.appendChild(makeSlotRow(d, cat, 'Junior Secondary', 'Innovations', 'Learner', cat));
    });
    body.appendChild(jnrSection);

    // Senior Innovations
    const snrSection = document.createElement('div');
    snrSection.innerHTML = '<div class="sec-title">Senior Secondary Innovations (' +
      selected.filter(d => d.level === 'Senior Secondary' && d.tab === 'Innovations' && d.subTab === 'Learner').length +
      '/9)</div>';
    INNOVATION_CATEGORIES.forEach(cat => {
      const d = find(x => x.level === 'Senior Secondary' && x.tab === 'Innovations' && x.subTab === 'Learner' && x.category === cat);
      snrSection.appendChild(makeSlotRow(d, cat, 'Senior Secondary', 'Innovations', 'Learner', cat));
    });
    body.appendChild(snrSection);

    // Academics
    const acadSection = document.createElement('div');
    const acadSections = [
      { label: 'ECE Mathematics',            level: 'ECE & Primary',    subject: 'Mathematics' },
      { label: 'ECE Science',                level: 'ECE & Primary',    subject: 'Science' },
      { label: 'ECE CTS',                    level: 'ECE & Primary',    subject: 'CTS' },
      { label: 'Junior Physics/Mathematics', level: 'Junior Secondary', subject: 'Physics/Mathematics' },
      { label: 'Junior Biology/Chemistry',   level: 'Junior Secondary', subject: 'Biology/Chemistry' },
      { label: 'Senior Physics/Mathematics', level: 'Senior Secondary', subject: 'Physics/Mathematics' },
      { label: 'Senior Biology/Chemistry',   level: 'Senior Secondary', subject: 'Biology/Chemistry' }
    ];
    const acadCount = selected.filter(d => d.tab === 'Academics').length;
    acadSection.innerHTML = '<div class="sec-title">Academics (' + acadCount + '/7)</div>';
    acadSections.forEach(sec => {
      const d = find(x => x.tab === 'Academics' &&
        (x.level === sec.level) &&
        (x.subject === sec.subject || x.category === sec.subject));
      acadSection.appendChild(makeSlotRowAcad(d, sec.label));
    });
    body.appendChild(acadSection);

    // Skills
    const skillSection = document.createElement('div');
    const skillCount = selected.filter(d => d.tab === 'Skills').length;
    skillSection.innerHTML = '<div class="sec-title">Skills (' + skillCount + '/12)</div>';
    Object.entries(SKILLS).forEach(([skillName, skillDef]) => {
      const group = selected.filter(d => d.tab === 'Skills' && d.category === skillName);
      const sub = document.createElement('div');
      sub.innerHTML = '<div class="subsec-title">' + skillName + ' (' + group.length + '/' + skillDef.max + ')</div>';
      for (let i = 0; i < skillDef.max; i++) {
        const d = group[i];
        sub.appendChild(makeSlotRowSkill(d, skillName, i));
      }
      skillSection.appendChild(sub);
    });
    body.appendChild(skillSection);

    // Teachers
    const teachSection = document.createElement('div');
    const teachCount = selected.filter(d => d.tab === 'Innovations' && d.subTab === 'Teacher').length;
    teachSection.innerHTML = '<div class="sec-title">Teachers (' + teachCount + '/9)</div>';
    INNOVATION_CATEGORIES.forEach(cat => {
      const d = find(x => x.tab === 'Innovations' && x.subTab === 'Teacher' && x.category === cat);
      teachSection.appendChild(makeSlotRow(d, cat, null, 'Innovations', 'Teacher', cat));
    });
    body.appendChild(teachSection);

    // Youth
    const youthSection = document.createElement('div');
    const youthCount = selected.filter(d => d.tab === 'Innovations' && d.subTab === 'Youth').length;
    youthSection.innerHTML = '<div class="sec-title">Youth (' + youthCount + '/9)</div>';
    INNOVATION_CATEGORIES.forEach(cat => {
      const d = find(x => x.tab === 'Innovations' && x.subTab === 'Youth' && x.category === cat);
      youthSection.appendChild(makeSlotRow(d, cat, null, 'Innovations', 'Youth', cat));
    });
    body.appendChild(youthSection);

    // Total footer
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:16px;padding-top:12px;border-top:2px solid #eee;font-size:14px;font-weight:700;';
    footer.textContent = 'Total: ' + total + ' of 64';
    body.appendChild(footer);

    if (total >= 64) {
      showToast('All 64 slots filled!', 'success');
    }

  } catch (err) {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

function makeSlotRow(doc, label, level, tab, subTab, category) {
  const row = document.createElement('div');
  row.className = 'slot-row';
  if (doc) {
    row.innerHTML = `<span class="slot-icon">✓</span>
      <span class="slot-name">${doc.fullName}</span>
      <span class="slot-school">${doc.school}</span>
      <button class="btn-desel-sm" data-id="${doc.id}">Remove</button>`;
    row.querySelector('.btn-desel-sm').addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.target;
      btn.disabled = true;
      try {
        await db.collection('submissions').doc(doc.id).update({
          selectedForDistrict: false, selectedBy: null, selectedAt: null
        });
        const ex = _selectedDocs.find(x => x.id === doc.id);
        if (ex) ex.selectedForDistrict = false;
        updateBadge();
        row.className = 'slot-empty';
        row.innerHTML = `<span style="color:#bbb">○ ${label} — Empty</span>`;
        // invalidate cache
        Object.keys(_zoneCache).forEach(k => delete _zoneCache[k]);
      } catch {
        showToast('Failed. Try again.', 'error');
        btn.disabled = false;
      }
    });
  } else {
    row.className = 'slot-empty';
    row.innerHTML = `<span>○ ${label} — Empty</span>`;
  }
  return row;
}

function makeSlotRowAcad(doc, label) {
  return makeSlotRow(doc, label, null, null, null, null);
}

function makeSlotRowSkill(doc, skillName, idx) {
  const label = skillName + ' Slot ' + (idx + 1);
  return makeSlotRow(doc, label, null, null, null, null);
}

// ── Init ──────────────────────────────────────────────────────
function initZone(user) {
  _zoneUser = user;
  document.getElementById('zoneHeaderInfo').textContent = user.zone + ' Zone | ' + user.organiser;

  // Main grid
  document.getElementById('zBtnLearner').addEventListener('click', () => zShowScreen('zScreenLearner'));
  document.getElementById('zBtnTeacher').addEventListener('click', () => { zShowScreen('zScreenTeacher'); zLoadTeacher(); });
  document.getElementById('zBtnYouth').addEventListener('click', () => { zShowScreen('zScreenYouth'); zLoadYouth(); });
  document.getElementById('zBtnAcademics').addEventListener('click', () => { zShowScreen('zScreenAcademics'); zLoadAcademics(); });
  document.getElementById('zBtnSkills').addEventListener('click', () => { zShowScreen('zScreenSkills'); zLoadSkills(); });
  document.getElementById('zBtnSelected').addEventListener('click', zOpenSelected);

  // Learner sub-tabs
  document.getElementById('zBtnEce').addEventListener('click', () => { zShowScreen('zScreenEce'); zLoadEce(); });
  document.getElementById('zBtnJunior').addEventListener('click', () => { zShowScreen('zScreenJunior'); zLoadJunior(); });
  document.getElementById('zBtnSenior').addEventListener('click', () => { zShowScreen('zScreenSenior'); zLoadSenior(); });

  // Back buttons
  document.getElementById('zLearnerBack').addEventListener('click', zShowMain);
  document.getElementById('zEceBack').addEventListener('click', () => zShowScreen('zScreenLearner'));
  document.getElementById('zJuniorBack').addEventListener('click', () => zShowScreen('zScreenLearner'));
  document.getElementById('zSeniorBack').addEventListener('click', () => zShowScreen('zScreenLearner'));
  document.getElementById('zTeacherBack').addEventListener('click', zShowMain);
  document.getElementById('zYouthBack').addEventListener('click', zShowMain);
  document.getElementById('zAcademicsBack').addEventListener('click', zShowMain);
  document.getElementById('zSkillsBack').addEventListener('click', zShowMain);

  // Selected drawer close
  document.getElementById('zSelectedClose').addEventListener('click', () => closeDrawer('zSelectedOverlay'));
  document.getElementById('zSelectedOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('zSelectedOverlay')) closeDrawer('zSelectedOverlay');
  });

  // Load initial badge count
  db.collection('submissions')
    .where('zone', '==', user.zone)
    .where('selectedForDistrict', '==', true)
    .get()
    .then(snap => {
      _selectedDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateBadge();
    })
    .catch(() => {});
}
