// ═══════════════════════════════════════════════════════════════
// firebase.js — Firebase Firestore client
// JETS 2026 | Lavushimanda District
// ═══════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyDINoYBAtoXgLF28ZE3OKEdYBODCWCg_Wc",
  authDomain:        "jets2026-lavushimanda.firebaseapp.com",
  projectId:         "jets2026-lavushimanda",
  storageBucket:     "jets2026-lavushimanda.firebasestorage.app",
  messagingSenderId: "802975987082",
  appId:             "1:802975987082:web:2f7092c076259f2cd10473"
};

if (!firebase.apps.length) {
  firebase.initializeApp(FIREBASE_CONFIG);
}

const db = firebase.firestore();

let _storage = null;
try { _storage = firebase.storage(); } catch (_) {}

// ── Collections ───────────────────────────────────────────────
const COL_REGISTRATIONS   = 'registrations';
const COL_SUBS            = 'submissions';
const COL_SETTINGS        = 'settings';
const COL_CORRECTIONS     = 'correction_requests';

// ═══════════════════════════════════════════════════════════════
const FirestoreDB = (() => {

  let _zoneHistoryCache = null;

  // ── Deadlines ─────────────────────────────────────────────────
  async function getDeadlines() {
    try {
      const doc = await db.collection(COL_SETTINGS).doc('deadlines').get();
      if (doc.exists) return { status: 'ok', deadlines: doc.data() };
    } catch (e) { console.warn('getDeadlines failed', e); }
    return { status: 'ok', deadlines: {} };
  }

  async function saveDeadlines(deadlines) {
    await db.collection(COL_SETTINGS).doc('deadlines').set(deadlines, { merge: true });
    return { status: 'ok' };
  }

  // ── Registration lookup ──────────────────────────────────────
  async function getRegistration(phone) {
    try {
      const snap = await db.collection(COL_REGISTRATIONS)
        .where('phone', '==', phone.trim())
        .limit(1)
        .get();
      if (!snap.empty) {
        const d = snap.docs[0].data();
        return { found: true, ...d };
      }
      const testSnap = await db.collection(COL_REGISTRATIONS).limit(1).get();
      return { found: false, collectionSize: testSnap.size, searched: phone.trim() };
    } catch (e) {
      console.warn('getRegistration failed', e);
      return { found: false, dbError: e.message || String(e) };
    }
  }

  // ── File upload ──────────────────────────────────────────────
  async function uploadFile(base64, fileName, mimeType, phone) {
    if (_storage) {
      try {
        const path = 'submissions/' + (phone || 'anon') + '/' + Date.now() + '_' + fileName;
        const ref  = _storage.ref(path);
        await ref.putString(base64, 'base64', { contentType: mimeType });
        const url = await ref.getDownloadURL();
        return { status: 'ok', url };
      } catch (e) {
        console.warn('uploadFile via Storage failed — storing base64 inline', e);
      }
    }
    return { status: 'ok', url: 'data:' + mimeType + ';base64,' + base64 };
  }

  function _catCounts(docs) {
    const innovations = docs.filter(d => (d.learnerSubType || '') !== 'Academics / Quiz & Olympiads' && (d.learnerSubType || '') !== 'Technical Skills').length;
    const academics   = docs.filter(d => (d.learnerSubType || '') === 'Academics / Quiz & Olympiads').length;
    const skills      = docs.filter(d => (d.learnerSubType || '') === 'Technical Skills').length;
    return { innovations, academics, skills };
  }

  // ── Submission count for a school ─────────────────────────────
  async function getSchoolCount(phone, schoolName) {
    try {
      const [snap1, snap2] = await Promise.all([
        db.collection(COL_SUBS).where('schoolName', '==', schoolName).get(),
        db.collection(COL_SUBS).where('school',     '==', schoolName).get(),
      ]);
      const seen = new Set();
      const docs = [];
      [...snap1.docs, ...snap2.docs].forEach(d => { if (!seen.has(d.id)) { seen.add(d.id); docs.push(d.data()); } });
      return { status: 'ok', total: docs.length, ..._catCounts(docs) };
    } catch (e) { console.warn('getSchoolCount failed', e); }
    return { status: 'ok', total: 0, innovations: 0, academics: 0, skills: 0 };
  }

  // ── All zone data (school submissions in a zone) ───────────────
  async function getZoneAllData(phone, zone) {
    try {
      const snap = await db.collection(COL_SUBS).where('zone', '==', zone).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.timestamp || '') < (a.timestamp || '') ? -1 : 1);

      _zoneHistoryCache = docs;

      const schoolSet = new Set(docs.map(d => d.schoolName || d.school).filter(Boolean));

      const innovations            = { learner: {}, teacher: {}, youth: {} };
      const academicsBySubjectLevel = {};
      const skillsByCategory        = {};
      docs.forEach(r => {
        const pType   = r.participantType || '';
        const subType = r.learnerSubType  || '';
        const cat     = r.category        || '';
        const lvl     = r.level           || '';
        if (pType === 'Teacher') {
          innovations.teacher[cat] = (innovations.teacher[cat] || 0) + 1;
        } else if (pType === 'Out-of-School Youth') {
          innovations.youth[cat] = (innovations.youth[cat] || 0) + 1;
        } else if (pType === 'Learner') {
          if (subType === 'Technical Skills') {
            skillsByCategory[cat] = (skillsByCategory[cat] || 0) + 1;
          } else if (subType === 'Academics / Quiz & Olympiads') {
            const key = lvl + ':' + cat;
            academicsBySubjectLevel[key] = (academicsBySubjectLevel[key] || 0) + 1;
          } else {
            if (!innovations.learner[lvl]) innovations.learner[lvl] = {};
            innovations.learner[lvl][cat] = (innovations.learner[lvl][cat] || 0) + 1;
          }
        }
      });

      return {
        status: 'ok',
        rows:   docs,
        total:  docs.length,
        submittedSchools: [...schoolSet],
        ..._catCounts(docs),
        progressData: { status: 'ok', innovations, academicsBySubjectLevel, skillsByCategory, total: docs.length }
      };
    } catch (e) {
      console.warn('getZoneAllData failed', e);
      return {
        status: 'ok', rows: [], total: 0, innovations: 0, academics: 0, skills: 0, submittedSchools: [],
        progressData: { status: 'ok', innovations: { learner: {}, teacher: {}, youth: {} }, academicsBySubjectLevel: {}, skillsByCategory: {}, total: 0 }
      };
    }
  }

  // ── Zone count: total submissions + selections ─────────────────
  async function getZoneCount(phone, zone) {
    try {
      const snap = await db.collection(COL_SUBS).where('zone', '==', zone).get();
      const docs = snap.docs.map(d => d.data());
      const schoolSet = new Set(docs.map(d => d.schoolName || d.school).filter(Boolean));
      const selected = docs.filter(d => d.selectedForDistrict === true).length;
      return {
        status: 'ok',
        total: docs.length,
        selected,
        ..._catCounts(docs),
        submittedSchools: [...schoolSet]
      };
    } catch (e) { console.warn('getZoneCount failed', e); }
    return { status: 'ok', total: 0, selected: 0, innovations: 0, academics: 0, skills: 0, submittedSchools: [] };
  }

  // ── Welcome stats ─────────────────────────────────────────────
  async function getWelcomeStats(phone, role, zone, schoolName) {
    if (role === 'School') {
      const r = await getSchoolCount(phone, schoolName);
      return { status: 'ok', role: 'School', ...r };
    }
    if (role === 'Zone') {
      const r = await getZoneCount(phone, zone);
      return { status: 'ok', role: 'Zone', ...r };
    }
    return { status: 'ok', role };
  }

  // ── Submission history ────────────────────────────────────────
  async function getSubmissionHistory(phone, source, zone, schoolName) {
    if (source === 'zone' && _zoneHistoryCache !== null) {
      return { status: 'ok', rows: _zoneHistoryCache };
    }
    try {
      let snaps;
      if (source === 'zone') {
        snaps = [await db.collection(COL_SUBS).where('zone', '==', zone).get()];
      } else {
        snaps = await Promise.all([
          db.collection(COL_SUBS).where('schoolName', '==', schoolName).get(),
          db.collection(COL_SUBS).where('school',     '==', schoolName).get(),
        ]);
      }
      const seen = new Set();
      const rows = [];
      snaps.forEach(snap => snap.docs.forEach(d => {
        if (!seen.has(d.id)) { seen.add(d.id); rows.push({ id: d.id, ...d.data() }); }
      }));
      rows.sort((a, b) => (b.timestamp || '') < (a.timestamp || '') ? -1 : 1);

      try {
        const corrSnap = await db.collection(COL_CORRECTIONS).get();
        const corrMap = {};
        corrSnap.forEach(d => {
          const c = d.data();
          if (c.refNumber) corrMap[c.refNumber] = { status: c.status, id: d.id };
        });
        rows.forEach(r => {
          const corr = corrMap[r.ref || r.id];
          if (corr) { r.correctionStatus = corr.status; r.correctionRequestId = corr.id; }
        });
      } catch (ce) {
        console.warn('Joining correction requests failed', ce);
      }

      return { status: 'ok', rows };
    } catch (e) { console.warn('getSubmissionHistory failed', e); }
    return { status: 'ok', rows: [] };
  }

  // ── Progress data ─────────────────────────────────────────────
  async function getProgressData(phone, source, zone, schoolName) {
    const hist = await getSubmissionHistory(phone, source, zone, schoolName);
    const rows = hist.rows || [];

    const innovations            = { learner: {}, teacher: {}, youth: {} };
    const academicsBySubjectLevel = {};
    const skillsByCategory        = {};

    rows.forEach(r => {
      const pType   = r.participantType || '';
      const subType = r.learnerSubType  || '';
      const cat     = r.category        || '';
      const lvl     = r.level           || '';
      if (pType === 'Teacher') {
        innovations.teacher[cat] = (innovations.teacher[cat] || 0) + 1;
      } else if (pType === 'Out-of-School Youth') {
        innovations.youth[cat] = (innovations.youth[cat] || 0) + 1;
      } else if (pType === 'Learner') {
        if (subType === 'Technical Skills') {
          skillsByCategory[cat] = (skillsByCategory[cat] || 0) + 1;
        } else if (subType === 'Academics / Quiz & Olympiads') {
          const key = lvl + ':' + cat;
          academicsBySubjectLevel[key] = (academicsBySubjectLevel[key] || 0) + 1;
        } else {
          if (!innovations.learner[lvl]) innovations.learner[lvl] = {};
          innovations.learner[lvl][cat] = (innovations.learner[lvl][cat] || 0) + 1;
        }
      }
    });

    return { status: 'ok', innovations, academicsBySubjectLevel, skillsByCategory, total: rows.length };
  }

  // ── Add a school submission ───────────────────────────────────
  async function submitSchool(payload) {
    try {
      const tsMs = Date.now();
      const rand = Math.floor(1000 + Math.random() * 9000);
      const refNumber = 'SCH-' + tsMs + '-' + rand;

      payload.timestamp = new Date().toISOString();
      payload.ref = refNumber;
      payload.selectedForDistrict = false;

      await db.collection(COL_SUBS).doc(refNumber).set(payload);
      return { status: 'ok', refNumber };
    } catch (e) {
      console.error('submitSchool failed', e);
      throw e;
    }
  }

  // ── Zone selection: mark a submission as selected ─────────────
  async function selectForDistrict(docId, coordinatorName, zone) {
    try {
      await db.collection(COL_SUBS).doc(docId).update({
        selectedForDistrict: true,
        selectedBy:          coordinatorName,
        selectedAt:          new Date().toISOString(),
      });
      return { status: 'ok' };
    } catch (e) {
      console.error('selectForDistrict failed', e);
      throw e;
    }
  }

  // ── Zone deselection: unmark a submission ─────────────────────
  async function deselectFromDistrict(docId) {
    try {
      await db.collection(COL_SUBS).doc(docId).update({
        selectedForDistrict: false,
        selectedBy:          null,
        selectedAt:          null,
      });
      return { status: 'ok' };
    } catch (e) {
      console.error('deselectFromDistrict failed', e);
      throw e;
    }
  }

  // ── Correction request ────────────────────────────────────────
  async function submitCorrectionRequest(payload) {
    try {
      payload.submittedAt = new Date().toISOString();
      payload.status = 'Pending';
      const ref = await db.collection(COL_CORRECTIONS).add(payload);
      return { status: 'ok', ref: ref.id };
    } catch (e) {
      console.error('submitCorrectionRequest failed', e);
      throw e;
    }
  }

  // ── Full dashboard data ───────────────────────────────────────
  async function getFullDashboard() {
    try {
      const [regSnap, subsSnap, settSnap, corrSnap] = await Promise.all([
        db.collection(COL_REGISTRATIONS).get(),
        db.collection(COL_SUBS).get(),
        db.collection(COL_SETTINGS).doc('deadlines').get(),
        db.collection(COL_CORRECTIONS).get(),
      ]);

      const reg  = regSnap.docs.map(d => d.data());
      const subs = subsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Zone selections: submissions marked selectedForDistrict = true
      const zoneSels = subs.filter(s => s.selectedForDistrict === true);

      const schoolReg = {};
      const coordReg  = {};
      reg.forEach(r => {
        const role = (r.role || '').trim();
        const name = (r.schoolName || r.name || '').trim();
        if (role === 'School') {
          schoolReg[name] = { zone: r.zone, type: r.schoolType || r.type || '', status: r.status };
        } else if (role === 'Zone') {
          coordReg[r.zone] = { name: r.organiserName || r.organiser || '', phone: r.phone };
        }
      });

      const todayStr = new Date().toISOString().slice(0, 10);
      let todayCount = 0;
      const schoolSubCounts = {};
      const schoolsStarted  = {};

      subs.forEach(r => {
        const ts  = r.timestamp || '';
        const sch = (r.schoolName || r.school || '').trim();
        if (ts && ts.slice(0, 10) === todayStr) todayCount++;
        if (sch) { schoolSubCounts[sch] = (schoolSubCounts[sch] || 0) + 1; schoolsStarted[sch] = true; }
      });

      const regNames       = Object.keys(schoolReg);
      const schoolsTotal   = regNames.length;
      let schoolsSubmitted = 0;
      regNames.forEach(n => { if (schoolsStarted[n]) schoolsSubmitted++; });

      const ZONE_NAMES = ['Mpumba', 'Chiundaponde', 'Lukulu', 'Kalonje', 'Mwelushi'];

      // Zone selection progress (based on selectedForDistrict)
      const zoneSelMap = {};
      ZONE_NAMES.forEach(z => { zoneSelMap[z] = { cnt: 0, schools: {} }; });
      zoneSels.forEach(r => {
        const zn  = (r.zone || '').trim();
        const sch = (r.schoolName || r.school || '').trim();
        if (zoneSelMap[zn]) {
          zoneSelMap[zn].cnt++;
          if (sch) zoneSelMap[zn].schools[sch] = (zoneSelMap[zn].schools[sch] || 0) + 1;
        }
      });

      const zones = ZONE_NAMES.map(zn => {
        const zd    = zoneSelMap[zn];
        const coord = coordReg[zn] || { name: '', phone: '' };
        const submitted = zd.cnt;
        const pct    = Math.min(100, Math.round((submitted / 64) * 100));
        const status = submitted === 0 ? 'Not Started' : submitted >= 64 ? 'Complete' : 'In Progress';

        // Per-school stats within zone
        const zSchools = {};
        Object.keys(zd.schools).forEach(sn => {
          zSchools[sn] = { zoneCount: zd.schools[sn], schoolCount: schoolSubCounts[sn] || 0 };
        });
        regNames.forEach(sn => {
          if (schoolReg[sn].zone === zn && !zSchools[sn]) {
            zSchools[sn] = { zoneCount: 0, schoolCount: schoolSubCounts[sn] || 0 };
          }
        });
        const schoolsArr = Object.entries(zSchools).map(([sn, v]) => {
          const inf = schoolReg[sn] || { type: '' };
          return { name: sn, type: inf.type || '', schoolCount: v.schoolCount, zoneCount: v.zoneCount, submitted: v.schoolCount };
        }).sort((a, b) => a.name < b.name ? -1 : 1);

        return { name: zn, coordinator: coord.name, phone: coord.phone, submitted, max: 64, pct, status, schools: schoolsArr };
      });

      const schoolList = regNames.map(sn => {
        const info = schoolReg[sn];
        const sc   = schoolSubCounts[sn] || 0;
        return { name: sn, zone: info.zone, type: info.type, submitted: sc, hasStarted: sc > 0 };
      }).sort((a, b) => a.zone < b.zone ? -1 : a.zone > b.zone ? 1 : a.name < b.name ? -1 : 1);

      const allSubs = subs.map(r => ({
        time:               r.timestamp || '',
        source:             r.selectedForDistrict ? 'Selected' : 'School',
        zone:               r.zone || '',
        school:             r.schoolName || r.school || '',
        participant:        r.fullName || r.participant || '',
        learnerSubType:     r.learnerSubType || r.type || '',
        category:           r.category || '',
        ref:                r.ref || r.id,
        selectedForDistrict: !!r.selectedForDistrict,
      })).sort((a, b) => b.time < a.time ? -1 : 1);

      const coverage = {};
      ZONE_NAMES.forEach(z => { coverage[z] = {}; });
      allSubs.forEach(r => {
        if (r.zone && r.category && coverage[r.zone] !== undefined) {
          coverage[r.zone][r.category] = (coverage[r.zone][r.category] || 0) + 1;
        }
      });

      const SKILL_CATS  = ['Civil Engineering', 'Mechanical Engineering', 'Electronics Services', 'Fashion Technology', 'Cosmetology'];
      const SKILL_SLOTS = { 'Civil Engineering': 4, 'Mechanical Engineering': 4, 'Electronics Services': 2, 'Fashion Technology': 1, 'Cosmetology': 1 };
      const skillCounts = {};
      SKILL_CATS.forEach(c => { skillCounts[c] = 0; });
      allSubs.forEach(r => {
        if (r.learnerSubType === 'Technical Skills' && r.category && skillCounts[r.category] !== undefined) {
          skillCounts[r.category]++;
        }
      });
      const skills = SKILL_CATS.map(c => ({ category: c, used: skillCounts[c], slots: SKILL_SLOTS[c] }));

      const allSchoolRecords = reg
        .filter(r => (r.role || '').trim() !== 'District')
        .map(r => ({
          zone:      (r.zone                        || '').trim(),
          name:      (r.schoolName   || r.name      || '').trim(),
          type:      (r.schoolType   || r.type      || '').trim(),
          organiser: (r.organiserName || r.organiser || '').trim(),
          phone:     (r.phone        || '').trim(),
          role:      (r.role         || '').trim(),
          status:    (r.status       || 'Active').trim(),
        }));

      const corrections = corrSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      return {
        status:   'ok',
        cachedAt: new Date().toISOString(),
        overview: {
          totalSubmissions:  subs.length,
          zoneSelections:    zoneSels.length,
          schoolsSubmitted,
          schoolsTotal,
          schoolsNotStarted: Math.max(0, schoolsTotal - schoolsSubmitted),
          todaySubmissions:  todayCount
        },
        zones, schoolList,
        recentFeed: allSubs.slice(0, 20),
        allSubs, coverage, skills,
        corrections, allSchoolRecords,
        driveUrl:       '',
        exportUrl:      '',
        exportSchoolUrl:'',
        exportZoneUrl:  '',
      };
    } catch (e) {
      console.error('getFullDashboard failed', e);
      throw e;
    }
  }

  // ── Recent feed ───────────────────────────────────────────────
  async function getRecentFeed() {
    try {
      const snap = await db.collection(COL_SUBS).orderBy('timestamp', 'desc').limit(50).get();
      const feed = snap.docs.map(d => {
        const r = d.data();
        return {
          time:           r.timestamp || '',
          source:         r.selectedForDistrict ? 'Selected' : 'School',
          zone:           r.zone || '',
          school:         r.schoolName || r.school || '',
          participant:    r.fullName || r.participant || '',
          learnerSubType: r.learnerSubType || r.type || '',
          category:       r.category || '',
          ref:            r.ref || d.id
        };
      }).sort((a, b) => b.time < a.time ? -1 : 1);
      return { status: 'ok', recentFeed: feed.slice(0, 20) };
    } catch (e) {
      console.warn('getRecentFeed failed', e);
      return { status: 'ok', recentFeed: [] };
    }
  }

  // ── Admin: get all organisers ─────────────────────────────────
  async function adminGetAllOrganisers() {
    try {
      const snap = await db.collection(COL_REGISTRATIONS).get();
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { status: 'ok', records };
    } catch (e) { console.error('adminGetAllOrganisers failed', e); throw e; }
  }

  // ── Admin: toggle status ──────────────────────────────────────
  async function adminToggleStatus(targetPhone, newStatus) {
    try {
      const snap = await db.collection(COL_REGISTRATIONS)
        .where('phone', '==', targetPhone).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.update({ status: newStatus });
      return { status: 'ok' };
    } catch (e) { console.error('adminToggleStatus failed', e); throw e; }
  }

  // ── Admin: delete a submission by ref ────────────────────────
  async function deleteSubmission(ref) {
    const snap = await db.collection(COL_SUBS).where('ref', '==', ref).limit(1).get();
    if (snap.empty) throw new Error('Submission not found: ' + ref);
    await snap.docs[0].ref.delete();
    return { status: 'ok' };
  }

  // ── Admin: delete a registration ──────────────────────────────
  async function adminDeleteOrganiser(targetPhone) {
    try {
      const snap = await db.collection(COL_REGISTRATIONS)
        .where('phone', '==', targetPhone).limit(1).get();
      if (!snap.empty) await snap.docs[0].ref.delete();
      return { status: 'ok' };
    } catch (e) { console.error('adminDeleteOrganiser failed', e); throw e; }
  }

  // ── Admin: add an organiser ─────────────────────────────────
  async function adminAddOrganiser(payload) {
    try {
      const docId = payload.phone.trim();
      await db.collection(COL_REGISTRATIONS).doc(docId).set(payload);
      return { status: 'ok' };
    } catch (e) { console.error('adminAddOrganiser failed', e); throw e; }
  }

  // ── Admin: update an organiser ──────────────────────────────
  async function adminUpdateOrganiser(origPhone, payload) {
    try {
      const docId = payload.phone.trim();
      const origDocId = origPhone.trim();
      if (origDocId !== docId) {
        await db.collection(COL_REGISTRATIONS).doc(origDocId).delete();
      }
      await db.collection(COL_REGISTRATIONS).doc(docId).set(payload);
      return { status: 'ok' };
    } catch (e) { console.error('adminUpdateOrganiser failed', e); throw e; }
  }

  // ── Admin: handle correction decision ─────────────────────────
  async function handleCorrectionDecision(correctionId, decision, note) {
    try {
      await db.collection(COL_CORRECTIONS).doc(correctionId).update({
        status:    decision,
        adminNote: note || '',
        decidedAt: new Date().toISOString(),
      });
      return { status: 'ok' };
    } catch (e) { console.error('handleCorrectionDecision failed', e); throw e; }
  }

  return {
    getDeadlines,
    saveDeadlines,
    getRegistration,
    uploadFile,
    getSchoolCount,
    getZoneCount,
    getZoneAllData,
    getWelcomeStats,
    getSubmissionHistory,
    getProgressData,
    submitSchool,
    selectForDistrict,
    deselectFromDistrict,
    submitCorrectionRequest,
    getFullDashboard,
    getRecentFeed,
    deleteSubmission,
    adminGetAllOrganisers,
    adminToggleStatus,
    adminDeleteOrganiser,
    adminAddOrganiser,
    adminUpdateOrganiser,
    handleCorrectionDecision,
  };
})();
