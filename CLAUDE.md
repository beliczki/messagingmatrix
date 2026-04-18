# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start both frontend and backend concurrently
npm run dev:all

# Start individually
npm run dev          # Vite dev server on port 5173
npm run server       # Express backend on port 3003

# Build & preview
npm run build        # Production build to dist/
npm run preview      # Preview production build

# Lint
npm run lint              # ESLint (--max-warnings 0)
npx eslint . --fix        # Auto-fix where possible (no script alias)

# PM2 (production)
npm run pm2:start    # Start all processes
npm run pm2:stop     # Stop all
npm run pm2:restart  # Restart all
npm run pm2:logs     # View logs
npm run pm2:status   # List processes
npm run pm2:delete   # Delete all processes

# Deploy update (runs update.sh)
npm run update

# Instance management (save/load different project configs)
npm run instance:save
npm run instance:load
npm run instance:list

# Kill/restart dev servers (Windows)
npm run kill
npm run restart
```

There are no tests in this project.

## High-Level Architecture

### Frontend + Backend Split
- **Frontend**: React 18 + Vite (port 5173), TailwindCSS, React Router with lazy-loaded routes
- **Backend**: Express server (port 3003) — `server.js` (~4,300 lines, monolithic)
- **Proxy**: Vite dev server proxies `/api/*` requests to the Express backend

### Services Directory Split
- `src/services/` — **frontend** services (browser-side: `sheets.js`, `settings.js`, `driveStorage.js`, etc.). Imported by React components.
- `services/` (repo root) — **backend** services (Node-side: `syncService.js`, `emailService.js`). Imported by `server.js` only.
Do not mix them: backend modules use Node APIs (IMAP, fs, better-sqlite3) that won't bundle for the browser.

### Data Flow — The Critical Rule

```
Google Sheets (source of truth) → Load → React Memory (useMatrix) → User edits → Save → Google Sheets
                                                                                    ↕
                                                                            SQLite (read cache only)
```

Matrix data (audiences, topics, messages, assets, creatives, textFormatting) lives **only** in React state via `src/hooks/useMatrix.js`. It is **never** persisted to SQLite on edit. Save writes to Google Sheets.

SQLite (`db/messaging-matrix.db`) stores **app data** (config, users, tasks, shares, processed emails) immediately via API, and caches Sheets data for fast reads.

### Key Layers

| Layer | Location | Role |
|-------|----------|------|
| Matrix state | `src/hooks/useMatrix.js` | In-memory state for all matrix data, change tracking |
| Sheets service | `src/services/sheets.js` | Google Sheets API (read/write via service account JWT) |
| Settings service | `src/services/settings.js` | Lazy-init config from `/api/config` |
| Drive storage | `src/services/driveStorage.js` | Google Drive file ops, upload, metadata |
| Auth context | `src/contexts/AuthContext.jsx` | JWT auth, user session |
| API server | `server.js` | Express REST API, Google APIs, file serving |
| Database | `db/index.js` + `db/schema.js` | Drizzle ORM + better-sqlite3, WAL mode |
| Sync service | `services/syncService.js` | Sheets ↔ SQLite cache sync |
| Email service | `services/emailService.js` | IMAP email fetch, parse, convert to tasks |

### Server API Endpoint Groups (server.js)
- `/api/sheets/*` — Google Sheets read/write
- `/api/cache/*` — SQLite cache sync and diagnostics
- `/api/config*` — App configuration
- `/api/claude/*`, `/api/gemini/*`, `/api/grok/*` — AI providers (Claude, Gemini, Grok) with streaming
- `/api/ai-prompts/*` — Editable AI prompt files
- `/api/drive/*` — Google Drive (upload, list, proxy, search, quota)
- `/api/templates*` — Template management and file serving
- `/api/shares/*`, `/api/share-html/*` — Share gallery system
- `/api/tasks*`, `/api/task-labels` — Task CRUD
- `/api/users*` — User management + auth
- `/api/emails*` — Email integration
- `/api/assets/*` — Asset registry
- `/api/messages/search` — Full-text message search
- `/api/textformatting*` — Text formatting rules

### Frontend Routing (App.jsx)
Lazy-loaded modules: Matrix, CreativeLibrary, Assets, Monitoring, Templates, Tasks, Users (admin), Settings (admin), Login, PreviewView (public share galleries). Role-based access controls admin routes.

## Architecture Rules — DO NOT VIOLATE

### 1. Matrix State is IN-MEMORY ONLY
- **DO NOT** create API endpoints for saving matrix data
- **DO NOT** save to SQLite/database when editing matrix data
- All changes stay in memory until user clicks "Save"
- Save goes to Google Sheets, NOT to SQLite

**WRONG**: Creating `/api/textformatting/save` to persist formatting changes
**RIGHT**: Update in-memory state via `setTextFormatting()`, persist only on matrix Save

### 2. ID Generation — ALWAYS Incremental
IDs are simple incremental integers as strings: "1", "2", "3", etc.

```javascript
// CORRECT
const maxId = existingItems.reduce((max, item) => {
  const id = parseInt(item.id, 10);
  return isNaN(id) ? max : Math.max(max, id);
}, 0);
const newId = String(maxId + 1);

// WRONG — Never do this
const newId = `new-${Date.now()}-${Math.random().toString(36)}`;
```

### 3. Data Storage Summary

| Data | Storage | When Persisted |
|------|---------|----------------|
| Audiences, Topics, Messages, Assets, Creatives, TextFormatting | Memory (useMatrix.js) | Matrix "Save" button → Google Sheets |
| Config, Users, Tasks, Shares | SQLite | Immediately via API |
| AI Prompts | Text files (`src/prompts/`) | Immediately via API |
| UI Preferences | localStorage | Auto on change |

### 4. When Adding New Features
1. Does it involve matrix data (audiences/topics/messages/assets/creatives/textFormatting)?
   - YES → Add to useMatrix state, NO API calls needed
   - NO → Likely needs API/SQLite

2. Does it need to persist immediately?
   - Matrix data: NO, only on explicit Save
   - App data (users, tasks, config): YES, via API

## Anti-Patterns — NEVER DO THESE

1. **DO NOT** create API endpoints for matrix data edits
2. **DO NOT** use random/UUID IDs — always incremental
3. **DO NOT** save matrix data to SQLite (it's just a cache)
4. **DO NOT** call `window.location.reload()` inside async functions before they complete — use `clearAndReloadApp()` from `src/utils/clearAndReload.js` which selectively clears only `messagingmatrix_data_*` keys (preserving auth/preferences) before reloading
5. **DO NOT** duplicate classes in HTML (check if exists first)

## Common Patterns

### Matrix State CRUD
```javascript
const { textFormatting, setTextFormatting } = useMatrix(currentUser);

// Add
setTextFormatting([...textFormatting, newEntry]);
// Delete
setTextFormatting(textFormatting.filter(r => r.id !== idToDelete));
// Update
setTextFormatting(textFormatting.map(r =>
  r.id === idToUpdate ? { ...r, ...updates } : r
));
```

### Passing State Updaters to Child Components
```javascript
// Parent (Matrix.jsx)
<MessageEditorDialog
  textFormatting={textFormatting}
  updateTextFormatting={setTextFormatting}
/>

// Child
const handleDelete = (id) => {
  updateTextFormatting(textFormatting.filter(r => r.id !== id));
};
```

## Key Subsystem Notes

### Change Tracking (useMatrix.js)
- `originalState`: Deep copy of data when loaded from Sheets
- `changeTracking`: Computed object with added/modified/deleted per entity type
- Lenient comparison: empty string = null = undefined
- Shown via MatrixStatePanel badge on Save button

### Text Formatting
- Rules in `textFormatting` array within useMatrix
- Fields: `id`, `text_original`, `text_formatted`, `formatting_scope`, `formatting_mc_scope`
- Scope: empty (all sizes), array `["300x250"]`, or comma-separated string
- `src/utils/textFormatter.js` handles both formats

### Templates & Asset Loading
**Location**: `src/templates/{templateName}/` — each contains `index.html` (with `{{placeholder}}` syntax), `template.json` (bindings + path config), CSS files, and `empty.png` (required transparent placeholder).

**Asset path resolution:**
```
Message value present  → /api/drive/proxy/{value}
Message value empty    → /api/templates/{templateName}/empty.png
```

Key rendering files: `CreativeLibraryItem.jsx`, `CreativePreview.jsx`, `MessageEditorDialog.jsx`

### Tasks & MC Status Sync
When a task's bucket changes, all linked MCs (in `outputContent`, format "MC282a") get their status updated to match the bucket name. This happens in `Tasks.jsx` → `updateTask()` via `matrixData.updateMessage()` — requires Matrix Save to persist.

### Module-Level Persistent Refs (Matrix.jsx)
`persistentMatrixRefs` is a **module-level** object (line ~31) that survives component remounts during navigation. It caches filtered audiences/topics and their dependency signatures to avoid recalculating on every re-render. This exists because React Router lazy-loading unmounts/remounts Matrix — normal `useRef` would lose state. See `docs/REACT_PERFORMANCE_REMOUNT_FIX.md` for rationale.

### useRef vs useState for Event Handlers
Throughout Matrix.jsx, `useRef` is used for values read during drag/click/undo handlers (e.g., `actionHistoryRef`, `draggedMsgRef`, `isCopyModeRef`, `longPressTimerRef`). This prevents stale closure bugs — `useState` values captured in callbacks don't update, but `.current` always reflects the latest value.

### Action History & Undo (Matrix.jsx)
Uses `useRef` (not `useState`) for `actionHistoryRef` to avoid stale closures. Supports undo for add/copy/move operations. Change tracking excludes "undone" items (new items with status='deleted').

### Database (SQLite + Drizzle ORM)
- Schema: `db/schema.js` — Drizzle table definitions
- Connection: `db/index.js` — better-sqlite3 with WAL mode, 5s busy timeout
- Migration scripts: `scripts/migrate-*.js`
- Database file: `db/messaging-matrix.db`

## Environment Variables (.env)

```
PORT=3003
JWT_SECRET=<secret>
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
VITE_API_URL=https://messagingmatrix.ai
VITE_ANTHROPIC_API_KEY=<Claude API key>
GEMINI_API_KEY=<Gemini key>
GROK_API_KEY=<Grok key>
```

### Safe Save Guard (useMatrix.js)
Prevents saving when no matrix data is loaded (`audiences.length > 0 || topics.length > 0 || messages.length > 0`). This protects against accidentally wiping the spreadsheet with empty data.

## Message Naming Convention (MC Labels)

Messages are identified by their `number` + `variant` as **MC labels**: `MC282a`, `MC1b`, etc. This label is used:
- In the UI to display messages across Matrix, Creative Library, Tasks
- In task linking: `task.outputContent` is an array of MC labels (e.g., `["MC282a", "MC283b"]`)
- In file exports: `MC{number}_{variant}_{width}x{height}.{ext}`
- In PMMID generation: `patternEvaluator.js` → `generatePMMID()` uses configurable patterns from admin settings

When a task's bucket changes, linked MC statuses sync to match the bucket name — see Tasks & MC Status Sync above.

## AI Instructions

The `AI/` directory contains 13 instruction files that drive AI assistant behavior across the app. Each page/feature has its own AI instruction file (e.g., `AIMatrixInstructions.txt`, `AITasksInstructions.txt`, `AICreativeLibraryInstructions.txt`). These are loaded as system context when the AI assistant is used on that page. `AiClientContext.txt` provides the data structure context shared across all AI features.

Editable AI prompts live in `src/prompts/` and are served/saved via `/api/ai-prompts/*`.

## Database Schema Overview

**Cache tables** (read-only mirror of Google Sheets — synced via `syncService.js`):
- `audiences`, `topics`, `messages`, `assets`, `creatives`, `text_formatting`
- `cache_metadata` — tracks sync status per entity type

**App data tables** (written directly via API):
- `users` — email/password (SHA-256), roles: admin/user/demo
- `tasks` — task management with buckets (backlog/review/done), MC linking via `outputContent`
- `config` — key-value store with JSON values, categorized (pattern, lookAndFeel, googleDrive, etc.)
- `share_galleries` — share gallery metadata, creative/asset ID lists
- `processed_emails` — tracks which emails have been converted to tasks
- `uploaded_assets` — locally uploaded asset registry with metadata JSON

Performance indexes exist on `messages(topic, audience)`, `messages(status)`, `assets(brand, product, type, file_drive_id)`, `creatives(brand, product, file_drive_id)`.

## Instance Management

The `instances/` directory stores named snapshots of project configuration (database, config, env). Use `npm run instance:save/load/list` to switch between different project contexts (e.g., different clients). Managed by `scripts/instance-switch.js`.

## Build Configuration

Vite uses manual chunk splitting (`vite.config.js`) — large components (Matrix, MessageEditorDialog, CreativeLibrary, AIAssistant, Assets, Templates) each get their own chunk. Vendor code splits into react-vendor, ui-vendor (lucide), editor-vendor (CodeMirror), and general vendor. Chunk size warning limit is 1000KB.

## Documentation

Read these before making architectural changes:
- `docs/DATA_STORAGE_ARCHITECTURE.md` — Where data lives (Sheets vs SQLite vs memory)
- `docs/SPECIFICATION.md` — Comprehensive technical specification
- `docs/FEATURES.md` — Feature documentation and patterns
- `docs/REACT_PERFORMANCE_REMOUNT_FIX.md` — Why Matrix.jsx uses module-level persistent refs
- `docs/ASSET_NAMING_SYSTEM.md` — Asset metadata parsing from filenames
- `docs/PERFORMANCE_IMPROVEMENTS.md` — SQLite caching & Drive proxy caching strategies
- `docs/PRODUCTION_SETUP.md` — Production deployment guide
- `docs/DEPLOYMENT_HETZNER.md` — Hetzner-specific deployment
- `docs/SERVER_MANAGEMENT.md` — PM2 and server operations
- `docs/GOOGLE_DRIVE_SETUP.md` — Google Drive service account setup
- `docs/SQLITE_MIGRATION_COMPLETE.md` — Migration from JSON to SQLite
