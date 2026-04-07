Group Assessment Task Board v3.6
A collaborative kanban-style task board built on Google Apps Script for student groups working on assessed projects. Designed for TAFE Queensland Higher Education units but generic enough for any group assessment.
Features:

Drag-and-drop kanban board with five status columns
Deadline banner with colour-coded urgency countdown
Submission file tracking linked to Google Drive
Meeting notes with markdown support and Google Meet scheduler
Report section tracker with live word counts from Google Docs
Source/reference manager with Harvard, APA, IEEE, Chicago output
Reference scanner that reads directly from submitted Google Docs
Audit log tracking all changes with editor, timestamp, and field diff
Pre-built Google search dork queries for academic research
One-click seeding of section tasks and Google Doc placeholders
PIN-based group authentication with 12-hour session tokens


File Structure
Code.gs          — Backend (Google Apps Script)
config.js        — Project configuration (THE ONLY FILE YOU EDIT)
index.html       — Main board UI
app.js           — Client-side application logic
styles.css.html  — Stylesheet
login.html       — PIN login page

Setup for a New Project
Step 1 — Create your Google resources

Create a new Google Sheet (this is your database)
Create a Google Drive folder for AT submissions (shared with your group)
Create a Google Drive folder for report documents (shared with your group)
Note the IDs from each URL:

Sheet: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
Folder: https://drive.google.com/drive/folders/FOLDER_ID



Step 2 — Create the Apps Script project

Open your Google Sheet
Go to Extensions > Apps Script
Delete the default Code.gs content
Copy each file from this repository into the corresponding Apps Script file:

Code.gs → Code.gs
config.js → New file: config.js
index.html → New file: index.html
app.js → New file: app.js
styles.css.html → New file: styles.css.html
login.html → New file: login.html




Note: In Apps Script, HTML files must use the .html extension. When creating config.js and app.js, create them as HTML files but name them config.js and app.js — Apps Script will accept them.

Step 3 — Configure Code.gs
At the top of Code.gs, set your three IDs:
javascriptconst SPREADSHEET_ID        = 'YOUR_SPREADSHEET_ID_HERE';
const SUBMISSIONS_FOLDER_ID = 'YOUR_SUBMISSIONS_FOLDER_ID_HERE';
const DOCUMENTS_FOLDER_ID   = 'YOUR_DOCUMENTS_FOLDER_ID_HERE';
Set your group PIN hash. Default is 1234. To change it:

Go to https://emn178.github.io/online-tools/sha256.html
Type your PIN and copy the hash
Replace the value of SERVER_PIN_HASH

Update SECTION_CONFIG to match your report structure:
javascriptconst SECTION_CONFIG = [
  { num: '001', name: 'Executive Summary', target: 100 },
  { num: '002', name: 'Introduction',      target: 300 },
  // add one entry per section
];

num: three-digit prefix used to match Google Doc filenames
name: must exactly match the name values in config.js
target: word count target (use 0 for sections with no limit)

Step 4 — Configure config.js
Edit config.js to match your project. This is the only file you should need to touch for a new deployment:
javascriptconst CLIENT_CONFIG = {
  projectName:      'CYB801 AT3',
  projectSubtitle:  'Cyber Risk and Governance Strategy',
  logoText:         'AT3',
  reportWordTarget: 2500,

  submissionsFolderUrl: 'https://drive.google.com/drive/folders/YOUR_ID',
  documentsFolderUrl:   'https://drive.google.com/drive/folders/YOUR_ID',

  headerChips: [
    { label: 'Report 30%',     accent: false },
    { label: 'Due 17/05/2026', accent: true  },
  ],

  sections: [
    { num: '001', name: 'Executive Summary', target: 100,  colorIdx: 7 },
    { num: '002', name: 'Introduction',      target: 300,  colorIdx: 0 },
    // ...
  ],

  searchDorks: [], // set to [] to hide the Research tab
};
Important: The name values in sections[] must exactly match the name values in SECTION_CONFIG in Code.gs. They are used as task section labels and for matching word counts.
colorIdx maps to CSS colour variables --sec-0 through --sec-9:
IndexColour0Blue1Purple2Green3Amber4Red5Grey6Pink7Light blue8Cyan9Orange
Step 5 — Initialise the spreadsheet

In Apps Script, select setupSpreadsheet from the function dropdown
Click Run
Approve any permission requests
Check the execution log — you should see each sheet created with headers

This is safe to re-run. It will not overwrite existing data.
Step 6 — Deploy as a Web App

Click Deploy > New deployment
Click the gear icon next to "Select type" and choose Web app
Set:

Execute as: Me
Who has access: Anyone with a Google account


Click Deploy
Copy the Web App URL — this is your board URL


Every time you make changes to the code, you must create a new deployment for them to take effect. Editing existing deployments does not update the running code.

Step 7 — First run

Open the Web App URL
Enter your group PIN (default: 1234)
On the Task Board tab, click Seed section tasks to auto-create cards for each report section
On the Report tab, click Seed report docs to create Google Doc placeholders in your documents folder
Add your group members on the Submissions tab
Add deadlines using the + Add deadline button


Board Features
Task Board

Drag cards between columns to update status
Click the pencil icon on any card to edit all fields
Click a card's notes preview to open the full notes viewer
Seed section tasks: creates one card per section with word target and earliest deadline pre-filled
Sync review tasks: scans the submissions folder and creates a review card for each uploaded file

Submissions Tab

Lists all files in the submissions Drive folder
Files named with group member initials (e.g. AT2_Submission_GW.pdf) show a doc_GW tag
Click the tag to copy it — paste it into the Reference Scanner to scan that person's doc

Meeting Notes

Add structured meeting notes with markdown support
Schedule Google Meet sessions that open directly in Google Calendar

Report Tab

Lists all sections with links to the corresponding Google Doc
Sync word counts: reads live word counts directly from your Google Docs
Progress bars turn green when a section meets its word target
Seed report docs: creates named Google Doc placeholders in your documents folder if they don't exist

Sources Tab

Add, edit, and delete academic sources
Auto-fetch metadata from a URL or DOI
Filter by section or source type
Push formatted references directly to your References Google Doc in Harvard, APA, IEEE, or Chicago format
Reference Scanner: paste a Google Doc ID or doc_XX tag to extract all text under a "References" heading

Audit Log

Full change history: who changed what field, from what value, to what value
Filter by editor, item, or action type

Research Tab

Pre-built Google and Google Scholar search queries from config.js
Click any query to load it into the search bar
Toggle between Google and Scholar with one click
Set searchDorks: [] in config.js to hide this tab entirely


Naming Conventions
Submission files
Name files ending with your initials: AT3_Report_GW.pdf
The board will automatically detect the initials and link the file to the group member. The doc_GW tag can then be used in the Reference Scanner.
Report docs
Name Google Docs with the three-digit prefix matching your SECTION_CONFIG:
001 Executive Summary, 002 Introduction, etc.
The board matches files by prefix so the Report tab can link directly to them.

Troubleshooting
Board shows "Loading tasks..." forever
The most common cause is a mismatch between the sheet tab names and the constants in Code.gs. Check that your Google Sheet has tabs named exactly: Tasks, Members, Deadlines, Meeting Notes, Audit Log, Submissions Snapshot, Sources. Run setupSpreadsheet() to create any missing tabs.
Functions not appearing in Apps Script editor
A syntax error anywhere in Code.gs prevents all functions from being registered. Look for red underlines in the editor. Common causes: nested function definitions, unmatched braces, or stray characters.
Changes not reflected after editing code
Apps Script caches deployed versions. After any code change, you must create a new deployment — not edit the existing one. Use Deploy > New deployment each time.
"seedSectionTasks is not a function" error
The currently deployed version does not include seedSectionTasks. Create a new deployment after adding the function.
Reference Scanner returns "not a Google Doc"
The scanner can only read native Google Docs. .docx files uploaded to Drive must be opened in Google Docs and saved as Google Docs format first (File > Save as Google Docs).
Word counts showing as 0
The getLiveWordCounts() function reads Google Docs directly. It only counts files with a three-digit numeric prefix (e.g. 001, 002). Files must be native Google Docs, not uploaded .docx files.

Architecture Notes

Authentication: PIN is hashed with SHA-256 on the client and verified server-side. Valid sessions are stored in Apps Script CacheService for 12 hours. The PIN itself is never stored or transmitted in cleartext after hashing.
Single source of truth: config.js is the authoritative source for all client-side configuration. Code.gs has its own SECTION_CONFIG array for backend operations — keep these in sync.
No localStorage: Apps Script sandboxes iframes and disables browser storage APIs. All state is held in JavaScript variables for the session duration.
Audit logging: Every write operation calls logAudit_() which appends a timestamped row to the Audit Log sheet. The Session.getActiveUser().getEmail() will return an empty string for personal Gmail accounts (Google Workspace accounts will return the email).


Changelog
v3.6

Single boot block in index.html (removed duplicate from app.js)
All UI strings now derived from CLIENT_CONFIG (project name, subtitle, logo, chips, meet title, upload example filename)
Research tab automatically hidden when searchDorks: []
seedSectionTasks() and seedReportDocs() added as top-level backend functions
getLiveWordCounts() reads word counts directly from Google Docs
addSource(), updateSource(), deleteSource(), fetchSourceMetadata(), pushReferencesToDoc() added to backend
src-modal-overlay CSS fix: base state is now display: none (was rendering inline on page load)
All missing CSS utility classes restored: .wc-bar, .progress-bar-wrap, .spinner, report tab, sources, audit, research
SECTION_CONFIG section numbers deduplicated (Tasks 9-14 now use unique num values 012-017)
Removed saveWordCount() call (function did not exist in backend)
Removed client-side getLiveWordCounts() function (server-side only)
setupSpreadsheet() extracted from nested position, now a top-level function


License
MIT License. Free to use, modify, and distribute for educational purposes.
Developed by Geoff Welsford (@1nc0mp3t3nc3) 
