// ═══════════════════════════════════════════════════════════════
// auth.gs — Tab 1 "Registered Schools" lookup
// JETS 2024-2026 | Lavushimanda District
//
// Tab 1 column layout (row 1 = header, data starts at row 2):
//   A  Zone             e.g. Mpumba
//   B  School Name      e.g. Mununga Primary
//   C  School Type      e.g. Primary School
//   D  Organiser Name   e.g. John Banda
//   E  Phone            e.g. 0971234567  ← search key
//   F  Role             "School" | "Zone" | "District"
//   G  Status           "Active" | "Inactive"
//
// SHEET_ID and TAB_REGISTERED are defined in Code.gs and shared
// across all .gs files in the same Apps Script project.
// ═══════════════════════════════════════════════════════════════

// Column indices (0-based)
var COL_ZONE   = 0;  // A
var COL_SCHOOL = 1;  // B
var COL_TYPE   = 2;  // C
var COL_NAME   = 3;  // D
var COL_PHONE  = 4;  // E  ← lookup key
var COL_ROLE   = 5;  // F  ← role-based access
var COL_STATUS = 6;  // G

// ── normalizePhone_ ───────────────────────────────────────────
// Strips spaces, dashes, and leading zeros for reliable comparison.
function normalizePhone_(p) {
  return p.toString().replace(/[\s\-]/g, '').replace(/^0+/, '');
}

// ── checkRegistration ─────────────────────────────────────────
// Searches column E (Phone) for a matching phone number.
//
// Returns one of:
//   { found: true,  zone, schoolName, schoolType, organiserName, phone, role }
//   { found: false, reason: "inactive", message: "..." }
//   { found: false }
//
// Called by Code.gs which translates this into the status-based
// shape that app.js expects before sending to the client.
function checkRegistration(phone) {
  if (!phone) return { found: false };

  var phoneNorm = normalizePhone_(phone);
  Logger.log('checkRegistration called with: ' + phone + ' (normalized: ' + phoneNorm + ')');

  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(TAB_REGISTERED);
  if (!sheet) { Logger.log('Sheet tab not found'); return { found: false }; }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) { Logger.log('No data rows in sheet'); return { found: false }; }

  // Fetch all 7 columns in one call — avoids per-row API round-trips
  var rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  Logger.log('Total rows read: ' + rows.length);

  for (var i = 0; i < rows.length; i++) {
    var row      = rows[i];
    var rowPhone = normalizePhone_(row[COL_PHONE]);

    if (rowPhone !== phoneNorm) continue;

    // Phone matched — check Status before returning any data
    var status = row[COL_STATUS].toString().trim();

    if (status !== 'Active') {
      return {
        found:   false,
        reason:  'inactive',
        message: 'Your registration is pending. Contact the District JETS Organiser: Mwansa Gibson — 0973375828',
      };
    }

    return {
      found:         true,
      zone:          row[COL_ZONE],
      schoolName:    row[COL_SCHOOL],
      schoolType:    row[COL_TYPE],
      organiserName: row[COL_NAME],
      phone:         rowPhone,
      role:          row[COL_ROLE].toString().trim(),
    };
  }

  return { found: false };
}
