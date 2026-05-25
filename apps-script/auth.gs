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
// Searches column E (Phone) for ALL rows matching the phone number.
//
// Handles the dual-role case: a person registered as both a School
// JETS Organiser and a Zonal Coordinator (same phone, two rows)
// receives combined access — equivalent to District.
//
// Returns one of:
//   { found: true,  zone, schoolName, schoolType, organiserName, phone, role }
//   { found: false, reason: "inactive", message: "..." }
//   { found: false }
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

  // Collect every row whose phone matches
  var allMatches = [];
  for (var i = 0; i < rows.length; i++) {
    if (normalizePhone_(rows[i][COL_PHONE]) === phoneNorm) {
      allMatches.push(rows[i]);
    }
  }

  if (allMatches.length === 0) return { found: false };

  // Only Active rows count; if all matches are Inactive → pending message
  var activeMatches = [];
  for (var j = 0; j < allMatches.length; j++) {
    if (allMatches[j][COL_STATUS].toString().trim() === 'Active') {
      activeMatches.push(allMatches[j]);
    }
  }

  if (activeMatches.length === 0) {
    return {
      found:   false,
      reason:  'inactive',
      message: 'Registration pending. Contact Mwansa Gibson: 0973375828',
    };
  }

  // Merge roles from all active rows for this phone number.
  // School + Zone together grants access to both forms (same as District).
  var hasDistrict = false, hasSchool = false, hasZone = false;
  for (var k = 0; k < activeMatches.length; k++) {
    var r = activeMatches[k][COL_ROLE].toString().trim();
    if (r === 'District') hasDistrict = true;
    if (r === 'School')   hasSchool   = true;
    if (r === 'Zone')     hasZone     = true;
  }

  var effectiveRole;
  if (hasDistrict || (hasSchool && hasZone)) {
    effectiveRole = 'District';
  } else if (hasSchool) {
    effectiveRole = 'School';
  } else if (hasZone) {
    effectiveRole = 'Zone';
  } else {
    effectiveRole = activeMatches[0][COL_ROLE].toString().trim();
  }

  Logger.log('Effective role: ' + effectiveRole + ' (' + activeMatches.length + ' active row(s))');

  var primary = activeMatches[0];
  return {
    found:         true,
    zone:          primary[COL_ZONE],
    schoolName:    primary[COL_SCHOOL],
    schoolType:    primary[COL_TYPE],
    organiserName: primary[COL_NAME],
    phone:         phoneNorm,
    role:          effectiveRole,
  };
}
