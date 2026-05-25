// ═══════════════════════════════════════════════════════════════
// corrections.gs — Correction request handling
// JETS 2024-2026 | Lavushimanda District
//
// Tab 5 ("Correction Requests") column layout:
//   A  Timestamp             B  Request ID
//   C  Reference Number      D  Coordinator Name
//   E  Phone                 F  School/Zone
//   G  What to Correct       H  Correct Information
//   I  Status                J  Decided By
//   K  Decision Timestamp    L  Source (school/zone)
//   M  Participant Name
//
// TAB_CORRECTIONS is declared in Code.gs.
// ═══════════════════════════════════════════════════════════════

// ── submitCorrectionRequest ───────────────────────────────────
// Entry point: action === "submitCorrectionRequest"
function submitCorrectionRequest(data) {
  var missing = validateCorrectionPayload_(data);
  if (missing) return { status: 'error', message: 'Missing required field: ' + missing };

  var sheet = openSheet_(TAB_CORRECTIONS);
  if (!sheet) {
    // Auto-create the tab if it doesn't exist yet (existing deployments)
    sheet = createCorrectionTab_();
    if (!sheet) return { status: 'error', message: 'Could not open or create Correction Requests tab.' };
  }

  var tsMs  = Date.now();
  var rand  = Math.floor(1000 + Math.random() * 9000);
  var reqId = 'COR-' + tsMs + '-' + rand;

  sheet.appendRow([
    new Date(),                        // A: Timestamp
    reqId,                             // B: Request ID
    data.refNumber        || '',       // C: Reference Number
    data.coordinatorName  || '',       // D: Coordinator Name
    data.phone            || '',       // E: Phone
    data.schoolOrZone     || '',       // F: School/Zone
    data.whatToCorrect    || '',       // G: What to Correct
    data.correctInfo      || '',       // H: Correct Information
    'Pending',                         // I: Status
    '',                                // J: Decided By
    '',                                // K: Decision Timestamp
    data.source           || '',       // L: Source (school/zone)
    data.participantName  || '',       // M: Participant Name
  ]);

  return { status: 'ok', requestId: reqId, message: 'Correction request submitted successfully.' };
}

function validateCorrectionPayload_(d) {
  if (!d.phone)         return 'phone';
  if (!d.refNumber)     return 'refNumber';
  if (!d.whatToCorrect) return 'whatToCorrect';
  if (!d.correctInfo)   return 'correctInfo';
  return null;
}

// ── getCorrectionRequests_ ────────────────────────────────────
// Returns all correction requests sorted: Pending first, then newest.
// Called from Code.gs for DEC-only "getCorrectionRequests" action,
// and from dashboard.gs getFullDashboard_.
function getCorrectionRequests_() {
  var sheet = openSheet_(TAB_CORRECTIONS);
  if (!sheet) return { status: 'ok', corrections: [] };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'ok', corrections: [] };

  var data        = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var corrections = [];

  for (var i = 0; i < data.length; i++) {
    corrections.push({
      requestId:       (data[i][1] || '').toString(),
      timestamp:       data[i][0] ? new Date(data[i][0]).toISOString() : '',
      refNumber:       (data[i][2] || '').toString(),
      coordinatorName: (data[i][3] || '').toString(),
      phone:           (data[i][4] || '').toString(),
      schoolOrZone:    (data[i][5] || '').toString(),
      whatToCorrect:   (data[i][6] || '').toString(),
      correctInfo:     (data[i][7] || '').toString(),
      status:          (data[i][8] || 'Pending').toString(),
      decidedBy:       (data[i][9] || '').toString(),
      source:          (data[i][11] || '').toString(),
      participantName: (data[i][12] || '').toString(),
    });
  }

  // Pending first, then newest first within each group
  corrections.sort(function(a, b) {
    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
    if (a.status !== 'Pending' && b.status === 'Pending') return  1;
    return b.timestamp > a.timestamp ? 1 : -1;
  });

  return { status: 'ok', corrections: corrections };
}

// ── getMyCorrections_ ─────────────────────────────────────────
// Returns a map of { refNumber → { requestId, status, decidedBy } }
// for a given phone number. Used by getSubmissionHistory_ to attach
// correction status to each submission row.
function getMyCorrections_(phone) {
  var sheet = openSheet_(TAB_CORRECTIONS);
  if (!sheet) return {};

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};

  var data  = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var byRef = {};
  var norm  = (phone || '').toString().toLowerCase().trim();

  for (var i = 0; i < data.length; i++) {
    var rowPhone = (data[i][4] || '').toString().toLowerCase().trim();
    if (rowPhone !== norm) continue;
    var ref = (data[i][2] || '').toString();
    if (!ref) continue;
    // Keep the most recent correction for this refNumber
    byRef[ref] = {
      requestId: (data[i][1] || '').toString(),
      status:    (data[i][8] || 'Pending').toString(),
      decidedBy: (data[i][9] || '').toString(),
    };
  }

  return byRef;
}

// ── handleCorrectionDecision_ ─────────────────────────────────
// APPROVE or REJECT a correction request. DEC only.
// decision: "Approved" | "Rejected"
function handleCorrectionDecision_(requestId, decision, deciderName) {
  var sheet = openSheet_(TAB_CORRECTIONS);
  if (!sheet) return { status: 'error', message: 'Correction Requests tab not found.' };

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { status: 'error', message: 'No correction requests found.' };

  var data      = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var targetRow = -1;
  var refNumber = '';
  var source    = '';

  for (var i = 0; i < data.length; i++) {
    if ((data[i][1] || '').toString() === requestId) {
      targetRow = i + 2;
      refNumber = (data[i][2]  || '').toString();
      source    = (data[i][11] || '').toString();
      break;
    }
  }

  if (targetRow < 0) {
    return { status: 'error', message: 'Correction request not found: ' + requestId };
  }

  sheet.getRange(targetRow, 9).setValue(decision);           // I: Status
  sheet.getRange(targetRow, 10).setValue(deciderName || ''); // J: Decided By
  sheet.getRange(targetRow, 11).setValue(new Date());        // K: Decision Timestamp

  if (decision === 'Approved' && refNumber) {
    flagOriginalRow_(refNumber, source);
  }

  return { status: 'ok', message: 'Decision recorded: ' + decision };
}

// ── flagOriginalRow_ ──────────────────────────────────────────
// Writes "Yes" in column T of the original submission row when Approved.
function flagOriginalRow_(refNumber, source) {
  var tabName = source === 'zone' ? TAB_ZONE_SUB : TAB_SCHOOL_SUB;
  var sheet   = openSheet_(tabName);
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  var refs = sheet.getRange(2, 2, lastRow - 1, 1).getValues(); // col B = Ref#
  for (var i = 0; i < refs.length; i++) {
    if ((refs[i][0] || '').toString() === refNumber) {
      sheet.getRange(i + 2, 20).setValue('Yes'); // col T = Corrected
      return;
    }
  }
}

// ── createCorrectionTab_ ──────────────────────────────────────
// Creates the "Correction Requests" tab if it doesn't exist.
// Called automatically on first correction submission for existing deployments.
function createCorrectionTab_() {
  try {
    var tab = ss.insertSheet(TAB_CORRECTIONS);
    var h   = [
      'Timestamp', 'Request ID', 'Reference Number', 'Coordinator Name', 'Phone',
      'School/Zone', 'What to Correct', 'Correct Information', 'Status',
      'Decided By', 'Decision Timestamp', 'Source', 'Participant Name'
    ];
    tab.getRange(1, 1, 1, h.length).setValues([h]);
    tab.getRange(1, 1, 1, h.length)
      .setBackground('#1a5c2a').setFontColor('#ffffff').setFontWeight('bold');
    tab.setFrozenRows(1);
    tab.autoResizeColumns(1, h.length);
    return tab;
  } catch (err) {
    Logger.log('createCorrectionTab_ failed: ' + err.message);
    return null;
  }
}
