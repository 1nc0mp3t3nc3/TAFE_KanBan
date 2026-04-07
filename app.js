<script>
// ============================================================
// app.js — Client-side application logic
// Version: 3.6
// https://github.com/1nc0mp3t3nc3/taskboard
// ============================================================
// Boot is handled by the inline <script> block in index.html.
// This file contains only reusable application functions.
// ============================================================

// ── GLOBALS ───────────────────────────────────────────────────
var COLUMNS           = CLIENT_CONFIG.columns;
var allTasks          = [];
var allDeadlines      = [];
var allSources        = [];
var memberMap         = {};
var sectionWordCounts = {};
var activeFilter      = 'all';
var srcFilter         = 'all';
var draggedId         = null;
var currentEngine     = 'google';

// ── SECTION COLOR ─────────────────────────────────────────────
function secColorVar(section) {
  var match = CLIENT_CONFIG.sections.find(function (s) { return s.name === section; });
  return 'var(--sec-' + (match ? (match.colorIdx || 0) : 5) + ')';
}

// ── MARKDOWN TOOLBAR ──────────────────────────────────────────
function applyFormat(taId, syntax, block) {
  var ta = document.getElementById(taId);
  if (!ta) return;
  var s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.substring(s, e);
  var rep = block ? syntax + (sel || 'text') : syntax + (sel || 'text') + syntax;
  ta.value = ta.value.substring(0, s) + rep + ta.value.substring(e);
  ta.focus(); ta.setSelectionRange(s + rep.length, s + rep.length);
}
function insertAtCursor(taId, text) {
  var ta = document.getElementById(taId);
  if (!ta) return;
  var s = ta.selectionStart;
  ta.value = ta.value.substring(0, s) + text + ta.value.substring(s);
  ta.focus(); ta.setSelectionRange(s + text.length, s + text.length);
}
function mdToolbar(id) {
  return '<div class="md-toolbar">' +
    '<button type="button" class="md-btn bold"   onclick="applyFormat(\'' + id + '\',\'**\',false)">B</button>' +
    '<button type="button" class="md-btn italic" onclick="applyFormat(\'' + id + '\',\'*\',false)">I</button>' +
    '<button type="button" class="md-btn" onclick="applyFormat(\'' + id + '\',\'__\',false)" style="text-decoration:underline">U</button>' +
    '<div class="md-btn separator"></div>' +
    '<button type="button" class="md-btn" onclick="applyFormat(\'' + id + '\',\'# \',true)">H</button>' +
    '<button type="button" class="md-btn" onclick="insertAtCursor(\'' + id + '\',\'\\n- \')">&#8226; List</button>' +
    '<button type="button" class="md-btn" onclick="applyFormat(\'' + id + '\',\'`\',false)" style="font-family:monospace">Code</button>' +
  '</div>';
}

// ── MARKDOWN PARSER ───────────────────────────────────────────
function parseMarkdown(md) {
  if (!md) return '';
  var h = md.replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h = h.replace(/^###\s+(.*$)/gim,'<h4 style="margin:12px 0 6px 0;">$1</h4>');
  h = h.replace(/^##\s+(.*$)/gim, '<h3 style="margin:12px 0 6px 0;">$1</h3>');
  h = h.replace(/^#\s+(.*$)/gim,  '<h2 style="font-size:16px;margin:0 0 8px 0;color:var(--text);">$1</h2>');
  h = h.replace(/\*\*(.*?)\*\*/gim,'<strong>$1</strong>');
  h = h.replace(/\*(.*?)\*/gim,    '<em>$1</em>');
  h = h.replace(/__(.*?)__/gim,    '<strong>$1</strong>');
  h = h.replace(/_(.*?)_/gim,      '<em>$1</em>');
  h = h.replace(/^\-\s+(.*$)/gim,  '<li style="margin-bottom:4px;">$1</li>');
  h = h.replace(/(<li.*<\/li>\s*)+/gim, '<ul style="margin:8px 0;padding-left:20px;">$&</ul>');
  h = h.split('\n').map(function (l) {
    var t = l.trim();
    if (!t) return '<br>';
    if (t.startsWith('<h') || t.startsWith('<ul') || t.startsWith('<li')) return t;
    return t + '<br>';
  }).join('\n');
  return h.replace(/<br>\s*<ul/g,'<ul').replace(/<\/ul>\s*<br>/g,'</ul>');
}
function plainPreview(text, max) {
  if (!text) return '';
  var p = text.replace(/#{1,3} /g,'').replace(/\*\*/g,'').replace(/`/g,'').replace(/__/g,'').replace(/^- /gm,'').replace(/\n/g,' ').trim();
  return p.length > max ? p.substring(0, max) + '...' : p;
}

// ── DEADLINE BANNER ───────────────────────────────────────────
function daysUntil(dateStr) {
  var t = new Date(); t.setHours(0,0,0,0);
  var d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d - t) / 86400000);
}
function urgencyClass(days)   { return days <= 14 ? 'urgent' : days <= 30 ? 'soon' : 'ok'; }
function countdownText(days)  {
  if (days < 0)  return Math.abs(days) + 'd overdue';
  if (days === 0) return 'Today';
  return days + ' day' + (days === 1 ? '' : 's');
}
function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-AU', { day:'numeric', month:'short', year:'numeric' });
}

function renderDeadlines(deadlines) {
  allDeadlines = deadlines;
  var c = document.getElementById('deadline-chips');
  if (!deadlines || deadlines.length === 0) {
    c.innerHTML = '<span style="font-size:11px;color:var(--text3);font-family:\'DM Mono\',monospace">No deadlines set</span>';
    return;
  }
  c.innerHTML = deadlines.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); })
    .map(function (dl, i) {
      var days = daysUntil(dl.date), urg = urgencyClass(days), safe = dl.label.replace(/'/g,"\\'");
      return '<div class="deadline-chip ' + urg + '" id="dlchip-' + i + '">' +
        '<span class="dl-name">' + dl.label + '</span>' +
        '<span class="dl-date">' + fmtDate(dl.date) + '</span>' +
        '<span class="dl-countdown">' + countdownText(days) + '</span>' +
        '<button class="dl-edit-btn" onclick="toggleDeadlineEdit(event,' + i + ')">&#x270E;</button>' +
        '<div class="dl-edit-panel" id="dl-edit-' + i + '">' +
          '<label>Label</label><input type="text" id="dl-lbl-' + i + '" value="' + dl.label + '">' +
          '<label>Date</label><input type="date" id="dl-date-' + i + '" value="' + dl.date + '">' +
          '<div class="dl-edit-actions">' +
            '<button class="dl-btn-delete" onclick="deleteDeadlineItem(event)">Delete</button>' +
            '<div style="display:flex;gap:6px">' +
              '<button class="dl-btn-cancel" onclick="toggleDeadlineEdit(event,' + i + ')">Cancel</button>' +
              '<button class="dl-btn-save" onclick="saveDeadlineItem(event,' + i + ')">Save</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
}

function toggleDeadlineEdit(e, idx) {
  e.stopPropagation();
  var panel = document.getElementById('dl-edit-' + idx), isOpen = panel.classList.contains('open');
  document.querySelectorAll('.dl-edit-panel.open').forEach(function (p) { p.classList.remove('open'); });
  if (!isOpen) panel.classList.add('open');
}
function saveDeadlineItem(e, idx) {
  e.stopPropagation();
  var label = document.getElementById('dl-lbl-' + idx).value.trim();
  var date  = document.getElementById('dl-date-' + idx).value;
  if (!label || !date) return;
  google.script.run.withSuccessHandler(loadDeadlines).saveDeadline(label, date);
}
function deleteDeadlineItem(e) {
  e.stopPropagation();
  alert('Delete deadlines directly from the Deadlines sheet in Google Sheets.');
}
function openAddDeadline() {
  var label = prompt('Deadline label:');
  if (!label) return;
  var date = prompt('Date (YYYY-MM-DD):');
  if (!date) return;
  google.script.run.withSuccessHandler(loadDeadlines).saveDeadline(label.trim(), date.trim());
}
function loadDeadlines() {
  google.script.run
    .withSuccessHandler(function (dl) {
      if (!dl || dl.error) return;
      renderDeadlines(dl.map(function (d) {
        var raw = d.date, ds = '';
        if (raw instanceof Date || (typeof raw === 'object' && raw !== null)) {
          var dt = new Date(raw);
          ds = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
        } else { ds = String(raw); }
        return { label: d.label, date: ds };
      }));
    })
    .getDeadlines();
}

// ── BOARD ─────────────────────────────────────────────────────
function priChip(p) {
  if (!p) return '';
  return '<span class="chip chip-' + (p === 'High' ? 'pri-high' : p === 'Low' ? 'pri-low' : 'pri-med') + '">' + p + '</span>';
}

function renderBoard(tasks) {
  var filtered = tasks.filter(function (t) {
    if (activeFilter === 'all')  return true;
    if (activeFilter === 'High') return t.Priority === 'High';
    return t.Owner && t.Owner.toLowerCase().includes(activeFilter.toLowerCase());
  });
  var html = '<div class="board-wrap"><div class="board">';
  COLUMNS.forEach(function (col) {
    var colTasks = filtered.filter(function (t) { return t.Status === col.id; });
    html += '<div class="column">' +
      '<div class="col-header ' + col.cls + '"><span class="col-title ' + col.cls + '">' + col.label + '</span><span class="col-count">' + colTasks.length + '</span></div>' +
      '<div class="col-body" id="col-' + col.id.replace(/ /g,'-') + '" ondragover="onDragOver(event)" ondrop="onDrop(event,\'' + col.id + '\')" ondragleave="onDragLeave(event)">';
    if (colTasks.length === 0) html += '<div class="empty-col">No tasks</div>';
    colTasks.forEach(function (t) {
      var color = secColorVar(t.Section);
      html += '<div class="card" draggable="true" id="card-' + t.ID + '" style="--card-sec-color:' + color + '" ondragstart="onDragStart(event,\'' + t.ID + '\')" ondragend="onDragEnd(event)">' +
        '<button class="card-edit-toggle" onclick="openEditModal(event,\'' + t.ID + '\')" title="Edit">&#x270E;</button>' +
        '<div class="card-section" style="color:' + color + '">' + (t.Section || '') + '</div>' +
        '<div class="card-title">' + (t.Title || '') + '</div>' +
        '<div class="card-footer"><span class="card-owner">' + (t.Owner || 'Unassigned') + '</span><span class="card-due">' + (t.DueDate || '') + '</span></div>' +
        '<div class="card-chips">' + (t.WordTarget ? '<span class="chip chip-words">' + t.WordTarget + 'w</span>' : '') + priChip(t.Priority) + '</div>' +
        (t.Notes
          ? '<div class="card-notes" onclick="openViewNoteModal(event,\'' + t.ID + '\')" style="cursor:pointer">' +
              '<div class="card-notes-preview">' + plainPreview(t.Notes, 80) + '</div>' +
              '<div class="card-notes-tooltip">' + parseMarkdown(t.Notes) + '</div>' +
            '</div>'
          : '') +
      '</div>';
    });
    html += '</div></div>';
  });
  html += '</div></div><style>.card::before{background:var(--card-sec-color,var(--border))}</style>';
  document.getElementById('board-container').innerHTML = html;
  updateProgress();
}

function buildSectionOptions(selected) {
  return CLIENT_CONFIG.sections.map(function (s) {
    return '<option value="' + s.name + '"' + (s.name === selected ? ' selected' : '') + '>' + s.name + '</option>';
  }).join('');
}

function loadTasks() {
  google.script.run
    .withSuccessHandler(function (tasks) { allTasks = tasks; renderBoard(allTasks); })
    .withFailureHandler(function (err) {
      document.getElementById('board-container').innerHTML = '<div class="loading" style="color:var(--pri-high)">Error loading tasks: ' + err.message + '</div>';
    })
    .getTasks();
}

function setFilter(f, btn) {
  activeFilter = f;
  document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderBoard(allTasks);
}

function updateProgress() {
  var total = allTasks.length, done = allTasks.filter(function (t) { return t.Status === 'Done'; }).length;
  var pct   = total === 0 ? 0 : Math.round((done / total) * 100);
  var fill  = document.getElementById('progress-fill');
  var pctEl = document.getElementById('progress-pct');
  var cnt   = document.getElementById('progress-counts');
  if (fill)  fill.style.width  = pct + '%';
  if (pctEl) pctEl.textContent = pct + '%';
  if (cnt)   cnt.textContent   = done + ' / ' + total + ' done';
}

// ── DRAG AND DROP ─────────────────────────────────────────────
function onDragStart(e, id) {
  draggedId = id; e.dataTransfer.effectAllowed = 'move';
  setTimeout(function () { var c = document.getElementById('card-' + id); if (c) c.classList.add('dragging'); }, 0);
}
function onDragEnd()       { if (draggedId) { var c = document.getElementById('card-' + draggedId); if (c) c.classList.remove('dragging'); } }
function onDragOver(e)     { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); }
function onDragLeave(e)    { e.currentTarget.classList.remove('drag-over'); }
function onDrop(e, status) {
  e.preventDefault(); e.currentTarget.classList.remove('drag-over');
  if (!draggedId) return;
  var task = allTasks.find(function (t) { return t.ID === draggedId; });
  if (!task || task.Status === status) return;
  task.Status = status; renderBoard(allTasks);
  google.script.run.withFailureHandler(console.error).updateTaskStatus(draggedId, status);
  draggedId = null;
}

// ── ADD TASK MODAL ────────────────────────────────────────────
function openAddModal()  { document.getElementById('addModal').classList.add('open'); document.getElementById('f-notes-toolbar').innerHTML = mdToolbar('f-notes'); }
function closeModal()    { document.getElementById('addModal').classList.remove('open'); }
function saveTask() {
  var task = {
    Title:      document.getElementById('f-title').value,
    Section:    document.getElementById('f-section').value,
    Owner:      document.getElementById('f-owner').value || 'Unassigned',
    Priority:   document.getElementById('f-priority').value,
    DueDate:    document.getElementById('f-due').value,
    WordTarget: document.getElementById('f-words').value,
    Notes:      document.getElementById('f-notes').value,
  };
  if (!task.Title) return;
  closeModal();
  google.script.run.withSuccessHandler(loadTasks).withFailureHandler(console.error).addTask(task);
}

// ── EDIT TASK MODAL ───────────────────────────────────────────
function openEditModal(e, id) {
  if (e) e.stopPropagation();
  var task = allTasks.find(function (t) { return t.ID === id; });
  if (!task) return;
  document.getElementById('e-task-id').value        = id;
  document.getElementById('e-title').value          = task.Title      || '';
  document.getElementById('e-section').innerHTML    = buildSectionOptions(task.Section);
  document.getElementById('e-owner').innerHTML      = buildOwnerOptions(task.Owner);
  document.getElementById('e-due').value            = task.DueDate    || '';
  document.getElementById('e-priority').innerHTML   = ['High','Medium','Low'].map(function (p) {
    return '<option' + (p === task.Priority ? ' selected' : '') + '>' + p + '</option>';
  }).join('');
  document.getElementById('e-words').value          = task.WordTarget || '';
  document.getElementById('e-notes').value          = task.Notes      || '';
  document.getElementById('e-notes-toolbar').innerHTML = mdToolbar('e-notes');
  document.getElementById('editTaskModal').classList.add('open');
}
function closeEditModal() { document.getElementById('editTaskModal').classList.remove('open'); }
function saveEditModal() {
  var id = document.getElementById('e-task-id').value;
  if (!id) return;
  var btn = document.getElementById('e-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  var fields = {
    Title:      document.getElementById('e-title').value,
    Section:    document.getElementById('e-section').value,
    Owner:      document.getElementById('e-owner').value || 'Unassigned',
    DueDate:    document.getElementById('e-due').value,
    Priority:   document.getElementById('e-priority').value,
    WordTarget: document.getElementById('e-words').value,
    Notes:      document.getElementById('e-notes').value,
  };
  var task = allTasks.find(function (t) { return t.ID === id; });
  if (task) Object.assign(task, fields);
  var pending = Object.keys(fields).length;
  var done = function () {
    if (--pending === 0) { btn.textContent = 'Save changes'; btn.disabled = false; closeEditModal(); renderBoard(allTasks); }
  };
  Object.entries(fields).forEach(function (kv) {
    google.script.run.withSuccessHandler(done).withFailureHandler(function (err) { console.error(err); done(); }).updateTaskField(id, kv[0], kv[1]);
  });
}

// ── VIEW NOTE MODAL ───────────────────────────────────────────
function openViewNoteModal(e, id) {
  e.stopPropagation();
  var task = allTasks.find(function (t) { return t.ID === id; });
  if (!task || !task.Notes) return;
  document.getElementById('vn-title').textContent = task.Title;
  document.getElementById('vn-content').innerHTML = parseMarkdown(task.Notes);
  document.getElementById('vn-btns').innerHTML =
    '<button class="btn-cancel" onclick="closeViewNoteModal()" style="flex:1">Close</button>' +
    '<button class="btn-save" onclick="switchToEditMode(\'' + id + '\')" style="flex:1">Edit Task</button>';
  document.getElementById('viewNoteModal').classList.add('open');
}
function closeViewNoteModal() { document.getElementById('viewNoteModal').classList.remove('open'); }
function switchToEditMode(id) { closeViewNoteModal(); setTimeout(function () { openEditModal(null, id); }, 50); }

// ── MEMBERS ───────────────────────────────────────────────────
function loadMembers(callback) {
  google.script.run
    .withSuccessHandler(function (members) {
      if (!members || members.error) { if (callback) callback(); return; }
      memberMap = {};
      members.forEach(function (m) { memberMap[String(m.initials).toUpperCase()] = m.name; });
      renderMembersTable(members);
      populateOwnerDropdowns();
      if (callback) callback();
    })
    .withFailureHandler(function () { if (callback) callback(); })
    .getMembers();
}
function renderMembersTable(members) {
  var tbody = document.getElementById('members-body');
  if (!tbody) return;
  if (!members || members.length === 0) { tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text3);font-size:12px;padding:12px 10px">No members yet</td></tr>'; return; }
  tbody.innerHTML = members.map(function (m) {
    return '<tr><td style="font-family:\'DM Mono\',monospace;font-size:12px;color:var(--text2)">' + m.initials + '</td>' +
      '<td style="font-size:13px;color:var(--text)">' + m.name + '</td>' +
      '<td><button class="btn-del" onclick="removeMember(\'' + m.initials + '\')">&#x2715;</button></td></tr>';
  }).join('');
}
function addMember() {
  var initials = document.getElementById('new-initials').value.trim().toUpperCase();
  var name     = document.getElementById('new-name').value.trim();
  if (!initials || !name) return;
  google.script.run.withSuccessHandler(function () {
    document.getElementById('new-initials').value = '';
    document.getElementById('new-name').value = '';
    loadMembers();
  }).saveMember(initials, name);
}
function removeMember() { alert('Remove members directly from the Members sheet in Google Sheets.'); }
function buildOwnerOptions(selected) {
  return ['Unassigned'].concat(Object.values(memberMap)).map(function (n) {
    return '<option' + (n === selected ? ' selected' : '') + '>' + n + '</option>';
  }).join('');
}
function populateOwnerDropdowns() {
  var opts = ['Unassigned'].concat(Object.values(memberMap)).map(function (n) { return '<option>' + n + '</option>'; }).join('');
  var sel  = document.getElementById('f-owner');
  if (sel) sel.innerHTML = opts;
  buildFilterButtons();
}
function buildFilterButtons() {
  var c = document.getElementById('filter-btns');
  if (!c) return;
  c.innerHTML = ['<button class="filter-btn active" onclick="setFilter(\'all\',this)">All</button>']
    .concat(Object.values(memberMap).map(function (n) { return '<button class="filter-btn" onclick="setFilter(\'' + n.replace(/'/g,"\\'") + '\',this)">' + n + '</button>'; }))
    .concat([
      '<button class="filter-btn" onclick="setFilter(\'Unassigned\',this)">Unassigned</button>',
      '<button class="filter-btn" onclick="setFilter(\'High\',this)">High priority</button>',
    ]).join('');
}

// ── SUBMISSIONS TAB ───────────────────────────────────────────
function renderDocs(docs) {
  var c = document.getElementById('docs-container');
  if (!docs || docs.error) { c.innerHTML = '<div class="docs-empty">Error loading documents</div>'; return; }
  if (docs.length === 0)   { c.innerHTML = '<div class="docs-empty">No files uploaded yet.</div>'; return; }
  var iconFor = function (t) {
    if (t && t.includes('pdf'))         return { label:'PDF', cls:'' };
    if (t && t.includes('document'))    return { label:'DOC', cls:'gdoc' };
    if (t && t.includes('spreadsheet')) return { label:'XLS', cls:'gsheet' };
    return { label:'FILE', cls:'' };
  };
  c.innerHTML = '<div class="docs-grid">' + docs.map(function (doc) {
    var icon     = iconFor(doc.type);
    var noExt    = doc.name.replace(/\.[^.]+$/,'');
    var initials = noExt.split('_').pop().toUpperCase();
    var owner    = memberMap[initials] || null;
    var tag      = owner ? 'doc_' + initials : '';
    var tagHtml  = tag ? '<span onclick="event.preventDefault();navigator.clipboard.writeText(\'' + tag + '\');var t=this;t.textContent=\'Copied!\';setTimeout(function(){t.textContent=\'' + tag + '\'},1500);" style="margin-left:6px;padding:2px 6px;background:var(--surface2);border:1px solid var(--border2);border-radius:4px;font-family:\'DM Mono\',monospace;font-size:10px;color:var(--accent);cursor:pointer;" title="Click to copy tag">' + tag + '</span>' : '';
    return '<a class="doc-card" href="' + doc.url + '" target="_blank">' +
      (owner ? '<div class="doc-tooltip">' + owner + '</div>' : '') +
      '<div class="doc-icon ' + icon.cls + '">' + icon.label + '</div>' +
      '<div class="doc-info"><div class="doc-name">' + doc.name + '</div>' +
      '<div class="doc-meta" style="display:flex;align-items:center">' + doc.size + ' &middot; ' + doc.modified + (owner ? ' &middot; ' + owner : '') + tagHtml + '</div></div>' +
    '</a>';
  }).join('') + '</div>';
}
function loadDocs() {
  document.getElementById('docs-container').innerHTML = '<div class="docs-loading"><div class="spinner"></div> Loading...</div>';
  google.script.run.checkSubmissionsChanges();
  google.script.run.withSuccessHandler(renderDocs).withFailureHandler(function (e) {
    document.getElementById('docs-container').innerHTML = '<div class="docs-empty">Failed: ' + e.message + '</div>';
  }).getDocuments();
}
function syncReviewCards() {
  var btn = document.getElementById('sync-btn');
  btn.textContent = 'Scanning...'; btn.style.opacity = '.6'; btn.style.pointerEvents = 'none';
  google.script.run
    .withSuccessHandler(function (result) {
      btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
      btn.textContent = result && result.created > 0 ? 'Added ' + result.created : 'Up to date';
      if (result && result.created > 0) loadTasks();
      setTimeout(function () { btn.textContent = 'Sync review tasks'; }, 2500);
    })
    .withFailureHandler(function () {
      btn.textContent = 'Sync failed'; btn.style.opacity = '1'; btn.style.pointerEvents = 'auto';
      setTimeout(function () { btn.textContent = 'Sync review tasks'; }, 2500);
    })
    .syncReviewCards();
}

// ── MEETING NOTES ─────────────────────────────────────────────
function renderNotes(notes) {
  var c = document.getElementById('notes-container');
  if (!notes || notes.error) { c.innerHTML = '<div class="notes-empty">Error loading notes</div>'; return; }
  if (notes.length === 0)    { c.innerHTML = '<div class="notes-empty">No meeting notes yet.</div>'; return; }
  c.innerHTML = notes.slice().reverse().map(function (n) {
    return '<div class="note-entry">' +
      '<div class="note-header"><div>' +
        '<div class="note-meta">' + (n.date || '') + (n.author && n.author !== 'Unassigned' ? ' &middot; ' + n.author : '') + '</div>' +
        '<div class="note-title-text">' + (n.title || '') + '</div>' +
      '</div><button class="note-del" onclick="deleteNote(\'' + String(n.id).replace(/'/g,"\\'") + '\')">&#x2715;</button></div>' +
      '<div class="note-body">' + parseMarkdown(n.body) + '</div>' +
    '</div>';
  }).join('');
}
function loadNotes() {
  var c = document.getElementById('notes-container');
  if (!c) return;
  c.innerHTML = '<div class="docs-loading"><div class="spinner"></div> Loading notes...</div>';
  google.script.run.withSuccessHandler(renderNotes).withFailureHandler(function (e) {
    c.innerHTML = '<div class="notes-empty">Failed: ' + e.message + '</div>';
  }).getNotes();
}
function openNoteModal() {
  document.getElementById('n-title').value = '';
  document.getElementById('n-date').value  = new Date().toLocaleDateString('en-AU', {day:'numeric',month:'short',year:'numeric'});
  document.getElementById('n-body').value  = '';
  var sel = document.getElementById('n-author');
  if (sel) sel.innerHTML = ['Unassigned'].concat(Object.values(memberMap)).map(function (n) { return '<option>' + n + '</option>'; }).join('');
  document.getElementById('noteModal').classList.add('open');
  document.getElementById('n-body-toolbar').innerHTML = mdToolbar('n-body');
}
function closeNoteModal() { document.getElementById('noteModal').classList.remove('open'); }
function saveNote() {
  var title = document.getElementById('n-title').value.trim();
  if (!title) return;
  closeNoteModal();
  google.script.run.withSuccessHandler(loadNotes).addNote(
    title,
    document.getElementById('n-date').value.trim(),
    document.getElementById('n-body').value.trim(),
    document.getElementById('n-author').value
  );
}
function deleteNote() { alert('Delete notes directly from the Meeting Notes sheet in Google Sheets.'); }

// ── MEETING SCHEDULER ─────────────────────────────────────────
function generateMeetLink() {
  var title = document.getElementById('meet-title').value.trim();
  var date  = document.getElementById('meet-date').value;
  var start = document.getElementById('meet-start').value;
  var end   = document.getElementById('meet-end').value;
  var tz    = document.getElementById('meet-tz').value;
  if (!date || !start || !end) { alert('Please select a date, start time, and end time.'); return; }
  var fmt = function (d, t) { return d.replace(/-/g,'') + 'T' + t.replace(/:/g,'') + '00'; };
  window.open('https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) +
    '&dates=' + fmt(date, start) + '/' + fmt(date, end) + '&ctz=' + tz +
    '&details=' + encodeURIComponent('Auto-generated by the Task Board.'), '_blank');
}

// ── REPORT TAB ────────────────────────────────────────────────
function loadReportSections() {
  var list = document.getElementById('at3-section-list');
  if (!list) return;
  list.innerHTML = '<div class="docs-loading"><div class="spinner"></div> Syncing word counts...</div>';
  google.script.run
    .withSuccessHandler(function (liveCounts) {
      sectionWordCounts = liveCounts || {};
      google.script.run
        .withSuccessHandler(function (sections) { renderReportSections(sections); updateAt3Progress(); })
        .withFailureHandler(function (e) { list.innerHTML = '<div class="docs-empty">Failed to load sections: ' + e.message + '</div>'; })
        .getSectionDocuments();
    })
    .withFailureHandler(function () {
      // If live counts fail, still load sections with empty counts
      google.script.run
        .withSuccessHandler(function (sections) { renderReportSections(sections); updateAt3Progress(); })
        .getSectionDocuments();
    })
    .getLiveWordCounts();
}

function renderReportSections(sections) {
  var list = document.getElementById('at3-section-list');
  if (!sections || sections.error || sections.length === 0) {
    list.innerHTML = '<div class="docs-empty">No sections found. Check your documents folder and SECTION_CONFIG in Code.gs.</div>';
    return;
  }
  list.innerHTML = sections.map(function (sec) {
    var wc = sectionWordCounts[sec.num] || 0;
    return '<div class="section-item">' +
      '<span class="section-num">'    + sec.num  + '</span>' +
      '<span class="section-name">'   + sec.name + '</span>' +
      '<span class="section-target">' + (sec.target > 0 ? '~' + sec.target + 'w' : 'no limit') + '</span>' +
      '<div class="section-wc">' +
        '<input type="number" id="wc-' + sec.num + '" value="' + wc + '" min="0" placeholder="0">' +
        '<span class="wc-label-sm">words</span>' +
      '</div>' +
      (sec.docUrl
        ? '<a class="open-doc-btn" href="' + sec.docUrl + '" target="_blank">Open &#x2197;</a>'
        : '<span class="open-doc-btn" style="opacity:.4;cursor:default">No doc found</span>') +
    '</div>';
  }).join('');
}

function updateAt3Progress() {
  var total  = Object.values(sectionWordCounts).reduce(function (a, b) { return a + b; }, 0);
  var target = CLIENT_CONFIG.reportWordTarget;
  var pct    = Math.min(100, Math.round((total / target) * 100));
  var fill   = document.getElementById('at3-fill');
  var tot    = document.getElementById('at3-total-wc');
  if (fill) fill.style.width = pct + '%';
  if (tot)  tot.textContent  = total + ' / ' + target + ' words';
  var bars = document.getElementById('at3-section-bars');
  if (bars) {
    bars.innerHTML = CLIENT_CONFIG.sections.filter(function (s) { return s.target > 0; }).map(function (sec) {
      var wc   = sectionWordCounts[sec.num] || 0;
      var p    = Math.min(100, Math.round((wc / sec.target) * 100));
      var done = wc >= sec.target;
      var col  = done ? '#4caf76' : 'var(--accent2)';
      return '<div class="at3-bar-row">' +
        '<span class="at3-bar-name">' + sec.name + '</span>' +
        '<div class="at3-bar-track"><div class="at3-bar-fill" style="width:' + p + '%;background:' + col + '"></div></div>' +
        '<span class="at3-bar-pct" style="color:' + col + '">' + wc + ' / ' + sec.target + '</span>' +
      '</div>';
    }).join('');
  }
}

// ── SOURCES ───────────────────────────────────────────────────
function loadSources() {
  google.script.run
    .withSuccessHandler(function (sources) {
      if (!sources || sources.error) { document.getElementById('sources-container').innerHTML = '<div class="sources-empty">Error loading sources</div>'; return; }
      allSources = sources; renderSources(sources);
    })
    .withFailureHandler(function (e) { document.getElementById('sources-container').innerHTML = '<div class="sources-empty">Failed: ' + e.message + '</div>'; })
    .getSources();
}
function renderSources(sources) {
  var c        = document.getElementById('sources-container');
  var filtered = srcFilter === 'all' ? sources : srcFilter === 'journal' ? sources.filter(function (s) { return s.type === 'journal'; }) : sources.filter(function (s) { return s.section === srcFilter; });
  document.getElementById('src-count').textContent = filtered.length + ' source' + (filtered.length !== 1 ? 's' : '');
  if (filtered.length === 0) { c.innerHTML = '<div class="sources-empty">No sources found.</div>'; return; }
  c.innerHTML = '<table class="sources-table"><thead><tr><th>Title / Authors</th><th>Year</th><th>Type</th><th>Section</th><th>Notes</th><th></th></tr></thead><tbody>' +
    filtered.map(function (s) {
      return '<tr>' +
        '<td style="max-width:240px"><div class="src-title">' + (s.title||'') + '</div>' +
          '<div style="font-size:11px;color:var(--text3);font-family:\'DM Mono\',monospace;margin-top:2px">' + (s.authors||'') + '</div>' +
          (s.url ? '<a class="src-url" href="' + s.url + '" target="_blank">' + s.url + '</a>' : '') + '</td>' +
        '<td style="white-space:nowrap;font-family:\'DM Mono\',monospace;font-size:12px">' + (s.year||'') + '</td>' +
        '<td><span class="src-type-badge ' + (s.type||'') + '">' + (s.type||'') + '</span></td>' +
        '<td style="font-size:12px;font-family:\'DM Mono\',monospace;color:var(--text3)">' + (s.section||'') + '</td>' +
        '<td style="font-size:12px;color:var(--text2);max-width:200px">' + (s.notes||'') + '</td>' +
        '<td><button class="src-del" onclick="editSource(\'' + s.id + '\')" title="Edit">&#x270E;</button>' +
             '<button class="src-del" onclick="deleteSource(\'' + s.id + '\')" title="Delete">&#x2715;</button></td>' +
      '</tr>';
    }).join('') + '</tbody></table>';
}
function filterSources(f, btn) {
  srcFilter = f;
  document.querySelectorAll('.src-filter-btn').forEach(function (b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  renderSources(allSources);
}
function openSourceModal() {
  document.getElementById('src-edit-id').value = '';
  document.getElementById('src-modal-title').textContent = 'Add source';
  document.getElementById('src-save-btn').textContent    = 'Add source';
  ['src-title','src-authors','src-year','src-url','src-notes'].forEach(function (id) { document.getElementById(id).value = ''; });
  document.getElementById('srcModal').classList.add('open');
}
function editSource(id) {
  var s = allSources.find(function (src) { return String(src.id) === String(id); });
  if (!s) return;
  document.getElementById('src-edit-id').value = id;
  document.getElementById('src-modal-title').textContent = 'Edit source';
  document.getElementById('src-save-btn').textContent    = 'Save changes';
  document.getElementById('src-title').value   = s.title   || '';
  document.getElementById('src-authors').value = s.authors || '';
  document.getElementById('src-year').value    = s.year    || '';
  document.getElementById('src-url').value     = s.url     || '';
  document.getElementById('src-notes').value   = s.notes   || '';
  var typeEl = document.getElementById('src-type');
  if (typeEl && s.type) { for (var i = 0; i < typeEl.options.length; i++) { if (typeEl.options[i].value === s.type) { typeEl.selectedIndex = i; break; } } }
  var secEl  = document.getElementById('src-section-select');
  if (secEl && s.section) { for (var j = 0; j < secEl.options.length; j++) { if (secEl.options[j].value === s.section || secEl.options[j].text === s.section) { secEl.selectedIndex = j; break; } } }
  document.getElementById('srcModal').classList.add('open');
}
function closeSrcModal() { document.getElementById('srcModal').classList.remove('open'); }
function saveSource() {
  var editId = document.getElementById('src-edit-id').value;
  var source = {
    title:   document.getElementById('src-title').value.trim(),
    authors: document.getElementById('src-authors').value.trim(),
    year:    document.getElementById('src-year').value.trim(),
    type:    document.getElementById('src-type').value,
    url:     document.getElementById('src-url').value.trim(),
    section: document.getElementById('src-section-select').value,
    notes:   document.getElementById('src-notes').value.trim(),
  };
  if (!source.title) return;
  closeSrcModal();
  var fn = editId ? function () { google.script.run.withSuccessHandler(loadSources).withFailureHandler(function (e) { alert('Update failed: ' + e.message); }).updateSource(editId, source); }
                  : function () { google.script.run.withSuccessHandler(loadSources).withFailureHandler(function (e) { alert('Add failed: ' + e.message); }).addSource(source); };
  fn();
}
function deleteSource(id) {
  if (!confirm('Delete this source? This cannot be undone.')) return;
  google.script.run.withSuccessHandler(loadSources).withFailureHandler(function (e) { alert('Delete failed: ' + e.message); }).deleteSource(id);
}
function quickAddSource() {
  var input = document.getElementById('quick-url-input'), btn = document.getElementById('quick-fetch-btn'), val = input.value.trim();
  if (!val) return;
  btn.textContent = 'Fetching...'; btn.style.pointerEvents = 'none'; btn.style.opacity = '.6';
  google.script.run
    .withSuccessHandler(function (meta) {
      btn.textContent = 'Fetch metadata'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1';
      if (meta.error) { alert('Could not fetch: ' + meta.error); return; }
      document.getElementById('src-title').value   = meta.title   || '';
      document.getElementById('src-authors').value = meta.authors || '';
      document.getElementById('src-year').value    = meta.year    || '';
      document.getElementById('src-url').value     = meta.url     || val;
      document.getElementById('src-notes').value   = meta.journal ? 'Published in: ' + meta.journal : '';
      input.value = '';
      document.getElementById('src-edit-id').value = '';
      document.getElementById('src-modal-title').textContent = 'Add source';
      document.getElementById('src-save-btn').textContent    = 'Add source';
      document.getElementById('srcModal').classList.add('open');
    })
    .withFailureHandler(function (err) { btn.textContent = 'Fetch metadata'; btn.style.pointerEvents = 'auto'; btn.style.opacity = '1'; alert('Fetch failed: ' + err.message); })
    .fetchSourceMetadata(val);
}
function pushReferencesToDoc() {
  var btn    = document.getElementById('push-refs-btn');
  var format = document.getElementById('citation-format').value;
  if (allSources.length === 0) { alert('No sources to push. Add some sources first.'); return; }
  var labels = { ieee:'IEEE', apa:'APA 7th', harvard:'Harvard', chicago:'Chicago', plain:'Plain text' };
  if (!confirm('Push ' + allSources.length + ' source(s) to the References doc in ' + (labels[format]||format) + ' format?\n\nThis will replace the entire doc content.')) return;
  btn.disabled = true; btn.textContent = 'Pushing...';
  google.script.run
    .withSuccessHandler(function (result) {
      btn.disabled = false; btn.textContent = 'Push to References doc';
      if (result.error) { alert('Error: ' + result.error); return; }
      var msg = result.count + ' source(s) written to ' + result.docName;
      btn.textContent = msg;
      setTimeout(function () { btn.textContent = 'Push to References doc'; }, 4000);
      if (confirm(msg + '\n\nOpen the doc now?')) window.open(result.url, '_blank');
    })
    .withFailureHandler(function (err) { btn.disabled = false; btn.textContent = 'Push to References doc'; alert('Failed: ' + err.message); })
    .pushReferencesToDoc(format);
}

// ── RESEARCH / DORKS ──────────────────────────────────────────
function setEngine(eng) {
  currentEngine = eng;
  document.getElementById('eng-google').classList.toggle('active',  eng === 'google');
  document.getElementById('eng-scholar').classList.toggle('active', eng === 'scholar');
}
function loadDork(btn) {
  document.getElementById('search-query').value = btn.getAttribute('data-query');
  setEngine(btn.getAttribute('data-engine') || 'google');
}
function runSearch() {
  var q = document.getElementById('search-query').value.trim();
  if (!q) return;
  window.open((currentEngine === 'scholar' ? 'https://scholar.google.com/scholar?q=' : 'https://www.google.com/search?q=') + encodeURIComponent(q), '_blank');
}
function renderDorkButtons() {
  var c     = document.getElementById('dork-container');
  var dorks = CLIENT_CONFIG.searchDorks || [];
  if (!c || dorks.length === 0) return;
  c.innerHTML = dorks.map(function (group) {
    return '<div class="dork-section"><div class="dork-label">' + group.label + '</div><div class="dork-buttons">' +
      group.dorks.map(function (d) {
        return '<button class="dork-btn" data-query="' + d.query.replace(/&/g,'&amp;').replace(/"/g,'&quot;') + '" data-engine="' + (d.engine || 'google') + '" onclick="loadDork(this)">' + d.label + '</button>';
      }).join('') +
    '</div></div>';
  }).join('');
}

// ── TAB SWITCHING ─────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(function (b)   { b.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');
  if (tab === 'docs')    loadDocs();
  if (tab === 'notes')   loadNotes();
  if (tab === 'report')  loadReportSections();
  if (tab === 'sources') loadSources();
  if (tab === 'audit')   loadAuditLog();
}

// ── AUDIT LOG ─────────────────────────────────────────────────
function loadAuditLog() {
  var c = document.getElementById('audit-container');
  c.innerHTML = '<div class="docs-loading"><div class="spinner"></div> Loading...</div>';
  google.script.run
    .withSuccessHandler(function (entries) {
      if (!entries || entries.error || entries.length === 0) { c.innerHTML = '<div class="audit-empty">No audit entries found.</div>'; return; }
      c.innerHTML = '<div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Timestamp</th><th>Editor</th><th>Category</th><th>Action</th><th>Details</th></tr></thead><tbody>' +
        entries.map(function (e) {
          return '<tr><td>' + e.timestamp + '</td><td>' + e.editor + '</td><td>' + e.category + '</td><td>' + e.action + '</td><td>' + e.entityTitle + ' ' + e.fieldsChanged + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    })
    .withFailureHandler(function () { c.innerHTML = '<div class="audit-empty">Error loading audit log.</div>'; })
    .getAuditLog();
}
</script>
