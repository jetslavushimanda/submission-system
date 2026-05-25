// ═══════════════════════════════════════════════════════════════
// zone.gs — Zonal JETS Coordinator form submissions
// JETS 2024-2026 | Lavushimanda District
//
// Tab 3 ("Zone Submissions") column layout:
//   A  Timestamp              B  Ref#
//   C  Zone                   D  Zonal Coordinator
//   E  Phone                  F  Participant School
//   G  School Type            H  Participant Type
//   I  Level                  J  Full Name
//   K  Age                    L  Sex
//   M  Grade                  N  Category
//   O  Sub-Skill              P  Innovation Title
//   Q  Supervising Teacher/Mentor
//   R  Report Drive Link      S  Submitted By
//
// SHEET_ID, DRIVE_FOLDER_ID, TAB_ZONE_SUB, openSheet_()
// are defined in Code.gs and shared across all .gs files.
// ═══════════════════════════════════════════════════════════════

// ── submitZoneParticipant ─────────────────────────────────────
// Entry point called by Code.gs when action === "submitZone".
function submitZoneParticipant(data) {

  // 1. Validate required fields
  var missing = validateZonePayload_(data);
  if (missing) {
    return { status: 'error', message: 'Missing required field: ' + missing };
  }

  // 1.5 Check slot availability & duplicates
  var check = checkZoneSlotAndDuplicate_(data);
  if (!check.allowed) {
    return { status: check.reason, refNumber: check.ref, message: check.message };
  }

  // 2. Generate reference number: ZON-[timestamp ms]-[random 4 digits]
  var tsMs = data.timestamp ? new Date(data.timestamp).getTime() : Date.now();
  var rand = Math.floor(1000 + Math.random() * 9000);
  var refNumber = 'ZON-' + tsMs + '-' + rand;

  // 3. Upload report to Drive (if provided)
  var driveUrl = '';
  if (data.reportFileBase64) {
    driveUrl = saveZoneReport_(data);
  }

  // 4. Append row to Tab 3
  var sheet = openSheet_(TAB_ZONE_SUB);
  if (!sheet) {
    return { status: 'error', message: 'Could not open sheet tab: ' + TAB_ZONE_SUB };
  }

  // Column H: merge participantType + learnerSubType for learners
  var pTypeLabel = data.participantType || '';
  if (pTypeLabel === 'Learner' && data.learnerSubType) {
    pTypeLabel = 'Learner — ' + data.learnerSubType;
  }

  // Column Q: supervising teacher (learner) or mentor (youth)
  var supervisorMentor = data.supervisingTeacher || data.mentorName || data.mentor || '';

  sheet.appendRow([
    new Date(),                         // A: Timestamp
    refNumber,                          // B: Ref#
    data.zone              || '',       // C: Zone
    data.coordinatorName   || '',       // D: Zonal Coordinator
    data.phone             || '',       // E: Phone
    data.participantSchool || '',       // F: Participant School
    data.schoolType        || '',       // G: School Type
    pTypeLabel,                         // H: Participant Type
    data.level             || '',       // I: Level
    data.fullName          || '',       // J: Full Name
    data.age               || '',       // K: Age
    data.sex               || '',       // L: Sex
    data.gradeForm         || '',       // M: Grade
    data.category          || '',       // N: Category
    data.subSkill          || '',       // O: Sub-Skill
    data.titleOfInnovation || '',       // P: Innovation Title
    supervisorMentor,                   // Q: Supervising Teacher/Mentor
    driveUrl,                           // R: Report Drive Link
    data.submittedBy       || '',       // S: Submitted By
  ]);

  // 5. Return success
  return {
    status:    'ok',
    success:   true,
    refNumber: refNumber,
    message:   'Participant submitted successfully',
  };
}

// ── Validation ────────────────────────────────────────────────
// Returns the name of the first missing required field, or null.
function validateZonePayload_(d) {
  if (!d.zone)              return 'zone';
  if (!d.coordinatorName)   return 'coordinatorName';
  if (!d.phone)             return 'phone';
  if (!d.participantSchool) return 'participantSchool';
  if (!d.participantType)   return 'participantType';
  if (!d.fullName)          return 'fullName';
  if (!d.sex)               return 'sex';
  if (!d.submittedBy)       return 'submittedBy';
  return null;
}

// ── Drive: get or create a named child folder ─────────────────
function getOrCreateZoneFolder_(parent, name) {
  var iter = parent.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : parent.createFolder(name);
}

// ── Drive: save report into Zone Submissions/[Zone]/ ──────────
// Returns the shareable URL, or "" on failure (submission still saves).
function saveZoneReport_(data) {
  try {
    var root = DRIVE_FOLDER_ID
      ? DriveApp.getFolderById(DRIVE_FOLDER_ID)
      : DriveApp.getRootFolder();

    var zone   = (data.zone              || 'Unknown').replace(/[\/\\]/g, '-');
    var school = (data.participantSchool || 'Unknown').replace(/[\/\\]/g, '-');

    var zonSubsFolder = getOrCreateZoneFolder_(root,          'Zone Submissions');
    var zoneFolder    = getOrCreateZoneFolder_(zonSubsFolder, zone);

    // Build filename: [Zone]_[School]_[Category]_[ParticipantName].[ext]
    var cat      = (data.category || 'Report').replace(/[\/\\:*?"<>|]/g, '-');
    var name     = (data.fullName || 'Participant').replace(/[\/\\:*?"<>|]/g, '-');
    var ext      = (data.reportFileName || '').split('.').pop() || 'bin';
    var fileName = zone + '_' + school + '_' + cat + '_' + name + '.' + ext;

    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.reportFileBase64),
      data.reportFileType || 'application/octet-stream',
      fileName
    );

    var file = zoneFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();

  } catch (err) {
    Logger.log('Zone report upload failed: ' + err.message);
    return '';
  }
}

// Helper to check slot and duplicate on backend for Zone
function checkZoneSlotAndDuplicate_(data) {
  var zoneName = data.zone;
  var fullName   = (data.fullName || '').toString().trim();
  var category   = (data.category || '').toString().trim();
  var level      = (data.level || '').toString().trim();
  var pType      = data.participantType || '';
  if (pType === 'Learner' && data.learnerSubType) {
    pType = 'Learner — ' + data.learnerSubType;
  }
  
  var sheet = openSheet_(TAB_ZONE_SUB);
  if (!sheet) return { allowed: true };
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { allowed: true };
  
  var values = sheet.getRange(2, 1, lastRow - 1, 15).getValues(); // Cols A-O
  
  var duplicateRef = null;
  var slotCount = 0;
  
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    // Col C: Zone, Col H: Participant Type, Col I: Level, Col J: Full Name, Col N: Category
    var rowZone   = (row[2] || '').toString().trim();
    var rowPType  = (row[7] || '').toString().trim();
    var rowLevel  = (row[8] || '').toString().trim();
    var rowName   = (row[9] || '').toString().trim();
    var rowCat    = (row[13] || '').toString().trim();
    var rowRef    = (row[1] || '').toString().trim();
    
    if (rowZone.toLowerCase() === zoneName.toLowerCase()) {
      // 1. Check duplicate name + category + level + school
      if (rowName.toLowerCase() === fullName.toLowerCase() &&
          rowCat.toLowerCase() === category.toLowerCase() &&
          rowLevel.toLowerCase() === level.toLowerCase()) {
        duplicateRef = rowRef;
      }
      
      // 2. Count for slot limit check
      if (rowPType.toLowerCase() === pType.toLowerCase() &&
          rowCat.toLowerCase() === category.toLowerCase()) {
        if (pType.indexOf('Academics') !== -1 || pType.indexOf('Technical Skills') !== -1) {
          if (rowLevel.toLowerCase() === level.toLowerCase()) {
            slotCount++;
          }
        } else {
          slotCount++;
        }
      }
    }
  }
  
  // Duplicate check first
  if (duplicateRef && data.bypassDuplicate !== true) {
    return {
      allowed: false,
      reason: 'duplicate',
      ref: duplicateRef,
      message: 'Warning: ' + fullName + ' already submitted in ' + category + '. Reference: ' + duplicateRef
    };
  }
  
  // Slot limit check
  var maxLimit = 1;
  if (pType.indexOf('Technical Skills') !== -1) {
    if (category === 'Civil Engineering') maxLimit = 4;
    else if (category === 'Mechanical Engineering') maxLimit = 4;
    else if (category === 'Electronics Services') maxLimit = 2;
    else if (category === 'Fashion Technology') maxLimit = 1;
    else if (category === 'Cosmetology') maxLimit = 1;
  } else if (pType.indexOf('Academics') !== -1) {
    maxLimit = 1;
  } else if (pType === 'Teacher' || pType.indexOf('Youth') !== -1) {
    maxLimit = 1;
  } else {
    // Learner Innovations
    maxLimit = 3;
  }
  
  if (slotCount >= maxLimit) {
    return {
      allowed: false,
      reason: 'full',
      message: 'This slot is already full: ' + category + ' — ' + level
    };
  }
  
  return { allowed: true };
}
