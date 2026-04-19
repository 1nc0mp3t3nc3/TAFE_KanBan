# WelsBoard v4.4 Release Notes

**Released:** Monday, April 20th, 2026
**Previous version:** 4.3
**Files changed:** `config.gs`, `code.gs`, `app.js`, `index.html`, `styles_css.html`
**Files unchanged:** `diagnostics.gs`, `login.html`

---

## Upgrade steps

1. Back up your existing deployment before making any changes.
2. Replace `config.gs`, `code.gs`, `app.js`, `index.html`, and `styles_css.html` with the v4.4 versions.
3. Run `setupSpreadsheet()` from the Apps Script editor - this adds the new **Drafts** sheet non-destructively. Existing data is not affected.
4. Deploy as a **new version** of your existing deployment (do not create a new deployment - this would change the URL).
5. Hard refresh the board URL (`Ctrl+Shift+R`) to clear cached assets.

> **PIN hash format change:** `SERVER_PIN_HASH` is now Base64 SHA-256 instead of hex. If your board uses a PIN gate, regenerate your hash using the command below and update `config.gs` before deploying.
>
> ```
> echo -n "your-pin-here" | openssl dgst -sha256 -binary | base64
> ```
>
> On Windows PowerShell:
> ```powershell
> $bytes = [System.Text.Encoding]::UTF8.GetBytes("your-pin-here")
> $hash  = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
> [Convert]::ToBase64String($hash)
> ```

---

## What's new in 4.4

### Draft autosave

The edit task modal now saves a draft automatically when you click outside it (backdrop click). The next time you open that card, a blue banner appears at the top of the modal with a **Discard** button. Clicking Save clears the draft. Clicking Discard resets the form to the last saved state from the sheet.

Drafts are stored per-user per-card in a new **Drafts** sheet tab. Each draft expires after 12 hours. No draft is shared between group members - each person has their own draft per card.

### Dual word count targets in Report tab

Each section in the Report tab now has an optional **ceiling** input alongside the existing floor target. Enter a ceiling to set your self-imposed upper limit. The progress bar colour changes:

- Blue - within floor target
- Amber - between floor and ceiling (over target but within self-set limit)
- Red - over ceiling

The ceiling value is session-only and resets on page reload. It is intended as a working reference during drafting, not a persisted setting.

### Email meeting note to group

Each meeting note now has an **Email** button. Clicking it sends the note body to all group members who have an email address in the Members sheet.

To enable this feature, add an `Email` column to the Members sheet manually (the header must be exactly `Email`). Members without an email address in that column are skipped. The send is logged to the Audit Log.

### Card notes tooltip fix

Card note previews on the Kanban board now show their tooltip using `position: fixed` coordinates calculated on hover, rather than CSS absolute positioning. This prevents the tooltip from being clipped by the column's overflow boundary and rendering underneath adjacent cards.

### View note modal layout fix

The view note modal no longer inherits the two-column grid layout applied at 1400px and above. It now always renders as a single scrollable column at up to 680px wide, matching its content.

### Edit task modal responsive fix

The two-column grid layout at 1400px+ is now scoped strictly to the edit task modal. Other modals (view note, sources, meeting note) are no longer affected by the wide-screen grid rules.

---

## Bug fixes

- **Word counter hex colour codes** - section keys are now sanitised before being used as identifiers. If a hex colour code was accidentally placed in the `num` field of a section config, it is stripped and falls back to the section name. The underlying config error should still be corrected, but the UI will no longer display raw colour strings in the word count bars.
- **`seedSectionTasks` and `syncReviewCards`** - both functions now fall back to `'System (auto-generated)'` as the audit actor when no identity is passed, instead of logging `Unknown`.

---

## Infrastructure

- `getAuthUrl` switched from manual hex SHA-256 to `Utilities.base64Encode` for PIN hash comparison. This is more reliable across GAS execution contexts. **Requires regenerating `SERVER_PIN_HASH` - see upgrade steps above.**
- New **Drafts** sheet tab created by `setupSpreadsheet()`. Columns: `UserEmail`, `TaskID`, `DraftJSON`, `SavedAt`.
- New server functions: `saveDraft()`, `getDraft()`, `clearDraft()`, `emailNoteToGroup()`.
- New client functions: `showCardTooltip()`, `hideCardTooltip()`, `saveDraftAndClose()`, `discardDraft()`, `applyDraftFields()`, `getDraftFields()`, `updateCeiling()`, `emailNote()`, `sanitiseSectionNum()`.

---

## Compatibility

- Google Sheets data from v4.3 is fully compatible.
- `setupSpreadsheet()` must be run once to add the Drafts sheet.
- If your board uses the PIN gate, `SERVER_PIN_HASH` must be regenerated in Base64 format before deploying.
