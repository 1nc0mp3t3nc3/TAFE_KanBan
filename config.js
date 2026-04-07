<script>
// ============================================================
// config.js — THE ONLY FILE YOU EDIT PER PROJECT
// Version: 3.6
// https://github.com/1nc0mp3t3nc3/taskboard
// ============================================================
// CHECKLIST FOR A NEW PROJECT:
//  1. projectName, projectSubtitle, logoText
//  2. reportWordTarget
//  3. submissionsFolderUrl, documentsFolderUrl
//  4. headerChips — weightings and due dates
//  5. sections[] — one entry per report section
//       num:      three-digit prefix of your Google Doc filename
//                 e.g. num '003' matches "003 Analysis.gdoc"
//       name:     display name — MUST match SECTION_CONFIG names in Code.gs
//       target:   word count target (0 = no target e.g. title page)
//       colorIdx: 0-9, maps to --sec-0..--sec-9 in styles.css
//  6. searchDorks[] — pre-built queries for the Research tab
//                     set to [] to hide the Research tab
//  7. In Code.gs: update SPREADSHEET_ID, SUBMISSIONS_FOLDER_ID,
//     DOCUMENTS_FOLDER_ID, SERVER_PIN_HASH, and SECTION_CONFIG
// ============================================================

const CLIENT_CONFIG = {

  // ── PROJECT IDENTITY ──────────────────────────────────────
  projectName:      'CYB801 AT3',
  projectSubtitle:  'Cyber Risk and Governance Strategy',
  logoText:         'AT3',
  reportWordTarget: 2500,

  // ── DRIVE FOLDER URLS ─────────────────────────────────────
  submissionsFolderUrl: 'https://drive.google.com/drive/folders/YOUR_SUBMISSIONS_FOLDER_ID',
  documentsFolderUrl:   'https://drive.google.com/drive/folders/YOUR_DOCUMENTS_FOLDER_ID',

  // ── HEADER CHIPS ──────────────────────────────────────────
  // accent: true = highlighted blue (use for due dates)
  // accent: false = muted (use for weightings / word counts)
  headerChips: [
    { label: 'Report 30%',       accent: false },
    { label: 'Presentation 10%', accent: false },
    { label: '2500 words',       accent: false },
    { label: 'Due 17/05/2026',   accent: true  },
  ],

  // ── KANBAN COLUMNS ────────────────────────────────────────
  // id must match Status values stored in the Tasks sheet
  // cls maps to CSS column colour classes in styles.css
  columns: [
    { id: 'Not started', label: 'Not started', cls: 'ns'    },
    { id: 'In progress', label: 'In progress', cls: 'ip'    },
    { id: 'In review',   label: 'In review',   cls: 'ir'    },
    { id: 'Done',        label: 'Done',        cls: 'done'  },
    { id: 'Blocked',     label: 'Blocked',     cls: 'block' },
  ],

  // ── REPORT SECTIONS ───────────────────────────────────────
  // Single source of truth for the client side.
  // Drives: section dropdowns, word count bar, report tab,
  //         source filters, and seed task generation.
  //
  // num must match the three-digit prefix of your Google Doc
  // filename in the documents folder.
  //
  // IMPORTANT: name values must exactly match the name values
  // in SECTION_CONFIG in Code.gs.
  sections: [
    { num: '001', name: 'Executive Summary',          target: 100,  colorIdx: 7 },
    { num: '002', name: 'Introduction',               target: 300,  colorIdx: 0 },
    { num: '003', name: 'Analysis',                   target: 500,  colorIdx: 1 },
    { num: '004', name: 'Risk & Governance Strategy', target: 1000, colorIdx: 2 },
    { num: '005', name: 'Implementation Plan',        target: 500,  colorIdx: 3 },
    { num: '006', name: 'Conclusion',                 target: 100,  colorIdx: 4 },
    { num: '007', name: 'References',                 target: 0,    colorIdx: 5 },
  ],

  // ── RESEARCH DORKS ────────────────────────────────────────
  // Pre-built search queries shown on the Research tab.
  // Set to [] to hide the Research tab entirely.
  // engine: 'google' (default) or 'scholar'
  searchDorks: [
    {
      label: 'Australian regulatory sources',
      dorks: [
        { label: 'OAIC NDB reports (PDF)',     query: 'site:oaic.gov.au "notifiable data breaches" filetype:pdf' },
        { label: 'ACSC Essential Eight (PDF)', query: 'site:cyber.gov.au "essential eight" filetype:pdf'         },
        { label: 'ASIC cyber resilience',      query: 'site:asic.gov.au "cyber resilience" "AFS licensee"'       },
      ],
    },
    {
      label: 'Academic sources',
      dorks: [
        { label: 'Scholar: board cyber governance AU', query: '"cyber security governance" "board of directors" "Australia"', engine: 'scholar' },
        { label: 'Scholar: Essential Eight response',  query: '"Essential Eight" "incident response" "Australia"',            engine: 'scholar' },
      ],
    },
  ],

};
// ============================================================
// END OF CONFIG — do not edit below this line
// ============================================================
</script>
