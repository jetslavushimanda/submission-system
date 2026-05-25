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

// ── adminGetAllOrganisers_ ────────────────────────────────────
// Returns ALL rows from Tab 1 including District.
// Used by the DEC Admin Organiser Management panel.
function adminGetAllOrganisers_() {
  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', organisers: [] };

  var data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var organisers = [];

  for (var i = 0; i < data.length; i++) {
    organisers.push({
      zone:      (data[i][0] || '').toString().trim(),
      name:      (data[i][1] || '').toString().trim(),
      type:      (data[i][2] || '').toString().trim(),
      organiser: (data[i][3] || '').toString().trim(),
      phone:     (data[i][4] || '').toString().trim(),
      role:      (data[i][5] || '').toString().trim(),
      status:    (data[i][6] || 'Active').toString().trim(),
    });
  }

  return { status: 'ok', organisers: organisers };
}

// ── adminUpdateOrganiser_ ─────────────────────────────────────
// Updates a row matched by origZone + origName + origRole + origPhone.
// Uses phone in the match key to correctly handle DEC members who share
// the same zone/name/role but differ only by phone.
function adminUpdateOrganiser_(payload) {
  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: 'No records found.' };

  var data      = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var targetRow = -1;

  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === (payload.origZone  || '') &&
        (data[i][1] || '').toString().trim() === (payload.origName  || '') &&
        (data[i][5] || '').toString().trim() === (payload.origRole  || '') &&
        (data[i][4] || '').toString().trim() === (payload.origPhone || '')) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow < 0) return { status: 'error', message: 'Record not found.' };

  sheet.getRange(targetRow, 5).setNumberFormat('@');
  sheet.getRange(targetRow, 1, 1, 7).setValues([[
    payload.zone      || '',
    payload.name      || '',
    payload.type      || '',
    payload.organiser || '',
    payload.phone     || '',
    payload.role      || 'School',
    payload.status    || 'Active',
  ]]);
  sheet.getRange(targetRow, 1, 1, 7)
    .setBackground((payload.status === 'Active') ? '#d9ead3' : '#fce8e6');

  return { status: 'ok', message: 'Organiser updated.' };
}

// ── adminDeleteOrganiser_ ─────────────────────────────────────
// Deletes a row matched by zone + name + role + phone.
// Past submissions in Tabs 2 and 3 are NOT touched.
function adminDeleteOrganiser_(payload) {
  var sheet = openSheet_(TAB_REGISTERED);
  if (!sheet) return { status: 'error', message: 'Registered Schools tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: 'No records found.' };

  var data      = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  var targetRow = -1;

  for (var i = 0; i < data.length; i++) {
    if ((data[i][0] || '').toString().trim() === (payload.zone  || '') &&
        (data[i][1] || '').toString().trim() === (payload.name  || '') &&
        (data[i][5] || '').toString().trim() === (payload.role  || '') &&
        (data[i][4] || '').toString().trim() === (payload.phone || '')) {
      targetRow = i + 2;
      break;
    }
  }

  if (targetRow < 0) return { status: 'error', message: 'Record not found.' };

  sheet.deleteRow(targetRow);
  return { status: 'ok', message: 'Organiser deleted. Past submissions preserved.' };
}

// ── adminDeleteSubmission_ ────────────────────────────────────
// Deletes a submission row in Tab 2 or Tab 3 matched by Ref#.
// Appends a log entry to "Deleted_Log" sheet tab.
// Returns the organiser name and phone number to help pre-fill the WhatsApp notification on the frontend.
function adminDeleteSubmission_(payload) {
  var ref = (payload.refNumber || '').toString().trim();
  var reason = (payload.reason || 'Not specified').toString().trim();
  var deletedBy = (payload.deletedBy || 'DEC Organiser').toString().trim();
  
  if (!ref) return { status: 'error', message: 'Reference number is required.' };
  
  var isSchool = ref.indexOf('SCH-') === 0;
  var isZone = ref.indexOf('ZON-') === 0;
  
  if (!isSchool && !isZone) {
    return { status: 'error', message: 'Invalid reference number format: ' + ref };
  }
  
  var tabName = isSchool ? TAB_SCHOOL_SUB : TAB_ZONE_SUB;
  var sheet = openSheet_(tabName);
  if (!sheet) return { status: 'error', message: 'Submissions tab not found: ' + tabName };
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: 'No submissions found in ' + tabName };
  
  // Ref# is in column B (index 1)
  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < values.length; i++) {
    if (values[i][0].toString().trim() === ref) {
      targetRow = i + 2;
      break;
    }
  }
  
  if (targetRow < 0) return { status: 'error', message: 'Submission record not found: ' + ref };
  
  // Read row values before deleting
  var rowValues = sheet.getRange(targetRow, 1, 1, 19).getValues()[0];
  
  var organiserName = '';
  var organiserPhone = '';
  var participantName = '';
  var schoolName = '';
  var category = '';
  
  if (isSchool) {
    organiserName = rowValues[5] || ''; // Col F
    organiserPhone = rowValues[6] || ''; // Col G
    participantName = rowValues[9] || ''; // Col J
    schoolName = rowValues[3] || ''; // Col D
    category = rowValues[13] || ''; // Col N
  } else {
    organiserName = rowValues[3] || ''; // Col D
    organiserPhone = rowValues[4] || ''; // Col E
    participantName = rowValues[9] || ''; // Col J
    schoolName = rowValues[5] || ''; // Col F
    category = rowValues[13] || ''; // Col N
  }
  
  // Delete the row
  sheet.deleteRow(targetRow);
  
  // Log to Deleted_Log sheet tab
  var logSheet = openSheet_('Deleted_Log');
  if (!logSheet) {
    logSheet = ss.insertSheet('Deleted_Log');
    logSheet.appendRow(['Timestamp', 'Request ID / Ref#', 'Participant Name', 'School', 'Category', 'Reason', 'Deleted By']);
    logSheet.getRange(1, 1, 1, 7).setBackground('#c0392b').setFontColor('#ffffff').setFontWeight('bold');
    logSheet.setFrozenRows(1);
  }
  logSheet.appendRow([
    new Date(),
    ref,
    participantName,
    schoolName,
    category,
    reason,
    deletedBy
  ]);
  logSheet.autoResizeColumns(1, 7);
  
  return {
    status: 'ok',
    message: 'Submission removed successfully.',
    organiserName: organiserName,
    phone: organiserPhone,
    participant: participantName,
    category: category,
    ref: ref
  };
}
