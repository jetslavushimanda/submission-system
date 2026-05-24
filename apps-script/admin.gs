// ═══════════════════════════════════════════════════════════════
// admin.gs — Admin Panel operations (District users only)
// JETS 2024-2026 | Lavushimanda District
//
// Tab 1 ("Registered Schools") column layout:
//   A  Zone          B  School Name    C  School Type
//   D  Organiser Name  E  Phone         F  Role
//   G  Status
//
// Auth check is performed in Code.gs before calling these functions.
// ═══════════════════════════════════════════════════════════════

// ── adminGetSchools_ ──────────────────────────────────────────
// Returns all School + Zone rows from Tab 1 (excludes District).
function adminGetSchools_() {
  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', schools: [] };

  var data    = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var schools = [];

  for (var i = 0; i < data.length; i++) {
    var role = (data[i][5] || '').toString().trim();
    if (role === 'District') continue;
    schools.push({
      zone:      (data[i][0] || '').toString().trim(),
      name:      (data[i][1] || '').toString().trim(),
      type:      (data[i][2] || '').toString().trim(),
      organiser: (data[i][3] || '').toString().trim(),
      phone:     (data[i][4] || '').toString().trim(),
      role:      role,
      status:    (data[i][6] || 'Active').toString().trim(),
    });
  }

  return { status: 'ok', schools: schools };
}

// ── adminUpdateSchool_ ────────────────────────────────────────
// Finds a row by origZone + origName + origRole and replaces all
// 7 columns with the new values from payload.
function adminUpdateSchool_(payload) {
  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: 'No schools found.' };

  var data      = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var targetRow = -1;

  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === (payload.origZone || '') &&
        (data[i][1] || '').toString().trim() === (payload.origName || '') &&
        (data[i][5] || '').toString().trim() === (payload.origRole || '')) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow < 0) return { status: 'error', message: 'School record not found.' };

  // Force phone column as plain text to preserve leading zeros
  sheet.getRange(targetRow, 5).setNumberFormat('@');
  sheet.getRange(targetRow, 1, 1, 7).setValues([[
    payload.zone           || '',
    payload.name           || '',
    payload.type           || '',
    payload.organiser      || '',
    payload.organiserPhone || '',
    payload.role           || 'School',
    payload.status         || 'Active',
  ]]);

  sheet.getRange(targetRow, 1, 1, 7)
    .setBackground((payload.status === 'Active') ? '#d9ead3' : '#fce8e6');

  return { status: 'ok', message: 'School updated successfully.' };
}

// ── adminAddSchool_ ───────────────────────────────────────────
// Appends a new row to Tab 1.
function adminAddSchool_(payload) {
  if (!payload.zone) return { status: 'error', message: 'Zone is required.' };
  if (!payload.name) return { status: 'error', message: 'School name is required.' };

  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 5).setNumberFormat('@');
  sheet.appendRow([
    payload.zone           || '',
    payload.name           || '',
    payload.type           || '',
    payload.organiser      || '',
    payload.organiserPhone || '',
    payload.role           || 'School',
    payload.status         || 'Active',
  ]);

  sheet.getRange(sheet.getLastRow(), 1, 1, 7)
    .setBackground((payload.status === 'Active') ? '#d9ead3' : '#fce8e6');

  return { status: 'ok', message: 'School added successfully.' };
}

// ── adminToggleStatus_ ────────────────────────────────────────
// Flips the Status cell (col G) for one school row.
function adminToggleStatus_(payload) {
  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: 'No schools found.' };

  var data      = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var targetRow = -1;

  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === (payload.zone || '') &&
        (data[i][1] || '').toString().trim() === (payload.name || '') &&
        (data[i][5] || '').toString().trim() === (payload.role || '')) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow < 0) return { status: 'error', message: 'School record not found.' };

  var newStatus = (payload.newStatus || 'Active').toString().trim();
  sheet.getRange(targetRow, 7).setValue(newStatus);
  sheet.getRange(targetRow, 1, 1, 7)
    .setBackground(newStatus === 'Active' ? '#d9ead3' : '#fce8e6');

  return { status: 'ok', message: 'Status updated to ' + newStatus + '.' };
}
