let _districtUser = null;

// ── Drawer helpers ────────────────────────────────────────────
function dOpen(overlayId) { document.getElementById(overlayId).classList.add('open'); }
function dClose(overlayId) { document.getElementById(overlayId).classList.remove('open'); }

function dBindClose(closeId, overlayId) {
  document.getElementById(closeId).addEventListener('click', () => dClose(overlayId));
  document.getElementById(overlayId).addEventListener('click', e => {
    if (e.target.id === overlayId) dClose(overlayId);
  });
}

// ── School Data ───────────────────────────────────────────────
async function dLoadSchools() {
  const body = document.getElementById('dSchoolsBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await db.collection('submissions').get();
    const allSubs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const submittedSchools = new Set(allSubs.map(d => d.school));

    body.innerHTML = '';
    Object.entries(ZONES).forEach(([zoneName, zoneData]) => {
      const title = document.createElement('div');
      title.className = 'sec-title';
      title.textContent = zoneName + ' Zone';
      body.appendChild(title);

      zoneData.schools.forEach(school => {
        const hasSubs = submittedSchools.has(school);
        const count = allSubs.filter(d => d.school === school).length;
        const item = document.createElement('div');
        item.className = 'school-item ' + (hasSubs ? 'has-subs' : 'no-subs');
        item.innerHTML = `<span class="school-item-name">${school}</span>
          <span class="school-item-count">${hasSubs ? count + ' submitted' : 'Not submitted'}</span>`;
        if (hasSubs) {
          item.style.cursor = 'pointer';
          item.addEventListener('click', () => dShowSchoolDetail(school, allSubs.filter(d => d.school === school)));
        }
        body.appendChild(item);
      });
    });
  } catch {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

function dShowSchoolDetail(school, docs) {
  document.getElementById('dSchoolDetailTitle').textContent = school;
  const body = document.getElementById('dSchoolDetailBody');
  if (!docs.length) {
    body.innerHTML = '<div class="empty-msg">No submissions.</div>';
  } else {
    let html = '<div>';
    docs.forEach(d => {
      const date = d.timestamp ? new Date(d.timestamp).toLocaleDateString() : '';
      html += `<div class="sub-card">
        <div class="sub-card-name">${d.fullName || '—'}</div>
        <div class="sub-card-meta">${d.tab} · ${d.level || d.subTab || ''} · ${d.category || d.subject || ''}</div>
        <div class="sub-card-ref">Ref: ${d.refNumber || '—'} · ${date}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
  }
  dOpen('dSchoolDetailOverlay');
}

// ── Zone Selections ───────────────────────────────────────────
async function dLoadZones() {
  const body = document.getElementById('dZonesBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await db.collection('submissions')
      .where('selectedForDistrict', '==', true)
      .get();
    const selected = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    body.innerHTML = '';
    Object.keys(ZONES).forEach(zoneName => {
      const zoneSel = selected.filter(d => d.zone === zoneName).length;
      const card = document.createElement('div');
      card.className = 'zone-card';
      card.innerHTML = `<div class="zone-card-top">
        <span>${zoneName} Zone</span>
        <span>${zoneSel}/64</span>
      </div>
      <div class="zone-card-sub">${zoneSel} of 64 selected</div>
      <div class="prog-bar"><div class="prog-fill" style="width:${(zoneSel/64*100).toFixed(1)}%"></div></div>`;
      card.addEventListener('click', () => dShowZoneDetail(zoneName, selected.filter(d => d.zone === zoneName)));
      body.appendChild(card);
    });
  } catch {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

function dShowZoneDetail(zoneName, docs) {
  document.getElementById('dZoneDetailTitle').textContent = zoneName + ' Zone — Selected';
  const body = document.getElementById('dZoneDetailBody');
  if (!docs.length) {
    body.innerHTML = '<div class="empty-msg">No selections yet for this zone.</div>';
  } else {
    let html = '<div>';
    docs.forEach(d => {
      html += `<div class="sub-card">
        <div class="sub-card-name">${d.fullName || '—'}</div>
        <div class="sub-card-meta">${d.tab} · ${d.level || d.subTab || ''} · ${d.category || d.subject || ''}</div>
        <div class="sub-card-ref">${d.school || '—'} · Ref: ${d.refNumber || '—'}</div>
      </div>`;
    });
    html += '</div>';
    body.innerHTML = html;
  }
  dOpen('dZoneDetailOverlay');
}

// ── By Category ───────────────────────────────────────────────
async function dLoadCategory() {
  const body = document.getElementById('dCategoryBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await db.collection('submissions')
      .where('tab', '==', 'Innovations')
      .where('subTab', '==', 'Learner')
      .get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const zones = Object.keys(ZONES);

    body.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'cov-scroll';

    const table = document.createElement('table');
    table.className = 'cov-table';
    table.innerHTML = `<thead><tr>
      <th>Category</th>
      ${zones.map(z => `<th>${z}</th>`).join('')}
    </tr></thead>`;

    const tbody = document.createElement('tbody');
    INNOVATION_CATEGORIES.forEach(cat => {
      const tr = document.createElement('tr');
      let cells = `<td>${cat}</td>`;
      zones.forEach(zone => {
        const has = docs.some(d => d.zone === zone && d.category === cat);
        cells += `<td class="${has ? 'cell-y' : 'cell-n'}">${has ? '✓' : '✗'}</td>`;
      });
      tr.innerHTML = cells;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    scroll.appendChild(table);
    body.appendChild(scroll);
  } catch {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

// ── Recent ────────────────────────────────────────────────────
async function dLoadRecent() {
  const body = document.getElementById('dRecentBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await db.collection('submissions')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .get();
    if (snap.empty) {
      body.innerHTML = '<div class="empty-msg">No submissions yet.</div>';
      return;
    }
    body.innerHTML = '';
    snap.docs.forEach(doc => {
      const d = doc.data();
      const ts = d.timestamp ? new Date(d.timestamp) : null;
      const timeStr = ts ? ts.toLocaleDateString() + ' ' + ts.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '—';
      const row = document.createElement('div');
      row.className = 'recent-row';
      row.innerHTML = `<div class="recent-time">${timeStr}</div>
        <div class="recent-body">
          <div class="recent-name">${d.fullName || '—'}</div>
          <div class="recent-meta">${d.school || '—'} · ${d.category || d.subject || ''} · Ref: ${d.refNumber || '—'}</div>
        </div>`;
      body.appendChild(row);
    });
  } catch {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

// ── Admin ─────────────────────────────────────────────────────
let _adminDocs = [];

async function dLoadAdmin() {
  const body = document.getElementById('dAdminBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const snap = await db.collection('registration').orderBy('name').get();
    _adminDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    dRenderAdmin(body, _adminDocs);
  } catch {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

function dRenderAdmin(body, docs) {
  let filtered = docs;

  const wrap = document.createElement('div');

  // Search
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search by name or phone…';
  searchInput.className = 'search-box';
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    const rows = tableBody.querySelectorAll('tr');
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Add button
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add';
  addBtn.textContent = '+ Add Organiser';
  addBtn.style.marginBottom = '14px';
  addBtn.addEventListener('click', () => dShowAdminModal(null));

  const scrollDiv = document.createElement('div');
  scrollDiv.className = 'admin-scroll';

  const table = document.createElement('table');
  table.className = 'admin-table';
  table.innerHTML = `<thead><tr>
    <th>Zone</th><th>Name</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th>
  </tr></thead>`;

  const tableBody = document.createElement('tbody');
  docs.forEach(reg => {
    const tr = document.createElement('tr');
    tr.className = reg.status === 'Active' ? 'row-active' : 'row-inactive';
    tr.innerHTML = `<td>${reg.zone || '—'}</td>
      <td>${reg.name || '—'}</td>
      <td>${reg.phone || '—'}</td>
      <td>${reg.role || '—'}</td>
      <td>${reg.status || '—'}</td>
      <td>
        <button class="btn-sm btn-edit">Edit</button>
        <button class="btn-sm btn-tog">${reg.status === 'Active' ? 'Deactivate' : 'Activate'}</button>
        <button class="btn-sm btn-del">Delete</button>
      </td>`;

    tr.querySelector('.btn-edit').addEventListener('click', () => dShowAdminModal(reg));
    tr.querySelector('.btn-tog').addEventListener('click', () => dToggleStatus(reg, tr));
    tr.querySelector('.btn-del').addEventListener('click', () => {
      showConfirm('Delete ' + (reg.name || 'this organiser') + '?', async () => {
        try {
          await db.collection('registration').doc(reg.id).delete();
          _adminDocs = _adminDocs.filter(d => d.id !== reg.id);
          tr.remove();
          showToast('Deleted.', 'success');
        } catch {
          showToast('Delete failed. Try again.', 'error');
        }
      });
    });

    tableBody.appendChild(tr);
  });

  table.appendChild(tableBody);
  scrollDiv.appendChild(table);

  wrap.appendChild(searchInput);
  wrap.appendChild(addBtn);
  wrap.appendChild(scrollDiv);

  body.innerHTML = '';
  body.appendChild(wrap);
}

async function dToggleStatus(reg, tr) {
  const newStatus = reg.status === 'Active' ? 'Inactive' : 'Active';
  try {
    await db.collection('registration').doc(reg.id).update({ status: newStatus });
    reg.status = newStatus;
    tr.className = newStatus === 'Active' ? 'row-active' : 'row-inactive';
    tr.cells[4].textContent = newStatus;
    tr.querySelector('.btn-tog').textContent = newStatus === 'Active' ? 'Deactivate' : 'Activate';
    showToast(newStatus === 'Active' ? 'Activated.' : 'Deactivated.', 'success');
  } catch {
    showToast('Failed. Try again.', 'error');
  }
}

function dShowAdminModal(reg) {
  const isEdit = !!reg;
  document.getElementById('dAdminModalTitle').textContent = isEdit ? 'Edit Organiser' : 'Add Organiser';
  const body = document.getElementById('dAdminModalBody');

  const zones = Object.keys(ZONES);
  body.innerHTML = `
    <div class="form-group"><label>Zone *</label>
      <select id="aZone">
        <option value="">— Select —</option>
        ${zones.map(z => `<option${reg && reg.zone === z ? ' selected' : ''}>${z}</option>`).join('')}
        <option${reg && reg.zone === 'District' ? ' selected' : ''}>District</option>
      </select>
    </div>
    <div class="form-group"><label>Full Name *</label>
      <input type="text" id="aName" value="${reg ? reg.name || '' : ''}">
    </div>
    <div class="form-group"><label>Organiser Name *</label>
      <input type="text" id="aOrganiser" value="${reg ? reg.organiser || '' : ''}">
    </div>
    <div class="form-group"><label>Phone *</label>
      <input type="tel" id="aPhone" value="${reg ? reg.phone || '' : ''}">
    </div>
    <div class="form-group"><label>Role *</label>
      <select id="aRole">
        <option value="">— Select —</option>
        <option${reg && reg.role === 'School' ? ' selected' : ''}>School</option>
        <option${reg && reg.role === 'Zone' ? ' selected' : ''}>Zone</option>
        <option${reg && reg.role === 'District' ? ' selected' : ''}>District</option>
      </select>
    </div>
    <div class="form-group"><label>School/Organisation Type</label>
      <select id="aType">
        <option value="">— Select —</option>
        <option${reg && reg.type === 'Primary School' ? ' selected' : ''}>Primary School</option>
        <option${reg && reg.type === 'Open Centre School' ? ' selected' : ''}>Open Centre School</option>
        <option${reg && reg.type === 'Secondary School' ? ' selected' : ''}>Secondary School</option>
        <option${reg && reg.type === 'Community School' ? ' selected' : ''}>Community School</option>
        <option${reg && reg.type === 'Zone Office' ? ' selected' : ''}>Zone Office</option>
        <option${reg && reg.type === 'District Office' ? ' selected' : ''}>District Office</option>
      </select>
    </div>
    <div class="form-group"><label>Status *</label>
      <select id="aStatus">
        <option${reg && reg.status === 'Active' ? ' selected' : ''}>Active</option>
        <option${reg && reg.status === 'Inactive' ? ' selected' : ''}>Inactive</option>
      </select>
    </div>
    <button class="btn-submit blue-btn" id="aSaveBtn">${isEdit ? 'SAVE CHANGES' : 'ADD'}</button>
  `;

  document.getElementById('dAdminModal').classList.add('open');

  document.getElementById('aSaveBtn').addEventListener('click', async () => {
    const zone     = document.getElementById('aZone').value.trim();
    const name     = document.getElementById('aName').value.trim();
    const organiser = document.getElementById('aOrganiser').value.trim();
    const phone    = document.getElementById('aPhone').value.trim();
    const role     = document.getElementById('aRole').value.trim();
    const type     = document.getElementById('aType').value.trim();
    const status   = document.getElementById('aStatus').value.trim();

    if (!zone || !name || !phone || !role || !status) {
      showToast('Fill all required fields.', 'error');
      return;
    }

    const saveBtn = document.getElementById('aSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const data = { zone, name, organiser, phone, role, type, status };
    try {
      if (isEdit) {
        await db.collection('registration').doc(reg.id).update(data);
        Object.assign(reg, data);
        showToast('Updated.', 'success');
      } else {
        const docRef = await db.collection('registration').add(data);
        _adminDocs.push({ id: docRef.id, ...data });
        showToast('Added.', 'success');
      }
      document.getElementById('dAdminModal').classList.remove('open');
      dRenderAdmin(document.getElementById('dAdminBody'), _adminDocs);
    } catch {
      showToast('Save failed. Try again.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'SAVE CHANGES' : 'ADD';
    }
  });
}

// ── Settings ──────────────────────────────────────────────────
async function dLoadSettings() {
  const body = document.getElementById('dSettingsBody');
  body.innerHTML = '<div class="sec-spinner">Loading…</div>';
  try {
    const doc = await db.collection('settings').doc('deadlines').get();
    const data = doc.exists ? doc.data() : { schoolClose: '', zoneClose: '' };

    body.innerHTML = `
      <div class="form-group">
        <label>School Submissions Close</label>
        <input type="text" id="dSchoolClose" value="${data.schoolClose || ''}" placeholder="e.g. 30 May 2026">
      </div>
      <div class="form-group">
        <label>Zone Submissions Close</label>
        <input type="text" id="dZoneClose" value="${data.zoneClose || ''}" placeholder="e.g. 5 June 2026">
      </div>
      <button class="btn-submit blue-btn" id="dSaveDeadlines">SAVE</button>
    `;

    document.getElementById('dSaveDeadlines').addEventListener('click', async () => {
      const schoolClose = document.getElementById('dSchoolClose').value.trim();
      const zoneClose   = document.getElementById('dZoneClose').value.trim();
      const btn = document.getElementById('dSaveDeadlines');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        await db.collection('settings').doc('deadlines').set({ schoolClose, zoneClose }, { merge: true });
        showToast('Deadlines saved.', 'success');
      } catch {
        showToast('Save failed. Try again.', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'SAVE';
      }
    });
  } catch {
    body.innerHTML = '<div class="empty-msg">Failed to load. Try again.</div>';
  }
}

// ── Init ──────────────────────────────────────────────────────
function initDistrict(user) {
  _districtUser = user;

  // School Data
  document.getElementById('dBtnSchools').addEventListener('click', () => {
    dOpen('dSchoolsOverlay');
    dLoadSchools();
  });
  dBindClose('dSchoolsClose', 'dSchoolsOverlay');
  dBindClose('dSchoolDetailClose', 'dSchoolDetailOverlay');

  // Zone Selections
  document.getElementById('dBtnZones').addEventListener('click', () => {
    dOpen('dZonesOverlay');
    dLoadZones();
  });
  dBindClose('dZonesClose', 'dZonesOverlay');
  dBindClose('dZoneDetailClose', 'dZoneDetailOverlay');

  // By Category
  document.getElementById('dBtnCategory').addEventListener('click', () => {
    dOpen('dCategoryOverlay');
    dLoadCategory();
  });
  dBindClose('dCategoryClose', 'dCategoryOverlay');

  // Recent
  document.getElementById('dBtnRecent').addEventListener('click', () => {
    dOpen('dRecentOverlay');
    dLoadRecent();
  });
  dBindClose('dRecentClose', 'dRecentOverlay');

  // Admin
  document.getElementById('dBtnAdmin').addEventListener('click', () => {
    dOpen('dAdminOverlay');
    dLoadAdmin();
  });
  dBindClose('dAdminClose', 'dAdminOverlay');

  // Admin modal close
  document.getElementById('dAdminModalClose').addEventListener('click', () => {
    document.getElementById('dAdminModal').classList.remove('open');
  });
  document.getElementById('dAdminModal').addEventListener('click', e => {
    if (e.target.id === 'dAdminModal') document.getElementById('dAdminModal').classList.remove('open');
  });

  // Settings
  document.getElementById('dBtnSettings').addEventListener('click', () => {
    dOpen('dSettingsOverlay');
    dLoadSettings();
  });
  dBindClose('dSettingsClose', 'dSettingsOverlay');
}
