// ═══════════════════════════════════════════════════════════════
// settings.gs — Deadline management (District users only)
// JETS 2024-2026 | Lavushimanda District
//
// Settings tab (Tab 6) layout:
//   A: Key | B: Value (ISO 8601 datetime) | C: Description
//
// Keys:
//   School_Open  — school submissions open
//   School_Close — school submissions close
//   Zone_Open    — zone submissions open
//   Zone_Close   — zone submissions close
//
// Auth is enforced in Code.gs before calling these functions.
// ═══════════════════════════════════════════════════════════════

var DEFAULT_DEADLINES = {
  School_Open:  '2026-05-26T00:00:00',
  School_Close: '2026-05-30T23:59:00',
  Zone_Open:    '2026-06-01T00:00:00',
  Zone_Close:   '2026-06-05T23:59:00',
};

// ── getDeadlines_ ─────────────────────────────────────────────
// Returns current deadlines. No auth required — read on every page load.
// Falls back to defaults if the Settings tab doesn't exist yet.
function getDeadlines_() {
  try {
    var sheet = openSheet_(TAB_SETTINGS);
    if (!sheet) return { status: 'ok', deadlines: DEFAULT_DEADLINES };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { status: 'ok', deadlines: DEFAULT_DEADLINES };

    var data   = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    var result = {};
    var keys   = Object.keys(DEFAULT_DEADLINES);
    for (var k = 0; k < keys.length; k++) result[keys[k]] = DEFAULT_DEADLINES[keys[k]];

    for (var i = 0; i < data.length; i++) {
      var key = (data[i][0] || '').toString().trim();
      var val = (data[i][1] || '').toString().trim();
      if (key && val && result.hasOwnProperty(key)) result[key] = val;
    }

    return { status: 'ok', deadlines: result };
  } catch (err) {
    return { status: 'ok', deadlines: DEFAULT_DEADLINES };
  }
}

// ── saveDeadlines_ ────────────────────────────────────────────
// Writes new deadlines to the Settings tab. Creates tab if missing.
// Payload keys: schoolOpen, schoolClose, zoneOpen, zoneClose (ISO strings)
// Auth is enforced in Code.gs (District role only).
function saveDeadlines_(payload) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(TAB_SETTINGS);

    if (!sheet) {
      sheet = ss.insertSheet(TAB_SETTINGS);
      sheet.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Description']]);
      sheet.getRange(1, 1, 1, 3)
        .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');
    }

    var updates = {
      School_Open:  payload.schoolOpen  || DEFAULT_DEADLINES.School_Open,
      School_Close: payload.schoolClose || DEFAULT_DEADLINES.School_Close,
      Zone_Open:    payload.zoneOpen    || DEFAULT_DEADLINES.Zone_Open,
      Zone_Close:   payload.zoneClose   || DEFAULT_DEADLINES.Zone_Close,
    };

    // Map existing key → sheet row number
    var lastRow  = sheet.getLastRow();
    var existing = {};
    if (lastRow >= 2) {
      var rows = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < rows.length; i++) {
        var k = (rows[i][0] || '').toString().trim();
        if (k) existing[k] = i + 2;
      }
    }

    var order = ['School_Open', 'School_Close', 'Zone_Open', 'Zone_Close'];
    var desc  = {
      School_Open:  'School submissions open',
      School_Close: 'School submissions close',
      Zone_Open:    'Zone submissions open',
      Zone_Close:   'Zone submissions close',
    };

    for (var j = 0; j < order.length; j++) {
      var key = order[j];
      if (existing[key]) {
        sheet.getRange(existing[key], 2).setValue(updates[key]);
      } else {
        sheet.appendRow([key, updates[key], desc[key]]);
      }
    }

    sheet.autoResizeColumns(1, 3);
    return { status: 'ok', message: 'Deadlines saved.', deadlines: updates };

  } catch (err) {
    return { status: 'error', message: 'Could not save deadlines: ' + err.message };
  }
}
