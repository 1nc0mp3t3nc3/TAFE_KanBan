// ============================================================
// Code.gs — Backend for the Group Assessment Task Board
// Version: 3.6
// https://github.com/1nc0mp3t3nc3/taskboard
// ============================================================
// SETUP:
//  1. Set SPREADSHEET_ID, SUBMISSIONS_FOLDER_ID, DOCUMENTS_FOLDER_ID
//  2. Set SERVER_PIN_HASH (SHA-256 of your group PIN)
//     Default below = PIN "1234". Generate at:
//     https://emn178.github.io/online-tools/sha256.html
//  3. Update SECTION_CONFIG to match your report structure
//     num: three-digit prefix matching your Google Doc filenames
//     name: must exactly match sections[] names in config.js
//  4. Run setupSpreadsheet() once from the Apps Script editor
//  5. Deploy: Execute as Me, Access: Anyone with Google Account
// ============================================================

const SPREADSHEET_ID        = 'YOUR_SPREADSHEET_ID_HERE';
const SUBMISSIONS_FOLDER_ID = 'YOUR_SUBMISSIONS_FOLDER_ID_HERE';
const DOCUMENTS_FOLDER_ID   = 'YOUR_DOCUMENTS_FOLDER_ID_HERE';

// SHA-256 of your group PIN. Default = "1234"
// Generate at: https://emn178.github.io/online-tools/sha256.html
const SERVER_PIN_HASH = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

// ── SECTION CONFIG ────────────────────────────────────────────
// Keep in sync with sections[] in config.js
// num: must match three-digit prefix of Google Doc filenames
// name: must exactly match section names in config.js
// target: word count target (0 = no target)
const SECTION_CONFIG = [
  { num: '001', name: 'Executive Summary',          target: 100  },
  { num: '002', name: 'Introduction',               target: 300  },
  { num: '003', name: 'Analysis',                   target: 500  },
  { num: '004', name: 'Risk & Governance Strategy', target: 1000 },
  { num: '005', name: 'Implementation Plan',        target: 500  },
  { num: '006', name: 'Conclusion',                 target: 100  },
  { num: '007', name: 'References',                 target: 0    },
];

const SHEET_TASKS     = 'Tasks';
const SHEET_MEMBERS   = 'Members';
const SHEET_DEADLINES = 'Deadlines';
const SHEET_NOTES     = 'Meeting Notes';
const SHEET_AUDIT     = 'Audit Log';
const SHEET_SUB_SNAP  = 'Submissions Snapshot';
const SHEET_SOURCES   = 'Sources';

// ============================================================
// HELPERS
// ============================================================
function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }

function getSheet_(name) {
  const sh = ss().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet: ' + name);
  return sh;
}

function headerMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {};
  headers.forEach((h, i) => { map[String(h).trim()] = i; });
  return map;
}

function logAudit_(category, action, sourceId, sourceTitle, fieldsChanged, prevValues, newValues) {
  const sh = getSheet_(SHEET_AUDIT);
  sh.appendRow([
    new Date(),
    Session.getActiveUser().getEmail(),
    category, action,
    sourceId      || '',
    sourceTitle   || '',
    fieldsChanged || '',
    prevValues    || '',
    newValues     || '',
  ]);
}

// ============================================================
// TASKS
// ============================================================
function getTasks() {
  const sh   = getSheet_(SHEET_TASKS);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  const idx = {};
  vals[0].forEach((h, i) => idx[h] = i);
  return vals.slice(1).filter(r => r[idx['ID']]).map(r => {
    let due = r[idx['DueDate']];
    if (due instanceof Date) due = Utilities.formatDate(due, 'Australia/Brisbane', 'dd/MM/yyyy');
    else due = due ? String(due) : '';
    return {
      ID:         String(r[idx['ID']]),
      Title:      r[idx['Title']]      || '',
      Section:    r[idx['Section']]    || '',
      Owner:      r[idx['Owner']]      || 'Unassigned',
      Status:     r[idx['Status']]     || 'Not started',
      Priority:   r[idx['Priority']]   || 'Medium',
      DueDate:    due,
      WordTarget: r[idx['WordTarget']] || '',
      Notes:      r[idx['Notes']]      || '',
    };
  });
}

function nextTaskId_() {
  const sh  = getSheet_(SHEET_TASKS);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return 'T001';
  const idx = headerMap_(sh);
  const max = vals.slice(1)
    .map(r => String(r[idx['ID']]))
    .filter(Boolean)
    .reduce((m, id) => { const n = id.match(/T(\d+)/); return n ? Math.max(m, parseInt(n[1])) : m; }, 0);
  return 'T' + String(max + 1).padStart(3, '0');
}

function addTask(task) {
  const sh  = getSheet_(SHEET_TASKS);
  const idx = headerMap_(sh);
  const id  = nextTaskId_();
  const row = new Array(sh.getLastColumn()).fill('');
  row[idx['ID']]         = id;
  row[idx['Title']]      = task.Title      || '';
  row[idx['Section']]    = task.Section    || '';
  row[idx['Owner']]      = task.Owner      || 'Unassigned';
  row[idx['Status']]     = 'Not started';
  row[idx['Priority']]   = task.Priority   || 'Medium';
  row[idx['DueDate']]    = task.DueDate    || '';
  row[idx['WordTarget']] = task.WordTarget || '';
  row[idx['Notes']]      = task.Notes      || '';
  sh.appendRow(row);
  logAudit_('tasks', 'add', id, task.Title, 'all fields', '', JSON.stringify(task));
  return { id: id };
}

function updateTaskStatus(id, newStatus) {
  const sh   = getSheet_(SHEET_TASKS);
  const vals = sh.getDataRange().getValues();
  const idx  = headerMap_(sh);
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idx['ID']]) === String(id)) {
      const prev = vals[r][idx['Status']];
      sh.getRange(r + 1, idx['Status'] + 1).setValue(newStatus);
      logAudit_('tasks', 'status-change', id, vals[r][idx['Title']], 'Status', prev, newStatus);
      return;
    }
  }
}

function updateTaskField(id, field, value) {
  const sh   = getSheet_(SHEET_TASKS);
  const vals = sh.getDataRange().getValues();
  const idx  = headerMap_(sh);
  if (!(field in idx)) return;
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idx['ID']]) === String(id)) {
      const prev = vals[r][idx[field]];
      sh.getRange(r + 1, idx[field] + 1).setValue(value);
      logAudit_('tasks', 'edit', id, vals[r][idx['Title']], field, field + ': ' + prev, field + ': ' + value);
      return;
    }
  }
}

// ============================================================
// MEMBERS
// ============================================================
function getMembers() {
  const sh   = getSheet_(SHEET_MEMBERS);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  const idx = headerMap_(sh);
  return vals.slice(1).filter(r => r[idx['Initials']]).map(r => ({
    initials: r[idx['Initials']],
    name:     r[idx['Name']],
  }));
}

function saveMember(initials, name) {
  const sh   = getSheet_(SHEET_MEMBERS);
  const idx  = headerMap_(sh);
  const vals = sh.getDataRange().getValues();
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idx['Initials']]).toUpperCase() === String(initials).toUpperCase()) {
      sh.getRange(r + 1, idx['Name'] + 1).setValue(name);
      logAudit_('members', 'edit', initials, name, 'Name', '', name);
      return;
    }
  }
  const row = new Array(sh.getLastColumn()).fill('');
  row[idx['Initials']] = initials;
  row[idx['Name']]     = name;
  sh.appendRow(row);
  logAudit_('members', 'add', initials, name, 'all fields', '', JSON.stringify({ initials, name }));
}

// ============================================================
// DEADLINES
// ============================================================
function getDeadlines() {
  const sh   = getSheet_(SHEET_DEADLINES);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  const idx = headerMap_(sh);
  return vals.slice(1).filter(r => r[idx['Label']]).map(r => {
    let d = r[idx['Date']];
    if (d instanceof Date) d = Utilities.formatDate(d, 'Australia/Brisbane', 'yyyy-MM-dd');
    else d = d ? String(d) : '';
    return { label: r[idx['Label']], date: d };
  });
}

function saveDeadline(label, dateStr) {
  const sh   = getSheet_(SHEET_DEADLINES);
  const idx  = headerMap_(sh);
  const vals = sh.getDataRange().getValues();
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idx['Label']]) === String(label)) {
      sh.getRange(r + 1, idx['Date'] + 1).setValue(new Date(dateStr));
      logAudit_('deadlines', 'edit', label, label, 'Date', '', dateStr);
      return;
    }
  }
  const row = new Array(sh.getLastColumn()).fill('');
  row[idx['Label']] = label;
  row[idx['Date']]  = new Date(dateStr);
  sh.appendRow(row);
  logAudit_('deadlines', 'add', label, label, 'all fields', '', JSON.stringify({ label, dateStr }));
}

// ============================================================
// MEETING NOTES
// ============================================================
function getNotes() {
  const sh   = getSheet_(SHEET_NOTES);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  const idx = headerMap_(sh);
  return vals.slice(1).filter(r => r[idx['ID']]).map(r => {
    let d = r[idx['Date']];
    if (d instanceof Date) d = Utilities.formatDate(d, 'Australia/Brisbane', 'dd/MM/yyyy');
    else d = d ? String(d) : '';
    return {
      id:     r[idx['ID']],
      title:  r[idx['Title']] || '',
      date:   d,
      body:   r[idx['Body']]  || '',
      author: r[idx['Author']] || 'Unassigned',
    };
  });
}

function addNote(title, dateStr, body, author) {
  const sh  = getSheet_(SHEET_NOTES);
  const idx = headerMap_(sh);
  const id  = 'N' + Date.now();
  const row = new Array(sh.getLastColumn()).fill('');
  row[idx['ID']]     = id;
  row[idx['Title']]  = title;
  row[idx['Date']]   = new Date(dateStr);
  row[idx['Body']]   = body;
  row[idx['Author']] = author || 'Unassigned';
  sh.appendRow(row);
  logAudit_('notes', 'add', id, title, 'all fields', '', JSON.stringify({ title, dateStr, author }));
}

// ============================================================
// SUBMISSIONS
// ============================================================
function getDocuments() {
  const folder = DriveApp.getFolderById(SUBMISSIONS_FOLDER_ID);
  const files  = folder.getFiles();
  const docs   = [];
  while (files.hasNext()) {
    const f = files.next();
    docs.push({
      name:     f.getName(),
      url:      f.getUrl(),
      size:     f.getSize(),
      modified: Utilities.formatDate(f.getLastUpdated(), 'Australia/Brisbane', 'dd/MM/yyyy HH:mm'),
      type:     f.getMimeType(),
    });
  }
  const sh = getSheet_(SHEET_SUB_SNAP);
  sh.clearContents();
  sh.appendRow(['FileName', 'FileId', 'Size', 'Modified']);
  docs.forEach(d => sh.appendRow([d.name, d.url.replace(/.*\/d\/([^/]+).*/, '$1'), d.size, d.modified]));
  return docs;
}

function checkSubmissionsChanges() { return; }

function syncReviewCards() {
  const docs           = getDocuments();
  const existingTitles = getTasks().map(t => t.Title);
  let created          = 0;
  docs.forEach(d => {
    const title = 'Review submission: ' + d.name.replace(/\.docx$/i, '');
    if (!existingTitles.includes(title)) {
      addTask({ Title: title, Section: 'Review', Owner: 'Unassigned', Priority: 'High', DueDate: '', WordTarget: '', Notes: 'Auto-generated peer review task.' });
      created++;
    }
  });
  return { created: created };
}

// ============================================================
// REPORT SECTIONS
// ============================================================
function getSectionDocuments() {
  const folder = DriveApp.getFolderById(DOCUMENTS_FOLDER_ID);
  const files  = folder.getFiles();
  const docs   = [];
  while (files.hasNext()) {
    const f = files.next();
    docs.push({ name: f.getName(), id: f.getId(), url: f.getUrl() });
  }
  return SECTION_CONFIG.map(sec => {
    const doc = docs.find(d => d.name.startsWith(sec.num));
    return { num: sec.num, name: sec.name, target: sec.target, docId: doc ? doc.id : '', docUrl: doc ? doc.url : '' };
  });
}

function getLiveWordCounts() {
  const folder = DriveApp.getFolderById(DOCUMENTS_FOLDER_ID);
  const files  = folder.getFiles();
  const counts = {};
  while (files.hasNext()) {
    const f    = files.next();
    const m    = f.getName().match(/^(\d{3})/);
    if (!m) continue;
    try {
      const text   = DocumentApp.openById(f.getId()).getBody().getText();
      counts[m[1]] = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    } catch (e) {
      counts[m[1]] = 0;
    }
  }
  return counts;
}

// ============================================================
// SEED SECTION TASKS
// Creates one task card per section with target > 0.
// Skips sections that already have a matching task title.
// Uses earliest deadline from the Deadlines sheet as due date.
// Safe to re-run.
// ============================================================
function seedSectionTasks() {
  try {
    var dueDate = '';
    try {
      var deadlines = getDeadlines();
      if (deadlines && deadlines.length > 0) {
        var sorted   = deadlines.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
        var earliest = new Date(sorted[0].date);
        dueDate      = String(earliest.getDate()).padStart(2,'0') + '/' +
                       String(earliest.getMonth() + 1).padStart(2,'0') + '/' +
                       earliest.getFullYear();
      }
    } catch (e) { /* no deadlines set */ }

    var existing = getTasks().map(function (t) { return t.Title; });
    var created  = 0;

    SECTION_CONFIG.forEach(function (sec) {
      if (!sec.target || sec.target === 0) return;
      if (existing.indexOf(sec.name) !== -1) return;
      addTask({
        Title:      sec.name,
        Section:    sec.name,
        Owner:      'Unassigned',
        Priority:   'Medium',
        DueDate:    dueDate,
        WordTarget: String(sec.target),
        Notes:      'Auto-generated. Target: ~' + sec.target + ' words.',
      });
      created++;
    });

    return { created: created };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ============================================================
// SEED REPORT DOCS
// Creates placeholder Google Docs in the documents folder
// for each section in SECTION_CONFIG. Safe to re-run.
// ============================================================
function seedReportDocs() {
  try {
    const folder = DriveApp.getFolderById(DOCUMENTS_FOLDER_ID);
    let created  = 0;
    SECTION_CONFIG.forEach(sec => {
      const docName = sec.num + ' ' + sec.name;
      const existing = folder.getFilesByName(docName);
      if (!existing.hasNext()) {
        const doc  = DocumentApp.create(docName);
        const file = DriveApp.getFileById(doc.getId());
        folder.addFile(file);
        DriveApp.getRootFolder().removeFile(file);
        created++;
        Logger.log('Created: ' + docName);
      } else {
        Logger.log('Skipped (exists): ' + docName);
      }
    });
    return { success: true, created: created, message: 'Created ' + created + ' document(s).' };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ============================================================
// SOURCES
// ============================================================
function getSources() {
  const sh   = getSheet_(SHEET_SOURCES);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  const idx = headerMap_(sh);
  return vals.slice(1).filter(r => r[idx['ID']]).map(r => {
    let y = r[idx['Year']];
    if (y instanceof Date) y = Utilities.formatDate(y, 'Australia/Brisbane', 'yyyy');
    else y = y ? String(y) : '';
    return {
      id:      String(r[idx['ID']]),
      title:   r[idx['Title']]   || '',
      authors: r[idx['Authors']] || '',
      year:    y,
      type:    r[idx['Type']]    || '',
      url:     r[idx['URL']]     || '',
      section: r[idx['Section']] || '',
      notes:   r[idx['Notes']]   || '',
    };
  });
}

function addSource(source) {
  const sh  = getSheet_(SHEET_SOURCES);
  const idx = headerMap_(sh);
  const id  = 'S' + Date.now();
  const row = new Array(sh.getLastColumn()).fill('');
  row[idx['ID']]      = id;
  row[idx['Title']]   = source.title   || '';
  row[idx['Authors']] = source.authors || '';
  row[idx['Year']]    = source.year    || '';
  row[idx['Type']]    = source.type    || '';
  row[idx['URL']]     = source.url     || '';
  row[idx['Section']] = source.section || '';
  row[idx['Notes']]   = source.notes   || '';
  sh.appendRow(row);
  logAudit_('sources', 'add', id, source.title, 'all fields', '', JSON.stringify(source));
  return { id: id };
}

function updateSource(id, source) {
  const sh   = getSheet_(SHEET_SOURCES);
  const vals = sh.getDataRange().getValues();
  const idx  = headerMap_(sh);
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idx['ID']]) === String(id)) {
      const map = { title:'Title', authors:'Authors', year:'Year', type:'Type', url:'URL', section:'Section', notes:'Notes' };
      Object.entries(map).forEach(([k, col]) => {
        if (source[k] !== undefined) sh.getRange(r + 1, idx[col] + 1).setValue(source[k]);
      });
      logAudit_('sources', 'edit', id, source.title, 'multiple', '', JSON.stringify(source));
      return { success: true };
    }
  }
  return { error: 'Source not found' };
}

function deleteSource(id) {
  const sh   = getSheet_(SHEET_SOURCES);
  const vals = sh.getDataRange().getValues();
  const idx  = headerMap_(sh);
  for (let r = 1; r < vals.length; r++) {
    if (String(vals[r][idx['ID']]) === String(id)) {
      logAudit_('sources', 'delete', id, vals[r][idx['Title']], '', '', '');
      sh.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { error: 'Source not found' };
}

function fetchSourceMetadata(url) {
  try {
    const resp = UrlFetchApp.fetch(url.trim(), { muteHttpExceptions: true, followRedirects: true });
    const html = resp.getContentText();
    const title   = (html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i) || [])[1]
                 || (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '';
    return { title: title.trim().substring(0, 200), authors: '', year: new Date().getFullYear().toString(), url: url.trim(), type: 'web' };
  } catch (e) {
    return { error: e.toString() };
  }
}

function pushReferencesToDoc(format) {
  try {
    const sources = getSources();
    if (!sources || sources.length === 0) return { error: 'No sources to push.' };
    const folder = DriveApp.getFolderById(DOCUMENTS_FOLDER_ID);
    const files  = folder.getFiles();
    let refDoc   = null;
    while (files.hasNext()) {
      const f = files.next();
      if (f.getName().toLowerCase().includes('reference')) { refDoc = f; break; }
    }
    if (!refDoc) return { error: 'No file with "reference" in name found in documents folder.' };
    const body = DocumentApp.openById(refDoc.getId()).getBody();
    body.clear();
    body.appendParagraph('References').setHeading(DocumentApp.ParagraphHeading.HEADING1);
    sources.forEach((s, i) => {
      let line = '';
      if (format === 'harvard') line = (s.authors || 'Unknown') + ' (' + (s.year || 'n.d.') + ') ' + (s.title || '') + '. [online] Available at: ' + (s.url || '') + '.';
      else if (format === 'apa') line = (s.authors || 'Unknown') + '. (' + (s.year || 'n.d.') + '). ' + (s.title || '') + '. ' + (s.url ? 'Retrieved from ' + s.url : '');
      else if (format === 'ieee') line = '[' + (i + 1) + '] ' + (s.authors || 'Unknown') + ', "' + (s.title || '') + '," ' + (s.year || 'n.d.') + '. [Online]. Available: ' + (s.url || '');
      else line = (s.authors || '') + ' (' + (s.year || '') + ') ' + (s.title || '') + ' ' + (s.url || '');
      body.appendParagraph(line);
    });
    return { count: sources.length, docName: refDoc.getName(), url: refDoc.getUrl() };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ============================================================
// AUDIT LOG
// ============================================================
function getAuditLog() {
  const sh   = getSheet_(SHEET_AUDIT);
  const vals = sh.getDataRange().getValues();
  if (vals.length <= 1) return [];
  return vals.slice(1).map(r => {
    let ts = r[0];
    if (ts instanceof Date) ts = Utilities.formatDate(ts, 'Australia/Brisbane', 'dd/MM/yyyy HH:mm');
    else ts = ts ? String(ts) : '';
    return {
      timestamp: ts, editor: r[1] ? String(r[1]) : '',
      category: r[2] ? String(r[2]) : '', action: r[3] ? String(r[3]) : '',
      sourceId: r[4] ? String(r[4]) : '', entityTitle: r[5] ? String(r[5]) : '',
      fieldsChanged: r[6] ? String(r[6]) : '', previousValues: r[7] ? String(r[7]) : '', newValues: r[8] ? String(r[8]) : '',
    };
  }).reverse();
}

// ============================================================
// WEB ENTRYPOINT & AUTH
// ============================================================
function doGet(e) {
  const token = e.parameter.token;
  if (token && CacheService.getScriptCache().get(token) === 'valid') {
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('Task Board')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  return HtmlService.createHtmlOutputFromFile('login')
    .setTitle('Task Board Login')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAuthUrl(userPin) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, userPin);
  const hexHash = rawHash.map(b => ((b < 0 ? b + 256 : b).toString(16)).padStart(2, '0')).join('');
  if (hexHash === SERVER_PIN_HASH) {
    const token = Utilities.getUuid();
    CacheService.getScriptCache().put(token, 'valid', 43200);
    return ScriptApp.getService().getUrl() + '?token=' + token;
  }
  return null;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// REFERENCE SCANNER
// Accepts a Google Doc ID or a doc_XX tag matching a submission
// ============================================================
function scanDocReferences(docInput) {
  try {
    let id         = docInput.trim();
    const tagMatch = id.match(/^doc_([a-zA-Z0-9]+)$/i);
    if (tagMatch) {
      const initials = tagMatch[1].toUpperCase();
      const files    = DriveApp.getFolderById(SUBMISSIONS_FOLDER_ID).getFiles();
      let found      = null;
      while (files.hasNext()) {
        const f    = files.next();
        const noExt = f.getName().replace(/\.[^.]+$/, '');
        if (noExt.toUpperCase().endsWith('_' + initials)) { found = f; break; }
      }
      if (!found) return { success: false, message: 'No file found for tag: doc_' + initials };
      if (found.getMimeType() === MimeType.MICROSOFT_WORD) return { success: false, message: '"' + found.getName() + '" is a .docx — open in Drive and save as Google Docs first.' };
      if (found.getMimeType() !== MimeType.GOOGLE_DOCS)    return { success: false, message: '"' + found.getName() + '" is not a Google Doc.' };
      id = found.getId();
    }
    const paragraphs = DocumentApp.openById(id).getBody().getParagraphs();
    let scanning     = false;
    const refs       = [];
    for (const p of paragraphs) {
      const text = p.getText().trim();
      if (!scanning) { if (/^(references|citations)\s*$/i.test(text)) scanning = true; }
      else { if (text.length > 0) refs.push(text); }
    }
    return { success: true, data: refs };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

// ============================================================
// ONE-TIME SETUP
// Run from Apps Script editor: select setupSpreadsheet > Run
// Safe to re-run — will not overwrite existing data
// ============================================================
function setupSpreadsheet() {
  const spreadsheet = ss();
  const sheets = [
    { name: SHEET_TASKS,     headers: ['ID','Title','Section','Owner','Status','Priority','DueDate','WordTarget','Notes'] },
    { name: SHEET_MEMBERS,   headers: ['Initials','Name'] },
    { name: SHEET_DEADLINES, headers: ['Label','Date'] },
    { name: SHEET_NOTES,     headers: ['ID','Title','Date','Body','Author'] },
    { name: SHEET_AUDIT,     headers: ['Timestamp','Editor','Category','Action','SourceId','EntityTitle','FieldsChanged','PreviousValues','NewValues'] },
    { name: SHEET_SUB_SNAP,  headers: ['FileName','FileId','Size','Modified'] },
    { name: SHEET_SOURCES,   headers: ['ID','Title','Authors','Year','Type','URL','Section','Notes'] },
  ];

  sheets.forEach(def => {
    let sh = spreadsheet.getSheetByName(def.name);
    if (!sh) { sh = spreadsheet.insertSheet(def.name); Logger.log('Created: ' + def.name); }
    const first = sh.getRange(1, 1).getValue();
    if (!first || String(first).trim() === '') {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
        .setFontWeight('bold').setBackground('#1e2023').setFontColor('#8b8e94');
      Logger.log('Headers written: ' + def.name);
    } else {
      Logger.log('Skipped (has data): ' + def.name);
    }
  });

  const sheet1 = spreadsheet.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() === 0) {
    spreadsheet.deleteSheet(sheet1);
    Logger.log('Deleted empty Sheet1');
  }

  Logger.log('Setup complete.');
  SpreadsheetApp.flush();
}
