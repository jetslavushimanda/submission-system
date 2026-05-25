// ═══════════════════════════════════════════════════════════════
// migrate.gs — One-time migration: Google Sheets → Firebase Firestore
// JETS 2026 | Lavushimanda District
//
// HOW TO RUN:
//   1. Open your Apps Script editor (extensions → Apps Script)
//   2. Add this file (or paste into a new .gs tab)
//   3. Run migrateAllToFirestore() once from the editor
//   4. Check Firestore console to verify data appeared
//   5. Delete this file after migration is confirmed
// ═══════════════════════════════════════════════════════════════

var FIRESTORE_PROJECT = 'jets2026-lavushimanda';
var API_KEY           = 'AIzaSyDINoYBAtoXgLF28ZE3OKEdYBODCWCg_Wc';
var FIRESTORE_BASE    = 'https://firestore.googleapis.com/v1/projects/' +
                        FIRESTORE_PROJECT + '/databases/(default)/documents/';

// ── Firestore REST helper ──────────────────────────────────────
function firestoreAdd_(collection, docObj) {
  var docId = docObj.__doc_id;
  
  var cleanObj = {};
  Object.keys(docObj).forEach(function(k) {
    if (k !== '__doc_id') {
      cleanObj[k] = docObj[k];
    }
  });

  var url;
  var method;
  
  if (docId) {
    url = FIRESTORE_BASE + collection + '/' + encodeURIComponent(docId) + '?key=' + API_KEY;
    method = 'PATCH';
  } else {
    url = FIRESTORE_BASE + collection + '?key=' + API_KEY;
    method = 'POST';
  }

  var payload = { fields: toFirestoreFields_(cleanObj) };

  var resp = UrlFetchApp.fetch(url, {
    method:      method,
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' // Prevents Apps Script from appending personal GCP OAuth token
    },
    payload:     JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  var code = resp.getResponseCode();
  if (code !== 200) {
    Logger.log('Error ' + code + ': ' + resp.getContentText().slice(0, 200));
  }
  return code === 200;
}

// Convert a plain JS object to Firestore field format
function toFirestoreFields_(obj) {
  var fields = {};
  Object.keys(obj).forEach(function(k) {
    var v = obj[k];
    if (v === null || v === undefined) {
      fields[k] = { nullValue: null };
    } else if (typeof v === 'boolean') {
      fields[k] = { booleanValue: v };
    } else if (typeof v === 'number') {
      fields[k] = { doubleValue: v };
    } else {
      fields[k] = { stringValue: String(v) };
    }
  });
  return fields;
}

// ── Main Migration Function ────────────────────────────────────
function migrateAllToFirestore() {
  var ss   = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SHEET_ID')
  );

  var ok   = 0;
  var fail = 0;

  // ── 1. Registrations (Tab 1) ───────────────────────────────
  Logger.log('=== Migrating Registrations ===');
  var tab1 = ss.getSheetByName('Registered Schools');
  if (tab1 && tab1.getLastRow() > 1) {
    var regData = tab1.getRange(2, 1, tab1.getLastRow() - 1, 7).getValues();
    regData.forEach(function(row) {
      var doc = {
        zone:      String(row[0] || '').trim(),
        name:      String(row[1] || '').trim(),
        type:      String(row[2] || '').trim(),
        organiser: String(row[3] || '').trim(),
        phone:     String(row[4] || '').trim(),
        role:      String(row[5] || '').trim(),
        status:    String(row[6] || 'Active').trim(),
      };
      if (!doc.phone) return; // skip blank rows
      firestoreAdd_('registrations', doc) ? ok++ : fail++;
    });
    Logger.log('Registrations done. OK=' + ok + ' FAIL=' + fail);
  }

  // ── 2. School Submissions (Tab 2) ─────────────────────────
  Logger.log('=== Migrating School Submissions ===');
  var tab2 = ss.getSheetByName('School Submissions');
  ok = 0; fail = 0;
  if (tab2 && tab2.getLastRow() > 1) {
    var s2data = tab2.getRange(2, 1, tab2.getLastRow() - 1, 19).getValues();
    s2data.forEach(function(row) {
      var ts = row[0];
      var doc = {
        timestamp:          ts ? new Date(ts).toISOString() : '',
        ref:                String(row[1]  || '').trim(),
        zone:               String(row[2]  || '').trim(),
        school:             String(row[3]  || '').trim(),
        organiserName:      String(row[4]  || '').trim(),
        phone:              String(row[5]  || '').trim(),
        submitterRole:      String(row[6]  || '').trim(),
        type:               String(row[7]  || '').trim(),
        subType:            String(row[8]  || '').trim(),
        participant:        String(row[9]  || '').trim(),
        grade:              String(row[10] || '').trim(),
        gender:             String(row[11] || '').trim(),
        level:              String(row[12] || '').trim(),
        category:           String(row[13] || '').trim(),
        title:              String(row[14] || '').trim(),
        supervisingTeacher: String(row[15] || '').trim(),
        fileUrl:            String(row[16] || '').trim(),
        subjectCode:        String(row[17] || '').trim(),
        schoolType:         String(row[18] || '').trim(),
      };
      if (!doc.ref) return;
      firestoreAdd_('school_submissions', doc) ? ok++ : fail++;
    });
    Logger.log('School Submissions done. OK=' + ok + ' FAIL=' + fail);
  }

  // ── 3. Zone Submissions (Tab 3) ───────────────────────────
  Logger.log('=== Migrating Zone Submissions ===');
  var tab3 = ss.getSheetByName('Zone Submissions');
  ok = 0; fail = 0;
  if (tab3 && tab3.getLastRow() > 1) {
    var s3data = tab3.getRange(2, 1, tab3.getLastRow() - 1, 19).getValues();
    s3data.forEach(function(row) {
      var ts = row[0];
      var doc = {
        timestamp:          ts ? new Date(ts).toISOString() : '',
        ref:                String(row[1]  || '').trim(),
        zone:               String(row[2]  || '').trim(),
        coordinatorName:    String(row[3]  || '').trim(),
        phone:              String(row[4]  || '').trim(),
        school:             String(row[5]  || '').trim(),
        submitterRole:      String(row[6]  || '').trim(),
        type:               String(row[7]  || '').trim(),
        subType:            String(row[8]  || '').trim(),
        participant:        String(row[9]  || '').trim(),
        grade:              String(row[10] || '').trim(),
        gender:             String(row[11] || '').trim(),
        level:              String(row[12] || '').trim(),
        category:           String(row[13] || '').trim(),
        title:              String(row[14] || '').trim(),
        supervisingTeacher: String(row[15] || '').trim(),
        fileUrl:            String(row[16] || '').trim(),
        subjectCode:        String(row[17] || '').trim(),
        schoolType:         String(row[18] || '').trim(),
      };
      if (!doc.ref) return;
      firestoreAdd_('zone_submissions', doc) ? ok++ : fail++;
    });
    Logger.log('Zone Submissions done. OK=' + ok + ' FAIL=' + fail);
  }

  // ── 4. Settings (deadlines & system) ────────────────────────
  Logger.log('=== Writing deadlines and system settings to Firestore ===');
  var sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID') || '';
  var driveFolderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') || '';
  firestoreAdd_('settings', {
    __doc_id:     'deadlines',
    School_Open:  '2026-05-26T00:00:00',
    School_Close: '2026-05-30T23:59:00',
    Zone_Open:    '2026-06-01T00:00:00',
    Zone_Close:   '2026-06-05T23:59:00',
    sheetId:       sheetId,
    driveFolderId: driveFolderId,
    driveUrl:      driveFolderId ? 'https://drive.google.com/drive/folders/' + driveFolderId : '',
  });

  Logger.log('=== Migration complete ===');
}

// Standalone function to migrate only system settings without re-running full data migration
function migrateSystemSettingsToFirestore() {
  Logger.log('=== Migrating System Settings to Firestore ===');
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('SHEET_ID') || '';
  var driveFolderId = props.getProperty('DRIVE_FOLDER_ID') || '';
  var driveUrl = driveFolderId ? 'https://drive.google.com/drive/folders/' + driveFolderId : '';

  // Write directly into the deadlines document which has public read/write permissions
  var ok = firestoreAdd_('settings', {
    __doc_id:      'deadlines',
    sheetId:       sheetId,
    driveFolderId: driveFolderId,
    driveUrl:      driveUrl,
  });

  if (ok) {
    Logger.log('System settings successfully written to Firestore.');
  } else {
    Logger.log('FAILED to write system settings to Firestore.');
  }
}
