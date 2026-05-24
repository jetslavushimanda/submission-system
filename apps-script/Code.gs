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
const TAB_REGISTERED = "Registered Schools";  // Tab 1
const TAB_SCHOOL_SUB = "School Submissions";  // Tab 2
const TAB_ZONE_SUB   = "Zone Submissions";    // Tab 3
const TAB_DASHBOARD  = "District Dashboard";  // Tab 4

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
      // Verify role before accepting — backend enforcement of access control.
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found) {
        result = { status: 'error', message: 'Access denied. Phone number not registered.' };
      } else if (authCheck.role !== 'School' && authCheck.role !== 'District') {
        result = { status: 'error', message: 'Access Denied. You are not authorised to submit School forms.' };
      } else {
        result = submitSchoolParticipant(payload);
        if (result.status === 'ok') updateDashboard_();
      }

    } else if (action === "submitZone") {
      // Verify role before accepting — backend enforcement of access control.
      var authCheck = checkRegistration(payload.phone);
      if (!authCheck.found) {
        result = { status: 'error', message: 'Access denied. Phone number not registered.' };
      } else if (authCheck.role !== 'Zone' && authCheck.role !== 'District') {
        result = { status: 'error', message: 'Access Denied. You are not authorised to submit Zone forms.' };
      } else {
        result = submitZoneParticipant(payload);
        if (result.status === 'ok') updateDashboard_();
      }

    } else if (action === "getCount") {
      // Inline: count Tab 2 rows for the requesting school
      result = getSchoolCount(payload);

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
