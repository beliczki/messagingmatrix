# Changelog

All notable changes to Messaging Matrix are tracked here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · This project uses [Semantic Versioning](https://semver.org/). See the **Versioning** section in [CLAUDE.md](./CLAUDE.md) for bump rules.

## [Unreleased]

_Nothing yet._

---

## [5.2.0] — 2026-04-23

### Added
- **Monitoring module — overhauled.** Replaced the centered sync card with a banner-level performance list joined to the matrix.
  - `MonitoringListView.jsx` (new): table of banner-level reporting rows whose MC label exists in `messages`. Columns: thumbnail + MC | Product | Banner Name | Size | Impressions | Clicks | CTR | AdForm. Sortable per column; default sort = CTR desc. Sticky **totals row** under the header (sum of impressions/clicks + weighted average CTR).
  - `MonitoringToolbar.jsx` (new): floating PocketKnife panel modeled on `MediaToolbar`. Hosts the AdForm sync controls (Campaign prefix + From/To on one row + Sync now), last-sync timestamp, and the result summary. Adds a multi-select **Products** filter pill (same UI as Creative Library) plus a **Show unmatched** checkbox to include banner rows whose MC label isn't in the matrix. All toolbar state persisted to localStorage (`monitoring_*`).
  - **Thumbnails**: each row resolves an image with this fallback chain — message `image1` → `image2` → sibling-variant image — image creative matching MC label → image creative matching MC number — dynamic creative `File_thumbnail` (Drive auto-thumb).
  - **Noise filter**: rows with <50 impressions are dropped before display.
  - `Monitoring.jsx`: rewritten to compose the toolbar + list + existing BottomBar; product is derived from the message's audience (primary) or topic (fallback).
- `.monitoring-scroll` style in `matrix.css` — full-height scroll container with thin custom webkit scrollbar and 96px bottom padding to clear the BottomBar.

---

## [5.1.0] — 2026-04-23

### Added
- **MCP server — per-instance Model Context Protocol endpoint at `/mcp`.** Each deployment (erste, telekom, proficio, demo) exposes its own MCP at `<subdomain>/mcp` for use with Claude Desktop, Cowork, or any MCP client. Ships **17 tools**:
  - Write: `audience_create/remove/update`, `topic_create/remove/update`, `mc_create/remove/update` (PMMID + trafficking fields auto-generated via the existing `generatePMMID` / `generateTraffickingFields` utilities).
  - Read: `list_audiences`, `list_topics`, `list_mc` (filters: topic_key, audience_key, product, status, monitoring_status), `mc_get`.
  - Reporting: `get_mc_reporting` (label-level + banner-level CTR/impressions from the Reporting sheet).
  - Meta: `list_templates` (name + sizes + placeholders from `src/templates/*/`), `list_products`, `matrix_status`.
- `mcp/` directory: `server.js` (Express router + MCP SDK wiring), `auth.js` (bearer-token middleware), `sheets.js` (single-row Google Sheets helpers — separate from `src/services/sheets.js` which does full-table rewrites), `tools/{audiences,topics,messages,meta}.js`.
- New env var `MCP_BEARER_TOKEN`. Endpoint returns 503 if unset, 401 if wrong, 200 otherwise.
- New dep: `@modelcontextprotocol/sdk` ^1.29.0.

### Deferred
- `mc_preview_image` — left out of v1; requires Puppeteer install on prod (~200MB Chromium). See `memory/mcp_preview_deferred.md` for revival paths.

### Concurrency note
MCP writes land directly on Google Sheets. If the matrix UI has unsaved edits open, saving them clobbers MCP changes (UI does full-table rewrite). Save or reload UI around MCP batches.

---

## [5.0.0] — 2026-04-23

### Removed
- **Tasks module — gone.** The `Tasks` menu module, `/tasks` route, `Tasks.jsx` / `TaskEditorDialog.jsx` / `TaskToolbar.jsx` (~3,600 lines combined), and every cross-cutting task touch-point: the "Task" tab in `MessageEditorDialog.jsx`, the "Add to Task" dropdown in `CreativeShare.jsx`, the `?linkTaskId=…` auto-link flow in `Matrix.jsx`, the create-task-from-comment flow in `PreviewView.jsx`, the Tasks tab in `MatrixStatePanel.jsx`, and the `processEmailsToTasks` / `taskContext` / `onTaskAction` surface in `AIAssistant.jsx`.
- **Email-to-task ingestion — gone.** `services/emailService.js`, the Email Account Settings section in `Settings.jsx` → Storage tab, the Tasks + Email-to-Task prompt sections in Settings → Prompts tab, the `emailAccount` config-table row, the IMAP flow and the AI email-to-task conversion prompt.
- **API endpoints removed (11)**: `/api/emails*` (3), `/api/tasks*` (5), `/api/task-labels`, `/api/processed-emails` (2).
- **DB schema — breaking change.** `tasks` and `processed_emails` tables dropped, along with indexes `idx_tasks_bucket`, `idx_tasks_product`, `idx_tasks_priority`. Drizzle definitions in `db/schema.js` removed; `CREATE TABLE` + index blocks in `db/index.js` removed. One-shot migration at `scripts/migrate-remove-tasks.js` (run manually once).
- **AI instruction files removed**: `AI/AITasksInstructions.txt`, `AI/AIEmailToTaskInstructions.txt`. `promptFileMap` in `server.js` updated accordingly.
- **Old task migration scripts deleted**: `scripts/migrateTasksSchemaV2.js`, `scripts/migrate-add-task-email-fields.js`, `scripts/migrate-add-task-labels.js`.

### Why
The Tasks module was never put into real use. It was carrying weight across DB schema, API surface, dialog tabs, and several cross-cutting wires (MC status sync, preview-comment hooks, share-link hooks). Simpler to remove than to keep maintaining.

### Migration required
Run once against your local / server DB:
```bash
node scripts/migrate-remove-tasks.js
```
Backs up nothing by itself — take a DB copy first (`cp db/messaging-matrix.db db/messaging-matrix.db.before-remove-tasks`).

---

## [4.6.0] — 2026-04-22

### Added
- **Monitoring → AdForm sync.** New backend services (`services/adformService.js` for the stats source, `services/adformSyncService.js` for the pull → match → write pipeline) and two endpoints in `server.js`: `POST /api/adform/sync` and `GET /api/adform/status`. For v1 the stats source reads a local xlsx export (default path `data/adform-report.xlsx`, override via `ADFORM_REPORT_PATH`); the live OAuth2 API path is kept commented out at the bottom of `adformService.js` pending end-to-end credential verification.
- **PMMID-based banner matching.** The sync extracts each banner's MC label from either the direct `MC<num><letter>` form or the AdForm PMMID form (`...m_<num>-...-v_<letter>...`). `m_00` placeholders and the `1x1` richmedia size are dropped. Tested against the 22/04/2026 Erste report: 4,229 / 5,227 rows matched, producing 151 unique MC labels with correct impression totals.
- **`Reporting` tab on the matrix spreadsheet.** Sync writes one row per AdForm banner whose name contains an MC label (regex `MC(\d+)([a-z])`), plus one rollup row per MC label. Columns: `Level`, `MC_Label`, `Size`, `AdForm_Banner_ID`, `AdForm_Banner_Name`, `AdForm_Status`, `Impressions`, `Clicks`, `CTR`, `Campaign_ID`, `Campaign_Name`, `Last_Synced_At`. `sheets.saveAll()` never touches this tab — it's external data.
- **Monitoring page UI** — campaign prefix + date range inputs, "Sync now" button, last-sync summary card.
- **Creative Library — "Live in AdForm" filter + CTR sort.** `useMatrix` loads the `Reporting` tab into a new `reporting` array and exposes a `reloadReporting()` helper that bypasses the localStorage cache. `CreativeLibrary.jsx` joins reporting onto each creative (banner-level by MC+size, falling back to label-level), adds a "Live in AdForm" dropdown in `MediaToolbar.jsx`, a `ctr` sort case (nulls always to the end), and a CTR/Impressions column in the list view.

### Changed
- `CLAUDE.md` — added "AdForm Reporting Sync" to Key Subsystem Notes; added `ADFORM_*` entries to the Environment Variables block.
- `.env.example` — documented the new `ADFORM_*` variables.
- `package.json` — `name` cleaned up from `claude-artifact-react-skeleton` → `messagingmatrix`.

---

## [4.5.0] — 2026-04-19

### Added
- Versioning & progress-tracking scaffold: `ROADMAP.md` (living roadmap), `CHANGELOG.md` (this file), `## Versioning` section in `CLAUDE.md` codifying semver bump rules.
- App version display in the UI: subtle footer in the slide-in menu (`v4.5.0`) and dedicated "About" tab on the Settings page (version + build date).
- `package.json` version bumped from `0.0.0` → `4.5.0` as the new baseline reflecting the project's actual maturity (triplet in production, demo instance in flight).
- Frontend build exposes `__APP_VERSION__` and `__BUILD_DATE__` via Vite `define` (see `vite.config.js`).
- `docs/archive/` directory for completed-migration and duplicate docs.

### Changed
- `CLAUDE.md` — corrected the AI prompts path contradiction (`src/prompts/` → `AI/`, verified against `server.js` `promptsDir`).
- `README.md` — version badge and Contact line updated to 4.5.0; inline Roadmap section replaced with pointer to `ROADMAP.md` + `CHANGELOG.md`.
- `TODO.md` — marked as superseded by `ROADMAP.md`; kept for the historical session log only.

### Fixed
- Matrix drag-to-copy now recognizes `Cmd` on macOS (in addition to `Ctrl` on Win/Linux). Previously only `Ctrl` engaged copy mode, which is not the native Mac modifier. Fix in `src/components/Matrix.jsx` `onDragStart` and `onDragOver`.
- Decision tree and Sankey chart now exclude noise audiences: `name === "Incoming"` (workflow-bucket placeholder) and any audience with an empty `strategy` (which rendered as an "Unknown" branch). Filter applied at build-entry in `src/utils/treeBuilder.js`, `src/components/tree2/utils/tree2Builder.js`, and `src/components/sankey/hooks/useSankey.js`.
- Share gallery ZIP downloads now include `empty.png` (the transparent placeholder referenced by ads whose image slots are empty). Added to `supportFiles` in both download handlers in `src/components/PreviewView.jsx`.
- HTML5 banner click handler now works in Adform livepreview. The old `setupClickHandler` in `src/templates/html/index.html` gated the `dhtml.getVar('clickTAG')` call behind the `isAdformContext` flag, which requires `Adform.DynAdsHelper` to be defined. Adform's livepreview frequently exposes `dhtml` without `DynAdsHelper`, leaving the flag `false` and the click URL resolving to `#`. The handler now tries `dhtml.getVar('clickTAG')` unconditionally (inside a try/catch) and only falls back to the meta-tag / `variables.click_url` path if `dhtml` isn't usable — so Adform delivery, Adform livepreview, and our local `/share/` preview all resolve a working click URL.

### Changed
- **Share galleries are now JSON-only in storage.** `POST /api/shares` no longer materializes per-share HTML / CSS / support files under `public/share/{shareId}/`. Instead, it persists only the creative manifest (template name, messageData, bannerSize, order, product, plus `textFormatting`) in `share_galleries.metadata`. Iframe previews and the download ZIP are assembled on the fly from four new dynamic endpoints under `/api/share-html/:shareId/:folderName/`: `index.html` (template populated + Adform-uncommented + CSS-link cleanup, the same transforms the old pipeline baked in), `styles.css` (`main.css` + `{size}.css` concatenated from the template on disk), `manifest.json` (populated with width/height and MC title), and whitelisted support files (`empty.png`, `thm.json`, `dynamic.content.js`) passed through from the template directory. The Adform-ready output and `empty.png`-in-ZIP behavior from 4.5.0 are preserved by these routes.
- Legacy shares created before the JSON-only switch still resolve: `GET /api/shares/:shareId` falls back to enumerating `/public/share/{shareId}/` on the filesystem and returning the old `staticPath` values when the new `metadata.creatives` array is absent.

### Moved to archive
- `docs/QUICK_FIX_REMOUNT.md` → `docs/archive/` (merged conceptually into `REACT_PERFORMANCE_REMOUNT_FIX.md`, which remains authoritative).
- `docs/SQLITE_MIGRATION_COMPLETE.md` → `docs/archive/` (one-time migration, already complete).
- `docs/MATRIX_FINETUNING_LIST.md` → `docs/archive/` (backlog absorbed into `ROADMAP.md`).

---

## [4.4.0] and earlier — reconstructed from `git log`

Pre-baseline history. The entries below summarize the work that shipped before the changelog existed. Dates are commit dates, not release dates.

### Before 2026-04-19 (recent)
- Documented missing PM2/update scripts in `CLAUDE.md`; scoped `#buttonWrapper` span selectors in templates. (aab2ba9)
- Added MC labels convention, AI instructions overview, DB schema overview, instance management, and build config sections to `CLAUDE.md`. (f14e073)
- Full rewrite of `CLAUDE.md`; THM date system fix; template assets; cleaned stale filters. (51bde1d)
- Default PMMID generation; Matrix UI improvements; feed filtering; performance fixes. (b6ef587)
- Reverted an HTML template rewrite that broke dynamic size/class handling across renderers. (cce54c1 ← 3769a50)
- Assets bgColor picker fix; checkerboard changed to subtle grey on transparent. (98738a9)
- New `BottomBar` component with animated centered/sides layout toggle. (259c1c6)
- Virtual-scrolling indicator moved to toolbar; fixed duplicate creative keys. (2b24be7)
- Fixed double re-render in Creative Library; assets served directly from cache. (d857861)
- Encode Sans font + body size class added to NobilisTilia template. (37e981f)
- AI Assistant: added "MC Brewing" mode for package-based content generation. (3302e07)
- Fixed feed text formatting (was using hardcoded sizes instead of template sizes). (a1ad14b)
- Canvas-capture pipeline hardened: background-image data URIs, foreignObjectRendering for accurate font metrics, onclone font-size preservation, SVG conversion, `#adContainer` targeting. (69d7f84, 81a0260, e455138, d9596e0, 25f6fdc, 9c2e6d0, 6285590, 28c8249)
- NobilisTilia template CSS updates. (4d50ec6)
- Export dialog styled to match Share dialog; added DB recovery script. (ab2261f)
- New "Export Images" feature in Creative Library. (fb1e9a7)
- Fixed "export filtered feed" failing when the sheet tab doesn't exist. (4139dc0)

For anything older, consult `git log --oneline`.
