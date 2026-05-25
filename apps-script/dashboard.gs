// ═══════════════════════════════════════════════════════════════
// dashboard.gs — District Dashboard builder
// JETS 2024-2026 | Lavushimanda District
//
// Run buildDashboard() once from the Apps Script editor to
// write or fully refresh Tab 4. Safe to re-run at any time —
// it clears and rewrites the whole sheet.
//
// Depends on SHEET_ID and TAB_DASHBOARD defined in Code.gs.
// ═══════════════════════════════════════════════════════════════

var DB_GREEN_DARK  = '#1B5E20';
var DB_GREEN_MED   = '#2E7D32';
var DB_GREEN_LIGHT = '#E8F5E9';
var DB_WHITE       = '#FFFFFF';
var DB_STATUS_GREEN  = '#C8E6C9';
var DB_STATUS_YELLOW = '#FFF9C4';
var DB_STATUS_RED    = '#FFCDD2';

// ── Main entry point ──────────────────────────────────────────
function buildDashboard() {
  var ss    = getSpreadsheet_();
  var sheet = ss.getSheetByName(TAB_DASHBOARD);
  if (!sheet) sheet = ss.insertSheet(TAB_DASHBOARD);

  sheet.clearContents();
  sheet.clearFormats();
  sheet.setConditionalFormatRules([]);

  // Column widths
  sheet.setColumnWidth(1, 300);  // A — labels / school / category names
  sheet.setColumnWidth(2, 135);
  sheet.setColumnWidth(3, 135);
  sheet.setColumnWidth(4, 120);
  sheet.setColumnWidth(5, 115);
  sheet.setColumnWidth(6, 115);
  sheet.setColumnWidth(7, 125);

  var r = 1;

  // ─────────────────────────────────────────────────────────────
  // TITLE
  // ─────────────────────────────────────────────────────────────
  sheet.getRange(r, 1, 1, 7).merge()
    .setValue('JETS 2024–2026  |  Lavushimanda District Dashboard')
    .setBackground(DB_GREEN_DARK).setFontColor(DB_WHITE)
    .setFontSize(14).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(r, 44);
  r += 2;

  // ─────────────────────────────────────────────────────────────
  // SECTION A — COUNTERS
  // ─────────────────────────────────────────────────────────────
  dbSectionHeader_(sheet, r, 'A   COUNTERS'); r++;

  dbTableHeader_(sheet, r, ['Metric', 'Count'], 2); r++;

  var counters = [
    ['Total School Submissions',
     "=COUNTA('School Submissions'!B2:B)"],
    ['Total Zone Submissions',
     "=COUNTA('Zone Submissions'!B2:B)"],
    ['Schools That Have Submitted (unique)',
     "=IFERROR(COUNTA(UNIQUE(FILTER('School Submissions'!D2:D,'School Submissions'!D2:D<>\"\"))),0)"],
    ['Schools That Have NOT Submitted',
     "=COUNTA('Registered Schools'!B2:B)-IFERROR(COUNTA(UNIQUE(FILTER('School Submissions'!D2:D,'School Submissions'!D2:D<>\"\"))),0)"],
  ];
  counters.forEach(function(item, i) {
    var bg = i % 2 === 0 ? DB_WHITE : DB_GREEN_LIGHT;
    sheet.getRange(r, 1).setValue(item[0]).setBackground(bg).setVerticalAlignment('middle');
    sheet.getRange(r, 2).setFormula(item[1]).setBackground(bg)
      .setHorizontalAlignment('center').setFontWeight('bold').setFontSize(11);
    sheet.setRowHeight(r, 24);
    r++;
  });
  r++;

  // ─────────────────────────────────────────────────────────────
  // SECTION B — SUBMISSIONS BY ZONE
  // ─────────────────────────────────────────────────────────────
  dbSectionHeader_(sheet, r, 'B   SUBMISSIONS BY ZONE'); r++;

  dbTableHeader_(sheet, r,
    ['Zone', 'School Submissions', 'Zone Submissions', 'Total'], 4); r++;

  var zones = ['Mpumba', 'Chiundaponde', 'Lukulu', 'Kalonje', 'Mwelushi'];
  var bStart = r;
  zones.forEach(function(zone, i) {
    var bg = i % 2 === 0 ? DB_WHITE : DB_GREEN_LIGHT;
    sheet.getRange(r, 1).setValue(zone).setBackground(bg).setFontWeight('bold');
    sheet.getRange(r, 2).setFormula("=COUNTIF('School Submissions'!C:C,A" + r + ")")
      .setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 3).setFormula("=COUNTIF('Zone Submissions'!C:C,A" + r + ")")
      .setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 4).setFormula("=B" + r + "+C" + r)
      .setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.setRowHeight(r, 22);
    r++;
  });
  dbTotalsRow_(sheet, r, ['TOTALS',
    '=SUM(B' + bStart + ':B' + (r-1) + ')',
    '=SUM(C' + bStart + ':C' + (r-1) + ')',
    '=SUM(D' + bStart + ':D' + (r-1) + ')'], 4);
  r += 2;

  // ─────────────────────────────────────────────────────────────
  // SECTION C — SUBMISSIONS BY CATEGORY
  // ─────────────────────────────────────────────────────────────
  dbSectionHeader_(sheet, r, 'C   SUBMISSIONS BY CATEGORY'); r++;

  dbTableHeader_(sheet, r,
    ['Category', 'Primary', 'Junior Secondary', 'Senior Secondary',
     'Teacher', 'Out-of-School Youth', 'Total'], 7); r++;

  var categories = [
    // Learner Innovation
    'Agricultural Science Innovations',
    'Chemistry Innovations',
    'Physics & Renewable Energy Innovations',
    'Computer Science & Software Development Innovations',
    'Mathematics Innovations',
    'Medicine & Health Innovations',
    'Robotics & Artificial Intelligence Innovations',
    'Food Science, Technology & Hospitality Innovations',
    'Environmental Sustainable Development Innovations',
    // Academics
    'Quiz & Olympiads - Mathematics',
    'Quiz & Olympiads - Science',
    'Quiz & Olympiads - CTS',
    'Quiz & Olympiads - Physics/Mathematics',
    'Quiz & Olympiads - Biology/Chemistry',
    // Technical Skills
    'Civil Engineering',
    'Mechanical Engineering',
    'Electronics Services',
    'Fashion Technology',
    'Cosmetology',
  ];

  var cStart = r;
  var SC = "'School Submissions'";
  var ZC = "'Zone Submissions'";

  categories.forEach(function(cat, i) {
    var bg  = i % 2 === 0 ? DB_WHITE : DB_GREEN_LIGHT;
    var cr  = 'A' + r;

    var fPrimary =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"ECE & Primary")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"ECE & Primary")';

    var fJunior =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"Junior Secondary")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"Junior Secondary")';

    var fSenior =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"Senior Secondary")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"Senior Secondary")';

    var fTeacher =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!H:H,"Teacher")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!H:H,"Teacher")';

    var fYouth =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!H:H,"Out-of-School Youth")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!H:H,"Out-of-School Youth")';

    sheet.getRange(r, 1).setValue(cat).setBackground(bg);
    sheet.getRange(r, 2).setFormula(fPrimary).setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 3).setFormula(fJunior).setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 4).setFormula(fSenior).setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 5).setFormula(fTeacher).setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 6).setFormula(fYouth).setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 7).setFormula('=SUM(B' + r + ':F' + r + ')')
      .setBackground(bg).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.setRowHeight(r, 22);
    r++;
  });
  dbTotalsRow_(sheet, r, ['TOTALS',
    '=SUM(B' + cStart + ':B' + (r-1) + ')',
    '=SUM(C' + cStart + ':C' + (r-1) + ')',
    '=SUM(D' + cStart + ':D' + (r-1) + ')',
    '=SUM(E' + cStart + ':E' + (r-1) + ')',
    '=SUM(F' + cStart + ':F' + (r-1) + ')',
    '=SUM(G' + cStart + ':G' + (r-1) + ')'], 7);
  r += 2;

  // ─────────────────────────────────────────────────────────────
  // SECTION D — SCHOOL SUBMISSION STATUS
  // ─────────────────────────────────────────────────────────────
  dbSectionHeader_(sheet, r, 'D   SCHOOL SUBMISSION STATUS'); r++;

  dbTableHeader_(sheet, r,
    ['Zone', 'School', 'School Type', 'Expected Slots', 'Submitted', 'Remaining', 'Status'], 7); r++;

  var schools = [
    // [zone, name, type, slots]
    ['Mpumba', 'Mununga Primary',              'Primary School',     30],
    ['Mpumba', 'Mpumba Primary',               'Primary School',     30],
    ['Mpumba', 'Mwenda Primary',               'Primary School',     30],
    ['Mpumba', 'Kapengwe Open Centre',         'Open Centre School', 53],
    ['Mpumba', 'Salamo Primary',               'Primary School',     30],
    ['Mpumba', 'Tubondo Primary',              'Primary School',     30],
    ['Mpumba', 'Muchelenje Open Centre',       'Open Centre School', 53],
    ['Mpumba', 'Mununga Secondary',            'Secondary School',   52],
    ['Mpumba', 'Salamo Secondary',             'Secondary School',   52],
    ['Mpumba', 'Red Rhino Secondary',          'Secondary School',   52],
    ['Mpumba', 'Khem Private School',          'Private School',     52],
    ['Mpumba', 'St. Rochester Private School', 'Private School',     52],

    ['Chiundaponde', 'Chiundaponde Primary',   'Primary School',     30],
    ['Chiundaponde', 'Lulimala Primary',       'Primary School',     30],
    ['Chiundaponde', 'Chifinshi Primary',      'Primary School',     30],
    ['Chiundaponde', 'Makanga Primary',        'Primary School',     30],
    ['Chiundaponde', 'Ngweshi Primary',        'Primary School',     30],
    ['Chiundaponde', 'Chiundaponde Secondary', 'Secondary School',   52],

    ['Lukulu', 'Kapololo Primary',  'Primary School',   30],
    ['Lukulu', 'Kapwanya Primary',  'Primary School',   30],
    ['Lukulu', 'Mabonga Primary',   'Primary School',   30],
    ['Lukulu', 'Lukulu Primary',    'Primary School',   30],
    ['Lukulu', 'Nsansha Primary',   'Primary School',   30],
    ['Lukulu', 'Mpomfu Primary',    'Primary School',   30],
    ['Lukulu', 'Chito Primary',     'Primary School',   30],
    ['Lukulu', 'Lukulu Secondary',  'Secondary School', 52],

    ['Kalonje', 'Mupamadzi Open Centre',    'Open Centre School', 53],
    ['Kalonje', 'Chilebela Primary',        'Primary School',     30],
    ['Kalonje', 'Kamwendo Primary',         'Primary School',     30],
    ['Kalonje', 'Mutumba Community School', 'Community School',   30],
    ['Kalonje', 'Kalonje Primary',          'Primary School',     30],
    ['Kalonje', 'Mabyulu Primary',          'Primary School',     30],
    ['Kalonje', 'Finkuli Open Centre',      'Open Centre School', 53],
    ['Kalonje', 'Kalonje Secondary',        'Secondary School',   52],

    ['Mwelushi', 'Mwila Chilembwe Primary', 'Primary School',     30],
    ['Mwelushi', 'Mwendachabe Primary',     'Primary School',     30],
    ['Mwelushi', 'Chipelembe Primary',      'Primary School',     30],
    ['Mwelushi', 'Kapilya Open Centre',     'Open Centre School', 53],
    ['Mwelushi', 'Mwelushi Primary',        'Primary School',     30],
    ['Mwelushi', 'Muwele Primary',          'Primary School',     30],
    ['Mwelushi', 'Milomfi Primary',         'Primary School',     30],
    ['Mwelushi', 'Chibali Primary',         'Primary School',     30],
  ];

  var dStart = r;
  schools.forEach(function(s, i) {
    var bg        = i % 2 === 0 ? DB_WHITE : DB_GREEN_LIGHT;
    var schoolLit = '"' + s[1] + '"';
    var expRef    = 'D' + r;
    var subRef    = 'E' + r;

    sheet.getRange(r, 1).setValue(s[0]).setBackground(bg);
    sheet.getRange(r, 2).setValue(s[1]).setBackground(bg);
    sheet.getRange(r, 3).setValue(s[2]).setBackground(bg);
    sheet.getRange(r, 4).setValue(s[3]).setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 5)
      .setFormula("=COUNTIF('School Submissions'!D:D," + schoolLit + ")")
      .setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 6)
      .setFormula('=MAX(0,' + expRef + '-' + subRef + ')')
      .setBackground(bg).setHorizontalAlignment('center');
    sheet.getRange(r, 7)
      .setFormula('=IF(' + subRef + '=0,"Not Started",IF(' + subRef + '>=' + expRef + ',"Complete","In Progress"))')
      .setHorizontalAlignment('center').setFontWeight('bold');
    sheet.setRowHeight(r, 22);
    r++;
  });

  // Conditional formatting on Status column (G)
  var statusRange = sheet.getRange('G' + dStart + ':G' + (r - 1));
  var cfRules = [];
  cfRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Complete')
    .setBackground(DB_STATUS_GREEN).setFontColor('#1B5E20')
    .setRanges([statusRange]).build());
  cfRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('In Progress')
    .setBackground(DB_STATUS_YELLOW).setFontColor('#F57F17')
    .setRanges([statusRange]).build());
  cfRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Not Started')
    .setBackground(DB_STATUS_RED).setFontColor('#B71C1C')
    .setRanges([statusRange]).build());
  sheet.setConditionalFormatRules(cfRules);
  r++;

  // ─────────────────────────────────────────────────────────────
  // SECTION E — RECENT 20 SUBMISSIONS
  // ─────────────────────────────────────────────────────────────
  dbSectionHeader_(sheet, r,
    'E   RECENT 20 SUBMISSIONS  (School + Zone combined, newest first)'); r++;

  dbTableHeader_(sheet, r,
    ['Timestamp', 'Ref #', 'Zone', 'School', 'Participant Type', 'Full Name', 'Category'], 7); r++;

  // VSTACK School Submissions cols A B C D H J N  +
  //        Zone Submissions   cols A B C F H J N
  // SORT by Timestamp (col 1) descending, cap at 20 rows.
  var recentFormula =
    '=IFERROR(ARRAY_CONSTRAIN(SORT(VSTACK(' +
      'IFERROR(FILTER(CHOOSE({1,2,3,4,5,6,7},' +
        SC + '!A2:A,' + SC + '!B2:B,' + SC + '!C2:C,' +
        SC + '!D2:D,' + SC + '!H2:H,' + SC + '!J2:J,' + SC + '!N2:N),' +
        SC + '!B2:B<>""),{"","","","","","",""}),' +
      'IFERROR(FILTER(CHOOSE({1,2,3,4,5,6,7},' +
        ZC + '!A2:A,' + ZC + '!B2:B,' + ZC + '!C2:C,' +
        ZC + '!F2:F,' + ZC + '!H2:H,' + ZC + '!J2:J,' + ZC + '!N2:N),' +
        ZC + '!B2:B<>""),{"","","","","","",""})' +
    '),1,FALSE),20,7),"")';

  sheet.getRange(r, 1).setFormula(recentFormula);
  sheet.getRange(r, 1, 20, 1).setNumberFormat('dd-mmm-yyyy hh:mm');

  for (var i = 0; i < 20; i++) {
    sheet.getRange(r + i, 1, 1, 7)
      .setBackground(i % 2 === 0 ? DB_WHITE : DB_GREEN_LIGHT);
    sheet.setRowHeight(r + i, 22);
  }

  Logger.log('buildDashboard complete. Last content row: ' + (r + 19));
}

// ── Helpers ───────────────────────────────────────────────────

function dbSectionHeader_(sheet, row, label) {
  sheet.getRange(row, 1, 1, 7).merge()
    .setValue(label)
    .setBackground(DB_GREEN_DARK).setFontColor(DB_WHITE)
    .setFontSize(11).setFontWeight('bold')
    .setVerticalAlignment('middle');
  sheet.setRowHeight(row, 30);
}

function dbTableHeader_(sheet, row, labels, cols) {
  for (var c = 0; c < 7; c++) {
    var cell = sheet.getRange(row, c + 1)
      .setBackground(DB_GREEN_MED).setFontColor(DB_WHITE)
      .setFontWeight('bold').setVerticalAlignment('middle');
    if (c < cols) {
      cell.setValue(labels[c])
        .setHorizontalAlignment(c === 0 ? 'left' : 'center');
    }
  }
  sheet.setRowHeight(row, 26);
}

function dbTotalsRow_(sheet, row, values, cols) {
  for (var c = 0; c < 7; c++) {
    var cell = sheet.getRange(row, c + 1)
      .setBackground(DB_GREEN_MED).setFontColor(DB_WHITE).setFontWeight('bold');
    if (c === 0) {
      cell.setValue(values[0]);
    } else if (c < cols) {
      cell.setFormula(values[c]).setHorizontalAlignment('center');
    }
  }
  sheet.setRowHeight(row, 24);
}

// ═══════════════════════════════════════════════════════════════
// getFullDashboard_ — JSON payload for the frontend District Dashboard.
// Called by Code.gs doPost when action === 'getFullDashboard'.
// ═══════════════════════════════════════════════════════════════
function getFullDashboard_() {
  var tz = Session.getScriptTimeZone();
  var todayStr = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var ss   = getSpreadsheet_();
  var tab1 = ss.getSheetByName(TAB_REGISTERED);
  var tab2 = ss.getSheetByName(TAB_SCHOOL_SUB);
  var tab3 = ss.getSheetByName(TAB_ZONE_SUB);

  // ── Tab 1: registries ──────────────────────────────────────
  var reg = (tab1 && tab1.getLastRow() > 1)
    ? tab1.getRange(2, 1, tab1.getLastRow() - 1, 7).getValues() : [];

  var schoolReg  = {};  // schoolName → {zone,type,status}
  var coordReg   = {};  // zone → {name,phone}

  for (var i = 0; i < reg.length; i++) {
    var rZone = (reg[i][0] || '').toString().trim();
    var rName = (reg[i][1] || '').toString().trim();
    var rType = (reg[i][2] || '').toString().trim();
    var rOrg  = (reg[i][3] || '').toString().trim();
    var rPh   = (reg[i][4] || '').toString().trim();
    var rRole = (reg[i][5] || '').toString().trim();
    var rStat = (reg[i][6] || '').toString().trim();
    if (rRole === 'School') {
      schoolReg[rName] = { zone: rZone, type: rType, status: rStat };
    } else if (rRole === 'Zone') {
      coordReg[rZone] = { name: rOrg, phone: rPh };
    }
  }

  // ── Tab 2 & 3: raw rows ────────────────────────────────────
  var s2 = (tab2 && tab2.getLastRow() > 1)
    ? tab2.getRange(2, 1, tab2.getLastRow() - 1, 19).getValues() : [];
  var s3 = (tab3 && tab3.getLastRow() > 1)
    ? tab3.getRange(2, 1, tab3.getLastRow() - 1, 19).getValues() : [];

  // ── Overview ───────────────────────────────────────────────
  var totalSubmissions = s2.length + s3.length;
  var todayCount = 0;
  var schoolSubCounts = {};   // schoolName → count (Tab 2)
  var schoolsStarted  = {};   // schoolName → true (any submission)

  for (var i = 0; i < s2.length; i++) {
    var ts  = s2[i][0];
    var sch = (s2[i][3] || '').toString().trim();
    if (ts) {
      if (Utilities.formatDate(new Date(ts), tz, 'yyyy-MM-dd') === todayStr) todayCount++;
    }
    if (sch) { schoolSubCounts[sch] = (schoolSubCounts[sch] || 0) + 1; schoolsStarted[sch] = true; }
  }
  for (var i = 0; i < s3.length; i++) {
    var ts = s3[i][0];
    if (ts && Utilities.formatDate(new Date(ts), tz, 'yyyy-MM-dd') === todayStr) todayCount++;
  }

  var regNames = Object.keys(schoolReg);
  var schoolsTotal     = regNames.length;
  var schoolsSubmitted = 0;
  for (var i = 0; i < regNames.length; i++) { if (schoolsStarted[regNames[i]]) schoolsSubmitted++; }

  // ── Zone progress ──────────────────────────────────────────
  var ZONE_NAMES = ['Mpumba', 'Chiundaponde', 'Lukulu', 'Kalonje', 'Mwelushi'];
  var zoneSubMap = {};
  for (var z = 0; z < ZONE_NAMES.length; z++) { zoneSubMap[ZONE_NAMES[z]] = { cnt: 0, schools: {} }; }

  for (var i = 0; i < s3.length; i++) {
    var zn  = (s3[i][2] || '').toString().trim();
    var sch = (s3[i][5] || '').toString().trim();
    if (zoneSubMap[zn]) {
      zoneSubMap[zn].cnt++;
      if (sch) zoneSubMap[zn].schools[sch] = (zoneSubMap[zn].schools[sch] || 0) + 1;
    }
  }

  var zones = [];
  for (var z = 0; z < ZONE_NAMES.length; z++) {
    var zn   = ZONE_NAMES[z];
    var zd   = zoneSubMap[zn];
    var coord = coordReg[zn] || { name: '', phone: '' };
    var submitted = zd.cnt;
    var pct    = Math.min(100, Math.round((submitted / 64) * 100));
    var status = submitted === 0 ? 'Not Started' : (submitted >= 64 ? 'Complete' : 'In Progress');

    // schools list for this zone
    var zSchools = {};
    var zsKeys = Object.keys(zd.schools);
    for (var k = 0; k < zsKeys.length; k++) {
      zSchools[zsKeys[k]] = { zoneCount: zd.schools[zsKeys[k]], schoolCount: schoolSubCounts[zsKeys[k]] || 0 };
    }
    for (var i = 0; i < regNames.length; i++) {
      var sn = regNames[i];
      if (schoolReg[sn].zone === zn && !zSchools[sn]) {
        zSchools[sn] = { zoneCount: 0, schoolCount: schoolSubCounts[sn] || 0 };
      }
    }
    var schoolsArr = [];
    var snKeys = Object.keys(zSchools);
    for (var k = 0; k < snKeys.length; k++) {
      var sn  = snKeys[k];
      var inf = schoolReg[sn] || { type: '' };
      var sc  = zSchools[sn].schoolCount;
      var zc  = zSchools[sn].zoneCount;
      schoolsArr.push({ name: sn, type: inf.type || '', schoolCount: sc, zoneCount: zc, submitted: sc + zc });
    }
    schoolsArr.sort(function(a, b) { return a.name < b.name ? -1 : 1; });

    zones.push({ name: zn, coordinator: coord.name, phone: coord.phone,
                 submitted: submitted, max: 64, pct: pct, status: status, schools: schoolsArr });
  }

  // ── School list ────────────────────────────────────────────
  var schoolList = [];
  for (var i = 0; i < regNames.length; i++) {
    var sn   = regNames[i];
    var info = schoolReg[sn];
    var sc   = schoolSubCounts[sn] || 0;
    schoolList.push({ name: sn, zone: info.zone, type: info.type,
                      submitted: sc, hasStarted: sc > 0 });
  }
  schoolList.sort(function(a, b) {
    return a.zone < b.zone ? -1 : a.zone > b.zone ? 1 : a.name < b.name ? -1 : 1;
  });

  // ── All submissions (for school detail expand) ─────────────
  var allSubs = [];
  for (var i = 0; i < s2.length; i++) {
    var ts = s2[i][0];
    allSubs.push({
      time:        ts ? new Date(ts).toISOString() : '',
      source:      'School',
      zone:        (s2[i][2]  || '').toString().trim(),
      school:      (s2[i][3]  || '').toString().trim(),
      participant: (s2[i][9]  || '').toString().trim(),
      type:        (s2[i][7]  || '').toString().trim(),
      category:    (s2[i][13] || '').toString().trim(),
      ref:         (s2[i][1]  || '').toString().trim()
    });
  }
  for (var i = 0; i < s3.length; i++) {
    var ts = s3[i][0];
    allSubs.push({
      time:        ts ? new Date(ts).toISOString() : '',
      source:      'Zone',
      zone:        (s3[i][2]  || '').toString().trim(),
      school:      (s3[i][5]  || '').toString().trim(),
      participant: (s3[i][9]  || '').toString().trim(),
      type:        (s3[i][7]  || '').toString().trim(),
      category:    (s3[i][13] || '').toString().trim(),
      ref:         (s3[i][1]  || '').toString().trim()
    });
  }
  allSubs.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });

  // ── Category coverage ──────────────────────────────────────
  var coverage = {};
  for (var z = 0; z < ZONE_NAMES.length; z++) coverage[ZONE_NAMES[z]] = {};
  for (var i = 0; i < allSubs.length; i++) {
    var zn  = allSubs[i].zone;
    var cat = allSubs[i].category;
    if (zn && cat && coverage[zn] !== undefined) {
      coverage[zn][cat] = (coverage[zn][cat] || 0) + 1;
    }
  }

  // ── Skills tracker ─────────────────────────────────────────
  var SKILL_CATS  = ['Civil Engineering', 'Mechanical Engineering', 'Electronics Services', 'Fashion Technology', 'Cosmetology'];
  var SKILL_SLOTS = { 'Civil Engineering': 4, 'Mechanical Engineering': 4, 'Electronics Services': 2, 'Fashion Technology': 1, 'Cosmetology': 1 };
  var skillCounts = {};
  for (var i = 0; i < SKILL_CATS.length; i++) skillCounts[SKILL_CATS[i]] = 0;
  for (var i = 0; i < allSubs.length; i++) {
    var cat = allSubs[i].category;
    if (allSubs[i].type.indexOf('Technical Skills') !== -1 && cat && skillCounts[cat] !== undefined) skillCounts[cat]++;
  }
  var skills = [];
  for (var i = 0; i < SKILL_CATS.length; i++) {
    var c = SKILL_CATS[i];
    skills.push({ category: c, used: skillCounts[c], slots: SKILL_SLOTS[c] });
  }

  // ── All school records for Admin Panel ────────────────────
  var allSchoolRecords = [];
  for (var ari = 0; ari < reg.length; ari++) {
    var arRole = (reg[ari][5] || '').toString().trim();
    if (arRole === 'District') continue;
    allSchoolRecords.push({
      zone:      (reg[ari][0] || '').toString().trim(),
      name:      (reg[ari][1] || '').toString().trim(),
      type:      (reg[ari][2] || '').toString().trim(),
      organiser: (reg[ari][3] || '').toString().trim(),
      phone:     (reg[ari][4] || '').toString().trim(),
      role:      arRole,
      status:    (reg[ari][6] || 'Active').toString().trim(),
    });
  }

  // ── Export / Drive URLs ────────────────────────────────────
  var driveUrl  = DRIVE_FOLDER_ID ? 'https://drive.google.com/drive/folders/' + DRIVE_FOLDER_ID : '';
  var exportUrl = SHEET_ID ? 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=xlsx' : '';
  var exportS2Gid = tab2 ? tab2.getSheetId() : '';
  var exportS3Gid = tab3 ? tab3.getSheetId() : '';
  var exportSchoolUrl = SHEET_ID && exportS2Gid !== ''
    ? 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=xlsx&gid=' + exportS2Gid : exportUrl;
  var exportZoneUrl   = SHEET_ID && exportS3Gid !== ''
    ? 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?format=xlsx&gid=' + exportS3Gid : exportUrl;

  // ── Correction Requests (Tab 5) ────────────────────────────
  var corrections = [];
  try {
    var corrResult = getCorrectionRequests_();
    corrections = corrResult.corrections || [];
  } catch (_) {}

  return {
    status:   'ok',
    cachedAt: new Date().toISOString(),
    overview: {
      totalSubmissions:  totalSubmissions,
      schoolsSubmitted:  schoolsSubmitted,
      schoolsTotal:      schoolsTotal,
      schoolsNotStarted: Math.max(0, schoolsTotal - schoolsSubmitted),
      todaySubmissions:  todayCount
    },
    zones:       zones,
    schoolList:  schoolList,
    recentFeed:  allSubs.slice(0, 20),
    allSubs:     allSubs,
    coverage:    coverage,
    skills:      skills,
    corrections:      corrections,
    allSchoolRecords: allSchoolRecords,
    driveUrl:    driveUrl,
    exportUrl:       exportUrl,
    exportSchoolUrl: exportSchoolUrl,
    exportZoneUrl:   exportZoneUrl
  };
}

// ── getRecentFeed_ — lightweight 60-second feed refresh ───────
function getRecentFeed_() {
  var tab2 = openSheet_(TAB_SCHOOL_SUB);
  var tab3 = openSheet_(TAB_ZONE_SUB);
  var feed = [];

  function readRows(sheet, schoolIdx, isZone) {
    if (!sheet || sheet.getLastRow() < 2) return;
    var last  = sheet.getLastRow();
    var start = Math.max(2, last - 100);
    var data  = sheet.getRange(start, 1, last - start + 1, 14).getValues();
    for (var i = 0; i < data.length; i++) {
      var ts = data[i][0];
      if (!ts) continue;
      feed.push({
        time:        new Date(ts).toISOString(),
        source:      isZone ? 'Zone' : 'School',
        zone:        (data[i][2] || '').toString().trim(),
        school:      (data[i][schoolIdx] || '').toString().trim(),
        participant: (data[i][9] || '').toString().trim(),
        type:        (data[i][7] || '').toString().trim(),
        category:    (data[i][13] || '').toString().trim(),
        ref:         (data[i][1] || '').toString().trim()
      });
    }
  }

  readRows(tab2, 3, false);
  readRows(tab3, 5, true);
  feed.sort(function(a, b) { return new Date(b.time) - new Date(a.time); });
  return { status: 'ok', recentFeed: feed.slice(0, 20) };
}
