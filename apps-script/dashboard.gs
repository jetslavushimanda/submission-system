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
  var ss    = SpreadsheetApp.openById(SHEET_ID);
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
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"ECE")' +
      '+COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"Primary (Grade 1-7)")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"ECE")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"Primary (Grade 1-7)")';

    var fJunior =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"Junior Secondary (Form 1-2)")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"Junior Secondary (Form 1-2)")';

    var fSenior =
      '=COUNTIFS(' + SC + '!N:N,' + cr + ',' + SC + '!I:I,"Senior Secondary (Grade 10-12)")' +
      '+COUNTIFS(' + ZC + '!N:N,' + cr + ',' + ZC + '!I:I,"Senior Secondary (Grade 10-12)")';

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
