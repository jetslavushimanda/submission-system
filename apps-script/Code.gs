// ═══════════════════════════════════════════════════════════════
// Code.gs — Main entry point
// JETS 2024-2026 | Lavushimanda District
//
// SETUP: Run setupSystem() once from the Apps Script editor
//   (Run → Run function → setupSystem).  It creates the Sheet,
//   all four tabs, and Drive folders, then saves both IDs into
//   Script Properties automatically — no manual copy-paste needed.
//
// DEPLOY: Extensions → Apps Script → Deploy → New deployment
//   Type         : Web app
//   Execute as   : Me
//   Who has access: Anyone
//
// "Anyone" (not "Anyone with a Google account") is required —
// it makes Apps Script include Access-Control-Allow-Origin: *
// automatically so GitHub Pages (or any browser) can POST here.
// ═══════════════════════════════════════════════════════════════

// IDs are written by setupSystem() into Script Properties.
// Fallback placeholder strings allow the file to parse before setup runs.
var SHEET_ID        = PropertiesService.getScriptProperties().getProperty('SHEET_ID')        || 'YOUR_GOOGLE_SHEET_ID_HERE';
var DRIVE_FOLDER_ID = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID') || 'YOUR_DRIVE_FOLDER_ID_HERE';

// Sheet tab names — must match the actual tab names exactly.
const TAB_REGISTERED  = "Registered Schools";   // Tab 1
const TAB_SCHOOL_SUB  = "School Submissions";   // Tab 2
const TAB_ZONE_SUB    = "Zone Submissions";     // Tab 3
const TAB_DASHBOARD   = "District Dashboard";   // Tab 4
const TAB_CORRECTIONS = "Correction Requests";  // Tab 5
const TAB_SETTINGS     = "Settings";             // Tab 6

// ── doGet ─────────────────────────────────────────────────────
// Health-check: paste the web app URL in a browser to confirm
// the deployment is live.
function doGet(e) {
  var result = {
    status:    "running",
    message:   "JETS 2024-2026 Apps Script is live.",
    timestamp: new Date().toISOString(),
  };
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── doPost ────────────────────────────────────────────────────
// Main dispatcher — reads `action` from the JSON body and routes
// to the appropriate handler in auth.gs, school.gs, or zone.gs.
// Every response goes through the same JSON/MIME path so CORS
// headers are applied uniformly.
function doPost(e) {
  var result;

  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;

    if (action === "checkAuth" || action === "checkRegistration") {
      // auth.gs — Tab 1 lookup by phone number.
      // Accepts payload.phone (preferred) or payload.gmail (legacy field name).
      // checkRegistration() returns { found: true/false }.
      // Translate to { status: "found" / "not_found" } so app.js works unchanged.
      var auth = checkRegistration(payload.phone || payload.gmail);
      if (auth.found === true) {
        result = {
          status:        "found",
          zone:          auth.zone,
          schoolName:    auth.schoolName,
          schoolType:    auth.schoolType,
          organiserName: auth.organiserName,
          phone:         auth.phone,
          role:          auth.role,
        };
      } else {
        result = {
          status:  "not_found",
          reason:  auth.reason  || "",
          message: auth.message || "",
        };
      }

    } else if (action === "submitSchool") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || (authCheck.role !== 'School' && authCheck.role !== 'District')) {
        result = { status: 'error', message: 'Unauthorized. Access denied.' };
      } else {
        result = submitSchoolParticipant(payload);
        if (result.status === 'ok') updateDashboard_();
      }

    } else if (action === "submitZone") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || (authCheck.role !== 'Zone' && authCheck.role !== 'District')) {
        result = { status: 'error', message: 'Unauthorized. Access denied.' };
      } else {
        result = submitZoneParticipant(payload);
        if (result.status === 'ok') updateDashboard_();
      }

    } else if (action === "getDashboard") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. Access denied.' };
      } else {
        result = getDashboardData_();
      }

    } else if (action === "getFullDashboard") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. Access denied.' };
      } else {
        result = getFullDashboard_();
      }

    } else if (action === "getRecentFeed") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. Access denied.' };
      } else {
        result = getRecentFeed_();
      }

    } else if (action === "getCount") {
      result = getSchoolCount(payload);

    } else if (action === "getZoneCount") {
      result = getZoneCount(payload);

    } else if (action === "getSkillCounts") {
      result = getSkillCounts(payload);

    } else if (action === "getZoneSkillCounts") {
      result = getZoneSkillCounts(payload);

    } else if (action === "getWelcomeStats") {
      result = getWelcomeStats_(payload);

    } else if (action === "getSubmissionHistory") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found) {
        result = { status: 'error', message: 'Unauthorized.' };
      } else {
        result = getSubmissionHistory_(payload.phone, payload.source);
      }

    } else if (action === "submitCorrectionRequest") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found) {
        result = { status: 'error', message: 'Unauthorized.' };
      } else {
        result = submitCorrectionRequest(payload);
      }

    } else if (action === "getCorrectionRequests") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = getCorrectionRequests_();
      }

    } else if (action === "handleCorrectionDecision") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = handleCorrectionDecision_(payload.requestId, payload.decision, authCheck.organiserName);
      }

    } else if (action === "adminGetSchools") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminGetSchools_();
      }

    } else if (action === "adminUpdateSchool") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminUpdateSchool_(payload);
      }

    } else if (action === "adminAddSchool") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminAddSchool_(payload);
      }

    } else if (action === "adminToggleStatus") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminToggleStatus_(payload);
      }

    } else if (action === "adminGetAllOrganisers") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminGetAllOrganisers_();
      }

    } else if (action === "adminUpdateOrganiser") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminUpdateOrganiser_(payload);
      }

    } else if (action === "adminDeleteOrganiser") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = adminDeleteOrganiser_(payload);
      }

    } else if (action === "getDeadlines") {
      // No auth — every user reads deadlines on load
      result = getDeadlines_();

    } else if (action === "saveDeadlines") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found || authCheck.role !== 'District') {
        result = { status: 'error', message: 'Unauthorized. District access only.' };
      } else {
        result = saveDeadlines_(payload);
      }

    } else if (action === "getProgressData") {
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found) {
        result = { status: 'error', message: 'Unauthorized.' };
      } else {
        result = getProgressData_(payload, authCheck);
      }

    } else {
      result = { status: "error", message: "Unknown action: " + action };
    }

  } catch (err) {
    result = { status: "error", message: "Server error: " + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── getCount ──────────────────────────────────────────────────
// Called by school-form.js to show the slot-usage progress bar.
// Counts all rows in Tab 2 whose School Name (col D) matches.
function getSchoolCount(payload) {
  var schoolName = trim_(payload.schoolName);
  if (!schoolName) return { count: 0 };

  var sheet = openSheet_(TAB_SCHOOL_SUB);
  if (!sheet) return { count: 0 };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { count: 0 };

  // Column D (index 3 in 0-based) = School Name
  var names = sheet.getRange(2, 4, lastRow - 1, 1).getValues();
  var count = 0;
  for (var i = 0; i < names.length; i++) {
    if (trim_(names[i][0]) === schoolName) count++;
  }
  return { count: count };
}

// ── getZoneCount ──────────────────────────────────────────────
// Called by zone-form.js to show the zone slot-usage progress bar.
// Counts all rows in Tab 3 whose Zone (col C) matches.
function getZoneCount(payload) {
  var zoneName = trim_(payload.zone);
  if (!zoneName) return { count: 0 };

  var sheet = openSheet_(TAB_ZONE_SUB);
  if (!sheet) return { count: 0 };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { count: 0 };

  var zones = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
  var count = 0;
  for (var i = 0; i < zones.length; i++) {
    if (trim_(zones[i][0]) === zoneName) count++;
  }
  return { count: count };
}

// ── getSkillCounts ────────────────────────────────────────────
// Returns per-category Technical Skills submission counts for one school.
// Tab 2 col H = Participant Type ("Learner — Technical Skills"), col N = Category.
function getSkillCounts(payload) {
  var schoolName = trim_(payload.schoolName);
  if (!schoolName) return { status: 'ok', counts: {} };

  var sheet = openSheet_(TAB_SCHOOL_SUB);
  if (!sheet) return { status: 'ok', counts: {} };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', counts: {} };

  var data = sheet.getRange(2, 4, lastRow - 1, 11).getValues(); // cols D..N
  var counts = {};
  for (var i = 0; i < data.length; i++) {
    var school = trim_(data[i][0]);       // col D
    var pType  = (data[i][4] || '').toString(); // col H
    var cat    = (data[i][10] || '').toString().trim(); // col N
    if (school === schoolName && pType.indexOf('Technical Skills') !== -1 && cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return { status: 'ok', counts: counts };
}

// ── getZoneSkillCounts ────────────────────────────────────────
// Returns per-category Technical Skills submission counts for one zone.
// Tab 3 col C = Zone, col H = Participant Type, col N = Category.
function getZoneSkillCounts(payload) {
  var zoneName = trim_(payload.zone);
  if (!zoneName) return { status: 'ok', counts: {} };

  var sheet = openSheet_(TAB_ZONE_SUB);
  if (!sheet) return { status: 'ok', counts: {} };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', counts: {} };

  var data = sheet.getRange(2, 3, lastRow - 1, 12).getValues(); // cols C..N
  var counts = {};
  for (var i = 0; i < data.length; i++) {
    var zone  = trim_(data[i][0]);        // col C
    var pType = (data[i][5] || '').toString(); // col H
    var cat   = (data[i][11] || '').toString().trim(); // col N
    if (zone === zoneName && pType.indexOf('Technical Skills') !== -1 && cat) {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }
  return { status: 'ok', counts: counts };
}

// ── Drive file upload ─────────────────────────────────────────
// Saves a base64-encoded report to the configured Drive folder,
// sets link-sharing to view-only, and returns the file URL.
// Called from school.gs and zone.gs — not exposed as an action.
// If the upload fails the submission still saves; the link is "".
function saveReportToDrive(base64Data, fileName, mimeType) {
  try {
    var folder = DRIVE_FOLDER_ID
      ? DriveApp.getFolderById(DRIVE_FOLDER_ID)
      : DriveApp.getRootFolder();

    var blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType || "application/octet-stream",
      fileName || "report"
    );

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();

  } catch (err) {
    Logger.log("Drive upload failed: " + err.message);
    return "";
  }
}

// ── updateDashboard_ ──────────────────────────────────────────
// Rebuilds Tab 4 ("District Dashboard") with live COUNTIF formulas
// after every successful school or zone submission.
// Note: Status is now column G (after Role was inserted as column F).
function updateDashboard_() {
  var dash = openSheet_(TAB_DASHBOARD);
  if (!dash) return;

  var ZONES = ['Mpumba', 'Chiundaponde', 'Lukulu', 'Kalonje', 'Mwelushi'];

  dash.clearContents();
  dash.getRange(1, 1, 1, 6).setValues([[
    'Zone', 'School Submissions', 'Zone Submissions', 'Total', 'Active Schools', 'Pending Schools'
  ]]);
  dash.getRange(1, 1, 1, 6)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');

  for (var k = 0; k < ZONES.length; k++) {
    var r  = k + 2;
    var zn = ZONES[k];
    dash.getRange(r, 1).setValue(zn);
    dash.getRange(r, 2).setFormula('=COUNTIF(\'School Submissions\'!C:C,"' + zn + '")');
    dash.getRange(r, 3).setFormula('=COUNTIF(\'Zone Submissions\'!C:C,"' + zn + '")');
    dash.getRange(r, 4).setFormula('=B' + r + '+C' + r);
    // Status is now col G in Tab 1
    dash.getRange(r, 5).setFormula(
      '=COUNTIFS(\'Registered Schools\'!A:A,"' + zn + '",\'Registered Schools\'!G:G,"Active")'
    );
    dash.getRange(r, 6).setFormula(
      '=COUNTIFS(\'Registered Schools\'!A:A,"' + zn + '",\'Registered Schools\'!G:G,"Inactive")'
    );
  }

  var tot = ZONES.length + 2;
  dash.getRange(tot, 1).setValue('TOTAL');
  for (var col = 2; col <= 6; col++) {
    dash.getRange(tot, col).setFormula(
      '=SUM(' + colLetter_(col) + '2:' + colLetter_(col) + (tot - 1) + ')'
    );
  }
  dash.getRange(tot, 1, 1, 6).setFontWeight('bold').setBackground('#c9daf8');

  dash.setFrozenRows(1);
  dash.autoResizeColumns(1, 6);
}

// ── setupSystem ───────────────────────────────────────────────
// Run ONCE from the Apps Script editor: Run → Run function → setupSystem.
// Creates the Google Sheet (4 tabs), Drive folder tree, and persists
// both IDs into Script Properties so all other functions pick them up
// automatically.  Safe to re-run: detects an existing setup and aborts.
function setupSystem() {
  var props = PropertiesService.getScriptProperties();

  // ── Idempotency guard ────────────────────────────────────────
  var storedId = props.getProperty('SHEET_ID');
  if (storedId) {
    try {
      SpreadsheetApp.openById(storedId);
      SpreadsheetApp.getUi().alert(
        'Setup already complete.\n\n' +
        'Sheet ID  : ' + storedId + '\n\n' +
        'To re-run, delete SHEET_ID from\n' +
        'Project Settings → Script Properties.'
      );
      return;
    } catch (ignored) {
      Logger.log('Stored sheet not found — proceeding with fresh setup.');
    }
  }

  // ── Step 1: Create Google Sheet ──────────────────────────────
  Logger.log('Creating Google Sheet...');
  var ss      = SpreadsheetApp.create('JETS Lavushimanda 2024-2026');
  var sheetId = ss.getId();
  Logger.log('Sheet ID : ' + sheetId + '  URL : ' + ss.getUrl());

  // ── Step 2: Tab 1 — Registered Schools ──────────────────────
  var tab1 = ss.getActiveSheet().setName('Registered Schools');
  tab1.getRange(1, 1, 1, 7).setValues([[
    'Zone', 'School Name', 'School Type', 'Organiser Name', 'Phone', 'Role', 'Status'
  ]]);

  var schoolRows = [
    // ─ District JETS Executive Committee (DEC) — Role: District ──
    ['DISTRICT', 'DEC', 'DEC', 'Mukuka Davy',    '0977768103', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Nakamba Gladys',  '0974245077', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Namwinga Dorica', '0978466186', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Tafuna Alex',     '0977202388', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Kaleya Justin',   '0979563644', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Mwansa Gibson',   '0973375828', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Chuma Chomi',     '0979160918', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Chanda Emeldah',  '0772524170', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Mukamba Ruth',    '0961980482', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Chilunga Linda',  '0955379572', 'District', 'Active'],
    // ─ Zonal JETS Coordinators — Role: Zone ────────────────────
    ['Chiundaponde', 'Chiundaponde Secondary',  'Secondary School',   'Kaluba Moses',     '0955756491', 'Zone', 'Active'],
    ['Kalonje',      'Kalonje Secondary',        'Secondary School',   'Simbaya Felix',    '0975732550', 'Zone', 'Active'],
    ['Lukulu',       'Lukulu Day Secondary',      'Secondary School',   'Silomba Frank',    '0968875977', 'Zone', 'Active'],
    ['Mpumba',       'Mpumba Primary',            'Primary School',     'Siafunda Carlos',  '0776337582', 'Zone', 'Active'],
    ['Mwelushi',     'Kapilya Open Centre',       'Open Centre School', 'Chipwepwe Nelson', '0974525316', 'Zone', 'Active'],
    // ─ Mpumba Zone — Role: School ──────────────────────────────
    ['Mpumba', 'Kapengwe Open Centre',         'Open Centre School', 'Kashishi Sydney',   '0972099165', 'School', 'Active'  ],
    ['Mpumba', 'Mpumba Primary',               'Primary School',     'Siafunda Carlos',   '0972086640', 'School', 'Active'  ],
    ['Mpumba', 'Muchelenje Open Centre',       'Open Centre School', 'Banda Grandson',    '0979865581', 'School', 'Active'  ],
    ['Mpumba', 'Mununga Primary',              'Primary School',     'Moonga Choonya',    '0974851171', 'School', 'Active'  ],
    ['Mpumba', 'Mununga Secondary',            'Secondary School',   'Sota Charles',      '0970179112', 'School', 'Active'  ],
    ['Mpumba', 'Mwenda Primary',               'Primary School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Mpumba', 'Red Rhino Secondary',          'Secondary School',   'Mwalimu Musatwe',   '0972291796', 'School', 'Active'  ],
    ['Mpumba', 'Salamo Primary',               'Primary School',     'Phiri Silvester',   '0974791924', 'School', 'Active'  ],
    ['Mpumba', 'Salamo Secondary',             'Secondary School',   'Loloma Gimel',      '0974654057', 'School', 'Active'  ],
    ['Mpumba', 'Tubondo Primary',              'Primary School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Mpumba', 'Khem Private School',          'Private School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Mpumba', 'St. Rochester Private School', 'Private School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    // ─ Chiundaponde Zone — Role: School ────────────────────────
    ['Chiundaponde', 'Chiundaponde Primary',   'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Lulimala Primary',       'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Chifinshi Primary',      'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Makanga Primary',        'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Ngweshi Primary',        'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Chiundaponde Secondary', 'Secondary School', 'PENDING', 'PENDING', 'School', 'Inactive'],
    // ─ Lukulu Zone — Role: School ──────────────────────────────
    ['Lukulu', 'Chito Primary',        'Primary School',   'Chavula Alex',    '0962087974', 'School', 'Active'],
    ['Lukulu', 'Kapololo Primary',     'Primary School',   'Chola Christine',  '0775158648', 'School', 'Active'],
    ['Lukulu', 'Kapwanya Primary',     'Primary School',   'Banda Elias',      '0978600778', 'School', 'Active'],
    ['Lukulu', 'Lukulu Primary',       'Primary School',   'Kanchela Bertha',  '0977155763', 'School', 'Active'],
    ['Lukulu', 'Lukulu Day Secondary', 'Secondary School', 'Kasakula Ackson',  '0966406465', 'School', 'Active'],
    ['Lukulu', 'Mabonga Primary',      'Primary School',   'Mupinde Patrick',  '0978935433', 'School', 'Active'],
    ['Lukulu', 'Mpomfu Primary',       'Primary School',   'Mubanga Max',      '0965573696', 'School', 'Active'],
    ['Lukulu', 'Nsansha Primary',      'Primary School',   'Mtonga Hambe',     '0967329360', 'School', 'Active'],
    // ─ Kalonje Zone — Role: School ─────────────────────────────
    ['Kalonje', 'Chilebela Primary',        'Primary School',     'Sichone Jane',         '0950934985', 'School', 'Active'  ],
    ['Kalonje', 'Finkuli Open Centre',      'Open Centre School', 'Sabi Fridah',           '0977672828', 'School', 'Active'  ],
    ['Kalonje', 'Kalonje Primary',          'Primary School',     'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Kalonje Secondary',        'Secondary School',   'Chilunga Mwape Linda', '0955379572', 'School', 'Active'  ],
    ['Kalonje', 'Kamwendo Primary',         'Primary School',     'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Mabyulu Primary',          'Primary School',     'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Mupamadzi Open Centre',    'Open Centre School', 'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Mutumba Community School', 'Community School',   'PENDING',              'PENDING',    'School', 'Inactive'],
    // ─ Mwelushi Zone — Role: School ────────────────────────────
    ['Mwelushi', 'Mwila Chilembwe Primary', 'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Mwendachabe Primary',     'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Chipelembe Primary',      'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Kapilya Open Centre',     'Open Centre School', 'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Mwelushi Primary',        'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Muwele Primary',          'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Milomfi Primary',         'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Chibali Primary',         'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
  ];

  // Force phone column (E) to plain text BEFORE writing so leading zeros are kept
  tab1.getRange(2, 5, schoolRows.length, 1).setNumberFormat('@');
  tab1.getRange(2, 1, schoolRows.length, 7).setValues(schoolRows);

  // Header: dark green / white bold
  tab1.getRange(1, 1, 1, 7)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');

  // Row colours: light green = Active, light red = Inactive/Pending
  // Status is now index 6 (column G)
  for (var i = 0; i < schoolRows.length; i++) {
    tab1.getRange(i + 2, 1, 1, 7)
      .setBackground(schoolRows[i][6] === 'Active' ? '#d9ead3' : '#fce8e6');
  }

  tab1.setFrozenRows(1);
  tab1.autoResizeColumns(1, 7);

  // ── Step 3: Tab 2 — School Submissions ──────────────────────
  var tab2 = ss.insertSheet('School Submissions');
  var h2   = [
    'Timestamp', 'Ref#', 'Zone', 'School', 'School Type', 'Organiser Name',
    'Phone', 'Participant Type', 'Level', 'Full Name', 'Age', 'Sex', 'Grade',
    'Category', 'Sub-Skill', 'Innovation Title', 'Supervising Teacher/Mentor',
    'Report Drive Link', 'Submitted By'
  ];
  tab2.getRange(1, 1, 1, h2.length).setValues([h2]);
  tab2.getRange(1, 1, 1, h2.length)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');
  tab2.setFrozenRows(1);
  tab2.autoResizeColumns(1, h2.length);

  // ── Step 4: Tab 3 — Zone Submissions ────────────────────────
  var tab3 = ss.insertSheet('Zone Submissions');
  var h3   = [
    'Timestamp', 'Ref#', 'Zone', 'Zonal Coordinator', 'Phone', 'Participant School',
    'School Type', 'Participant Type', 'Level', 'Full Name', 'Age', 'Sex', 'Grade',
    'Category', 'Sub-Skill', 'Innovation Title', 'Supervising Teacher/Mentor',
    'Report Drive Link', 'Submitted By'
  ];
  tab3.getRange(1, 1, 1, h3.length).setValues([h3]);
  tab3.getRange(1, 1, 1, h3.length)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');
  tab3.setFrozenRows(1);
  tab3.autoResizeColumns(1, h3.length);

  // ── Step 5: Tab 4 — District Dashboard (formula-based) ──────
  var tab4  = ss.insertSheet('District Dashboard');
  var ZONES = ['Mpumba', 'Chiundaponde', 'Lukulu', 'Kalonje', 'Mwelushi'];

  tab4.getRange(1, 1, 1, 6).setValues([[
    'Zone', 'School Submissions', 'Zone Submissions', 'Total', 'Active Schools', 'Pending Schools'
  ]]);
  tab4.getRange(1, 1, 1, 6)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');

  for (var z = 0; z < ZONES.length; z++) {
    var r  = z + 2;
    var zn = ZONES[z];
    tab4.getRange(r, 1).setValue(zn);
    tab4.getRange(r, 2).setFormula(
      '=COUNTIF(\'School Submissions\'!C:C,"' + zn + '")'
    );
    tab4.getRange(r, 3).setFormula(
      '=COUNTIF(\'Zone Submissions\'!C:C,"' + zn + '")'
    );
    tab4.getRange(r, 4).setFormula('=B' + r + '+C' + r);
    // Status is now col G in Tab 1 (Role was inserted as col F)
    tab4.getRange(r, 5).setFormula(
      '=COUNTIFS(\'Registered Schools\'!A:A,"' + zn + '",\'Registered Schools\'!G:G,"Active")'
    );
    tab4.getRange(r, 6).setFormula(
      '=COUNTIFS(\'Registered Schools\'!A:A,"' + zn + '",\'Registered Schools\'!G:G,"Inactive")'
    );
  }

  var tot = ZONES.length + 2;
  tab4.getRange(tot, 1).setValue('TOTAL');
  for (var col = 2; col <= 6; col++) {
    tab4.getRange(tot, col).setFormula(
      '=SUM(' + colLetter_(col) + '2:' + colLetter_(col) + (tot - 1) + ')'
    );
  }
  tab4.getRange(tot, 1, 1, 6).setFontWeight('bold').setBackground('#c9daf8');
  tab4.setFrozenRows(1);
  tab4.autoResizeColumns(1, 6);

  // ── Step 5b: Tab 5 — Correction Requests ────────────────────
  var tab5 = ss.insertSheet('Correction Requests');
  var h5   = [
    'Timestamp', 'Request ID', 'Reference Number', 'Coordinator Name', 'Phone',
    'School/Zone', 'What to Correct', 'Correct Information', 'Status',
    'Decided By', 'Decision Timestamp', 'Source', 'Participant Name'
  ];
  tab5.getRange(1, 1, 1, h5.length).setValues([h5]);
  tab5.getRange(1, 1, 1, h5.length)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');
  tab5.setFrozenRows(1);
  tab5.autoResizeColumns(1, h5.length);

  // ── Step 5c: Tab 6 — Settings (deadlines) ───────────────────
  var tab6 = ss.insertSheet('Settings');
  tab6.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'Description']]);
  tab6.getRange(1, 1, 1, 3)
    .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');
  tab6.getRange(2, 1, 4, 3).setValues([
    ['School_Open',  '2026-05-26T00:00:00', 'School submissions open'],
    ['School_Close', '2026-05-30T23:59:00', 'School submissions close'],
    ['Zone_Open',    '2026-06-01T00:00:00', 'Zone submissions open'],
    ['Zone_Close',   '2026-06-05T23:59:00', 'Zone submissions close'],
  ]);
  tab6.setFrozenRows(1);
  tab6.autoResizeColumns(1, 3);

  // ── Step 6: Create Drive folder tree ────────────────────────
  Logger.log('Creating Drive folders...');
  var mainFolder   = DriveApp.createFolder('JETS Lavushimanda 2024-2026');
  var mainFolderId = mainFolder.getId();
  var schoolFolder = mainFolder.createFolder('School Submissions');
  var zoneFolder   = mainFolder.createFolder('Zone Submissions');
  for (var f = 0; f < ZONES.length; f++) {
    schoolFolder.createFolder(ZONES[f]);
    zoneFolder.createFolder(ZONES[f]);
  }
  Logger.log('Drive Folder ID : ' + mainFolderId);

  // ── Step 7: Persist IDs to Script Properties ─────────────────
  props.setProperties({ SHEET_ID: sheetId, DRIVE_FOLDER_ID: mainFolderId });

  SHEET_ID        = sheetId;
  DRIVE_FOLDER_ID = mainFolderId;

  // ── Step 8: Confirmation ─────────────────────────────────────
  Logger.log('=== SETUP COMPLETE ===');
  Logger.log('Sheet URL  : ' + ss.getUrl());
  Logger.log('Sheet ID   : ' + sheetId);
  Logger.log('Folder ID  : ' + mainFolderId);

  SpreadsheetApp.getUi().alert(
    'Setup Complete!\n\n' +
    'JETS Lavushimanda 2024-2026 system is ready.\n\n' +
    'Sheet ID   : ' + sheetId + '\n' +
    'Folder ID  : ' + mainFolderId + '\n\n' +
    'Open View → Execution log for full details.'
  );
}

// ── reloadSchoolData ──────────────────────────────────────────
// Run from the Apps Script editor to reload Tab 1 with the correct
// 7-column layout (Zone, School Name, School Type, Organiser Name,
// Phone, Role, Status) without creating a new sheet.
function reloadSchoolData() {
  var ss   = SpreadsheetApp.openById(SHEET_ID);
  var tab1 = ss.getSheetByName(TAB_REGISTERED);
  if (!tab1) { Logger.log('Tab "Registered Schools" not found.'); return; }

  var schoolRows = [
    ['DISTRICT', 'DEC', 'DEC', 'Mukuka Davy',    '0977768103', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Nakamba Gladys',  '0974245077', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Namwinga Dorica', '0978466186', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Tafuna Alex',     '0977202388', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Kaleya Justin',   '0979563644', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Mwansa Gibson',   '0973375828', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Chuma Chomi',     '0979160918', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Chanda Emeldah',  '0772524170', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Mukamba Ruth',    '0961980482', 'District', 'Active'],
    ['DISTRICT', 'DEC', 'DEC', 'Chilunga Linda',  '0955379572', 'District', 'Active'],
    ['Chiundaponde', 'Chiundaponde Secondary',  'Secondary School',   'Kaluba Moses',     '0955756491', 'Zone', 'Active'],
    ['Kalonje',      'Kalonje Secondary',        'Secondary School',   'Simbaya Felix',    '0975732550', 'Zone', 'Active'],
    ['Lukulu',       'Lukulu Day Secondary',      'Secondary School',   'Silomba Frank',    '0968875977', 'Zone', 'Active'],
    ['Mpumba',       'Mpumba Primary',            'Primary School',     'Siafunda Carlos',  '0776337582', 'Zone', 'Active'],
    ['Mwelushi',     'Kapilya Open Centre',       'Open Centre School', 'Chipwepwe Nelson', '0974525316', 'Zone', 'Active'],
    ['Mpumba', 'Kapengwe Open Centre',         'Open Centre School', 'Kashishi Sydney',   '0972099165', 'School', 'Active'  ],
    ['Mpumba', 'Mpumba Primary',               'Primary School',     'Siafunda Carlos',   '0972086640', 'School', 'Active'  ],
    ['Mpumba', 'Muchelenje Open Centre',       'Open Centre School', 'Banda Grandson',    '0979865581', 'School', 'Active'  ],
    ['Mpumba', 'Mununga Primary',              'Primary School',     'Moonga Choonya',    '0974851171', 'School', 'Active'  ],
    ['Mpumba', 'Mununga Secondary',            'Secondary School',   'Sota Charles',      '0970179112', 'School', 'Active'  ],
    ['Mpumba', 'Mwenda Primary',               'Primary School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Mpumba', 'Red Rhino Secondary',          'Secondary School',   'Mwalimu Musatwe',   '0972291796', 'School', 'Active'  ],
    ['Mpumba', 'Salamo Primary',               'Primary School',     'Phiri Silvester',   '0974791924', 'School', 'Active'  ],
    ['Mpumba', 'Salamo Secondary',             'Secondary School',   'Loloma Gimel',      '0974654057', 'School', 'Active'  ],
    ['Mpumba', 'Tubondo Primary',              'Primary School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Mpumba', 'Khem Private School',          'Private School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Mpumba', 'St. Rochester Private School', 'Private School',     'PENDING',           'PENDING',    'School', 'Inactive'],
    ['Chiundaponde', 'Chiundaponde Primary',   'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Lulimala Primary',       'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Chifinshi Primary',      'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Makanga Primary',        'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Ngweshi Primary',        'Primary School',   'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Chiundaponde', 'Chiundaponde Secondary', 'Secondary School', 'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Lukulu', 'Chito Primary',        'Primary School',   'Chavula Alex',    '0962087974', 'School', 'Active'],
    ['Lukulu', 'Kapololo Primary',     'Primary School',   'Chola Christine',  '0775158648', 'School', 'Active'],
    ['Lukulu', 'Kapwanya Primary',     'Primary School',   'Banda Elias',      '0978600778', 'School', 'Active'],
    ['Lukulu', 'Lukulu Primary',       'Primary School',   'Kanchela Bertha',  '0977155763', 'School', 'Active'],
    ['Lukulu', 'Lukulu Day Secondary', 'Secondary School', 'Kasakula Ackson',  '0966406465', 'School', 'Active'],
    ['Lukulu', 'Mabonga Primary',      'Primary School',   'Mupinde Patrick',  '0978935433', 'School', 'Active'],
    ['Lukulu', 'Mpomfu Primary',       'Primary School',   'Mubanga Max',      '0965573696', 'School', 'Active'],
    ['Lukulu', 'Nsansha Primary',      'Primary School',   'Mtonga Hambe',     '0967329360', 'School', 'Active'],
    ['Kalonje', 'Chilebela Primary',        'Primary School',     'Sichone Jane',         '0950934985', 'School', 'Active'  ],
    ['Kalonje', 'Finkuli Open Centre',      'Open Centre School', 'Sabi Fridah',           '0977672828', 'School', 'Active'  ],
    ['Kalonje', 'Kalonje Primary',          'Primary School',     'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Kalonje Secondary',        'Secondary School',   'Chilunga Mwape Linda', '0955379572', 'School', 'Active'  ],
    ['Kalonje', 'Kamwendo Primary',         'Primary School',     'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Mabyulu Primary',          'Primary School',     'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Mupamadzi Open Centre',    'Open Centre School', 'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Kalonje', 'Mutumba Community School', 'Community School',   'PENDING',              'PENDING',    'School', 'Inactive'],
    ['Mwelushi', 'Mwila Chilembwe Primary', 'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Mwendachabe Primary',     'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Chipelembe Primary',      'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Kapilya Open Centre',     'Open Centre School', 'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Mwelushi Primary',        'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Muwele Primary',          'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Milomfi Primary',         'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
    ['Mwelushi', 'Chibali Primary',         'Primary School',     'PENDING', 'PENDING', 'School', 'Inactive'],
  ];

  // Clear old data rows (keep header)
  if (tab1.getLastRow() > 1) {
    tab1.getRange(2, 1, tab1.getLastRow() - 1, 7).clearContent().clearFormat();
  }

  // Write header with updated 7-column layout
  tab1.getRange(1, 1, 1, 7).setValues([[
    'Zone', 'School Name', 'School Type', 'Organiser Name', 'Phone', 'Role', 'Status'
  ]]);

  // Force phone column as plain text to preserve leading zeros
  tab1.getRange(2, 5, schoolRows.length, 1).setNumberFormat('@');
  tab1.getRange(2, 1, schoolRows.length, 7).setValues(schoolRows);

  // Reapply header formatting
  tab1.getRange(1, 1, 1, 7).setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');

  // Row colours — Status is now index 6
  for (var i = 0; i < schoolRows.length; i++) {
    tab1.getRange(i + 2, 1, 1, 7)
      .setBackground(schoolRows[i][6] === 'Active' ? '#d9ead3' : '#fce8e6');
  }

  tab1.setFrozenRows(1);
  tab1.autoResizeColumns(1, 7);

  Logger.log('School data reloaded — ' + schoolRows.length + ' rows written.');
  Logger.log('Sheet URL: ' + ss.getUrl());
}

// ── getDashboardData_ ─────────────────────────────────────────
// Returns zone-level submission counts from Tab 4 (District Dashboard).
// Tab 4 is formula-driven; getValues() returns computed results.
function getDashboardData_() {
  var dash = openSheet_(TAB_DASHBOARD);
  if (!dash) return { status: 'error', message: 'Dashboard tab not found.' };
  var lastRow = dash.getLastRow();
  if (lastRow < 2) return { status: 'ok', rows: [] };
  var data = dash.getRange(2, 1, lastRow - 1, 4).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) {
      rows.push({
        zone:    data[i][0].toString(),
        school:  data[i][1] || 0,
        zone_sub: data[i][2] || 0,
        total:   data[i][3] || 0,
      });
    }
  }
  return { status: 'ok', rows: rows };
}

// ── getSubmissionHistory_ ─────────────────────────────────────
// Returns all submissions for a given phone number from the
// appropriate tab (school → Tab 2, zone → Tab 3).
// Columns A-N (indices 0-13) are read; both tabs share the same
// column layout up to N.
function getSubmissionHistory_(phone, source) {
  var normalizedPhone = (phone || '').toString().toLowerCase().trim();
  if (!normalizedPhone) return { status: 'ok', rows: [] };

  var rows = [];

  if (source === 'school') {
    var sheet2 = openSheet_(TAB_SCHOOL_SUB);
    if (sheet2) {
      var lastRow2 = sheet2.getLastRow();
      if (lastRow2 >= 2) {
        var data2 = sheet2.getRange(2, 1, lastRow2 - 1, 14).getValues();
        for (var i = 0; i < data2.length; i++) {
          // Col G (index 6) = Phone
          var rowPhone = (data2[i][6] || '').toString().toLowerCase().trim();
          if (rowPhone === normalizedPhone) {
            var ts = data2[i][0];
            rows.push({
              refNumber: (data2[i][1] || '').toString(),
              timestamp: ts ? new Date(ts).toISOString() : '',
              fullName:  (data2[i][9]  || '').toString(),
              pType:     (data2[i][7]  || '').toString(),
              grade:     (data2[i][12] || '').toString(),
              category:  (data2[i][13] || '').toString(),
              status:    'Submitted',
            });
          }
        }
      }
    }
  } else if (source === 'zone') {
    var sheet3 = openSheet_(TAB_ZONE_SUB);
    if (sheet3) {
      var lastRow3 = sheet3.getLastRow();
      if (lastRow3 >= 2) {
        var data3 = sheet3.getRange(2, 1, lastRow3 - 1, 14).getValues();
        for (var j = 0; j < data3.length; j++) {
          // Col E (index 4) = Phone
          var rowPhone3 = (data3[j][4] || '').toString().toLowerCase().trim();
          if (rowPhone3 === normalizedPhone) {
            var ts3 = data3[j][0];
            rows.push({
              refNumber: (data3[j][1]  || '').toString(),
              timestamp: ts3 ? new Date(ts3).toISOString() : '',
              fullName:  (data3[j][9]  || '').toString(),
              pType:     (data3[j][7]  || '').toString(),
              grade:     (data3[j][12] || '').toString(),
              category:  (data3[j][13] || '').toString(),
              status:    'Submitted',
            });
          }
        }
      }
    }
  }

  // Sort newest first
  rows.sort(function(a, b) {
    return (b.timestamp > a.timestamp) ? 1 : (b.timestamp < a.timestamp) ? -1 : 0;
  });

  // Attach correction status from Tab 5 (graceful if tab doesn't exist yet)
  var correctionMap = {};
  try { correctionMap = getMyCorrections_(normalizedPhone); } catch (_) {}
  for (var k = 0; k < rows.length; k++) {
    var cr = correctionMap[rows[k].refNumber];
    rows[k].correctionStatus    = cr ? cr.status    : null;
    rows[k].correctionRequestId = cr ? cr.requestId : null;
  }

  return { status: 'ok', rows: rows };
}

// ── getWelcomeStats_ ──────────────────────────────────────────
// Returns submission counts by type for the welcome screen.
// School role → counts from Tab 2 filtered by phone.
// Zone role   → counts from Tab 3 filtered by zone + unique school list.
function getWelcomeStats_(payload) {
  var auth = checkRegistration(payload.phone);
  if (!auth.found) return { status: 'error', message: 'Unauthorized.' };

  var role   = auth.role;
  var result = { status: 'ok', role: role };

  if (role === 'School' || role === 'District') {
    var sheet2 = openSheet_(TAB_SCHOOL_SUB);
    var inn = 0, acad = 0, skill = 0;
    if (sheet2 && sheet2.getLastRow() >= 2) {
      var phone  = trim_(auth.phone);
      var data2  = sheet2.getRange(2, 1, sheet2.getLastRow() - 1, 8).getValues();
      for (var i = 0; i < data2.length; i++) {
        if (trim_(data2[i][6]) !== phone) continue;   // col G = phone
        var pt = (data2[i][7] || '').toString();       // col H = participant type
        if (pt.indexOf('Technical Skills') !== -1)                   skill++;
        else if (pt.indexOf('Academics') !== -1 || pt.indexOf('Quiz') !== -1) acad++;
        else                                                          inn++;
      }
    }
    result.innovations = inn;
    result.academics   = acad;
    result.skills      = skill;
    result.total       = inn + acad + skill;

  } else if (role === 'Zone') {
    var sheet3 = openSheet_(TAB_ZONE_SUB);
    var zInn = 0, zAcad = 0, zSkill = 0;
    var submittedMap = {};
    if (sheet3 && sheet3.getLastRow() >= 2) {
      var zoneName = trim_(auth.zone);
      var data3    = sheet3.getRange(2, 1, sheet3.getLastRow() - 1, 8).getValues();
      for (var j = 0; j < data3.length; j++) {
        if (trim_(data3[j][2]) !== zoneName) continue;  // col C = zone
        var school = (data3[j][5] || '').toString().trim();  // col F = participant school
        if (school) submittedMap[school] = true;
        var zpt = (data3[j][7] || '').toString();            // col H = participant type
        if (zpt.indexOf('Technical Skills') !== -1)                        zSkill++;
        else if (zpt.indexOf('Academics') !== -1 || zpt.indexOf('Quiz') !== -1) zAcad++;
        else                                                                zInn++;
      }
    }
    result.innovations      = zInn;
    result.academics        = zAcad;
    result.skills           = zSkill;
    result.total            = zInn + zAcad + zSkill;
    result.submittedSchools = Object.keys(submittedMap);
  }

  return result;
}

// ── getProgressData_ ──────────────────────────────────────────
// Returns per-category innovation counts broken down by participant type
// (Learner / Teacher / Youth) plus academics by subject+level and skills by category.
// source='school' filters Tab 2 by phone; source='zone' filters Tab 3 by zone.
function getProgressData_(payload, auth) {
  var source = payload.source; // 'school' or 'zone'

  var CAT_KEYS = [
    'Agricultural Science Innovations',
    'Chemistry Innovations',
    'Physics & Renewable Energy Innovations',
    'Computer Science & Software Development Innovations',
    'Mathematics Innovations',
    'Medicine & Health Innovations',
    'Robotics & Artificial Intelligence Innovations',
    'Food Science, Technology & Hospitality Innovations',
    'Environmental Sustainable Development Innovations'
  ];

  var innov = { learner: {}, teacher: {}, youth: {} };
  for (var ci = 0; ci < CAT_KEYS.length; ci++) {
    innov.learner[CAT_KEYS[ci]] = 0;
    innov.teacher[CAT_KEYS[ci]] = 0;
    innov.youth[CAT_KEYS[ci]]   = 0;
  }
  var academics = 0, skills = 0, total = 0;
  var academicsBySubjectLevel = {}; // key: "Level:Subject", value: count
  var skillsByCategory = {};        // key: skill category name, value: count

  if (source === 'school') {
    var sheet = openSheet_(TAB_SCHOOL_SUB);
    if (!sheet || sheet.getLastRow() < 2) {
      return { status: 'ok', innovations: innov, academics: 0, skills: 0, total: 0,
               academicsBySubjectLevel: {}, skillsByCategory: {} };
    }
    var matchPhone = trim_(auth.phone);
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 14).getValues();
    for (var i = 0; i < data.length; i++) {
      if (trim_(data[i][6]) !== matchPhone) continue; // col G = Phone
      total++;
      var pType = (data[i][7]  || '').toString();          // col H = Participant Type
      var level = (data[i][8]  || '').toString().trim();   // col I = Level
      var cat   = (data[i][13] || '').toString().trim();   // col N = Category
      if (pType.indexOf('Technical Skills') !== -1) {
        skills++;
        if (cat) skillsByCategory[cat] = (skillsByCategory[cat] || 0) + 1;
      } else if (pType.indexOf('Academics') !== -1 || pType.indexOf('Quiz') !== -1) {
        academics++;
        if (level && cat) {
          var slKey = level + ':' + cat;
          academicsBySubjectLevel[slKey] = (academicsBySubjectLevel[slKey] || 0) + 1;
        }
      } else if (pType === 'Teacher') {
        if (cat && innov.teacher.hasOwnProperty(cat)) innov.teacher[cat]++;
      } else if (pType.indexOf('Youth') !== -1 || pType.indexOf('Out-of-School') !== -1) {
        if (cat && innov.youth.hasOwnProperty(cat)) innov.youth[cat]++;
      } else {
        if (cat && innov.learner.hasOwnProperty(cat)) innov.learner[cat]++;
      }
    }

  } else if (source === 'zone') {
    var sheet3 = openSheet_(TAB_ZONE_SUB);
    if (!sheet3 || sheet3.getLastRow() < 2) {
      return { status: 'ok', innovations: innov, academics: 0, skills: 0, total: 0,
               academicsBySubjectLevel: {}, skillsByCategory: {} };
    }
    var zoneName = trim_(auth.zone);
    var data3 = sheet3.getRange(2, 1, sheet3.getLastRow() - 1, 14).getValues();
    for (var j = 0; j < data3.length; j++) {
      if (trim_(data3[j][2]) !== zoneName) continue;  // col C = Zone
      total++;
      var pType3 = (data3[j][7]  || '').toString();          // col H
      var level3 = (data3[j][8]  || '').toString().trim();   // col I = Level
      var cat3   = (data3[j][13] || '').toString().trim();   // col N
      if (pType3.indexOf('Technical Skills') !== -1) {
        skills++;
        if (cat3) skillsByCategory[cat3] = (skillsByCategory[cat3] || 0) + 1;
      } else if (pType3.indexOf('Academics') !== -1 || pType3.indexOf('Quiz') !== -1) {
        academics++;
        if (level3 && cat3) {
          var slKey3 = level3 + ':' + cat3;
          academicsBySubjectLevel[slKey3] = (academicsBySubjectLevel[slKey3] || 0) + 1;
        }
      } else if (pType3 === 'Teacher') {
        if (cat3 && innov.teacher.hasOwnProperty(cat3)) innov.teacher[cat3]++;
      } else if (pType3.indexOf('Youth') !== -1 || pType3.indexOf('Out-of-School') !== -1) {
        if (cat3 && innov.youth.hasOwnProperty(cat3)) innov.youth[cat3]++;
      } else {
        if (cat3 && innov.learner.hasOwnProperty(cat3)) innov.learner[cat3]++;
      }
    }
  }

  return {
    status: 'ok',
    innovations: innov,
    academics: academics,
    skills: skills,
    total: total,
    academicsBySubjectLevel: academicsBySubjectLevel,
    skillsByCategory: skillsByCategory,
  };
}

// ── Internal helpers ──────────────────────────────────────────
function openSheet_(tabName) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(tabName);
}

function trim_(val) {
  return (val || "").toString().toLowerCase().trim();
}

// Returns the spreadsheet column letter for a 1-based column number (A=1 … Z=26).
function colLetter_(n) {
  return String.fromCharCode(64 + n);
}
