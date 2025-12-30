# Messaging Matrix - Claude Code Instructions

## IMPORTANT: Current Branch
**Working on: `redesign` branch** (NOT main)

This is a major UI/UX redesign branch. All current work should stay on this branch until the redesign is complete.

---

## CRITICAL: Read This First
Before making ANY changes, read the relevant documentation in `/docs/`:
- `DATA_STORAGE_ARCHITECTURE.md` - Where data is stored (Sheets vs SQLite vs memory)
- `SPECIFICATION.md` - Technical specification
- `FEATURES.md` - Feature documentation and patterns

## Architecture Rules - DO NOT VIOLATE

### 1. Matrix State is IN-MEMORY ONLY
Matrix data (audiences, topics, messages, assets, creatives, textFormatting) lives in React state in `useMatrix.js`:
- **DO NOT** create API endpoints for saving matrix data
- **DO NOT** save to SQLite/database when editing matrix data
- All changes stay in memory until user clicks "Save"
- Save goes to Google Sheets, NOT to SQLite

```
Google Sheets → Load → Memory (useMatrix) → User edits → Save → Google Sheets
```

**WRONG**: Creating `/api/textformatting/save` to persist formatting changes
**RIGHT**: Update in-memory state via `setTextFormatting()`, persist only on matrix Save

### 2. ID Generation - ALWAYS Incremental
IDs are simple incremental integers as strings: "1", "2", "3", etc.

```javascript
// CORRECT
const maxId = existingItems.reduce((max, item) => {
  const id = parseInt(item.id, 10);
  return isNaN(id) ? max : Math.max(max, id);
}, 0);
const newId = String(maxId + 1); // "81", "82", etc.

// WRONG - Never do this
const newId = `new-${Date.now()}-${Math.random().toString(36)}`; // NO!
```

### 3. Data Storage Summary
| Data | Storage | When Persisted |
|------|---------|----------------|
| Audiences, Topics, Messages, Assets, Creatives, TextFormatting | Memory (useMatrix.js) | Matrix "Save" button → Google Sheets |
| Config, Users, Tasks, Shares | SQLite | Immediately via API |
| AI Prompts | Text files (`src/prompts/`) | Immediately via API |
| UI Preferences | localStorage | Auto on change |

### 4. Core Files
- `src/hooks/useMatrix.js` - Matrix state management (all matrix data)
- `src/services/sheets.js` - Google Sheets API interaction
- `src/services/settings.js` - Settings service
- `server.js` - Express backend API

### 5. When Adding New Features
1. Does it involve matrix data (audiences/topics/messages/assets/creatives/textFormatting)?
   - YES → Add to useMatrix state, NO API calls needed
   - NO → Maybe needs API/SQLite

2. Does it need to persist immediately?
   - Matrix data: NO, only on explicit Save
   - App data (users, tasks, config): YES, via API

## Anti-Patterns - NEVER DO THESE

1. **DO NOT** create API endpoints for matrix data edits
2. **DO NOT** use random/UUID IDs - always incremental
3. **DO NOT** save matrix data to SQLite (it's just a cache)
4. **DO NOT** call `window.location.reload()` inside async functions before they complete
5. **DO NOT** duplicate classes in HTML (check if exists first)

## Common Patterns

### Adding to Matrix State
```javascript
// In component
const { textFormatting, setTextFormatting } = useMatrix(currentUser);

// To add
setTextFormatting([...textFormatting, newEntry]);

// To delete
setTextFormatting(textFormatting.filter(r => r.id !== idToDelete));

// To update
setTextFormatting(textFormatting.map(r =>
  r.id === idToUpdate ? { ...r, ...updates } : r
));
```

### Passing State Updaters to Child Components
```javascript
// In Matrix.jsx
<MessageEditorDialog
  textFormatting={textFormatting}
  updateTextFormatting={setTextFormatting}  // Pass the setter
/>

// In MessageEditorDialog.jsx
const handleDelete = (id) => {
  updateTextFormatting(textFormatting.filter(r => r.id !== id));
};
```

## Current Features

### Change Tracking (useMatrix.js)
- `originalState`: Deep copy of data when loaded from Google Sheets
- `changeTracking`: Computed object with added/modified/deleted per entity type
- Lenient comparison: empty string = null = undefined
- Used by MatrixStatePanel to show change count badge on Save button

### Text Formatting
- Rules in `textFormatting` array in useMatrix
- Fields: `id`, `text_original`, `text_formatted`, `formatting_scope`, `formatting_mc_scope`
- Scope can be empty (all sizes), array `["300x250"]`, or comma-separated string `"300x250,640x360"`
- MC scope can be empty (global), array, or comma-separated MC identifiers
- `textFormatter.js` handles both array and string formats

### Message Editor Dialog
- Location: `src/components/MessageEditorDialog.jsx`
- Text formatting UI with inline editing
- Real-time preview updates via iframe
- **Auto-save**: 500ms debounced, syncs to variant copies, toggle persisted in localStorage
- **Status sync mode**: "sync" (all variants same status) or "unique" (independent status)

### Matrix State Panel
- Location: `src/components/MatrixStatePanel.jsx`
- Modal overlay with tabbed interface (Audiences, Topics, Messages, etc.)
- "Changes Only" filter to show only modified items
- Change count badge on Save button

### Visualization Views
- **MatrixGridView**: Default grid with sticky headers
- **Tree2View**: Hierarchical tree visualization (`src/components/tree2/`)
- **SankeyView**: Flow/chord diagram (`src/components/sankey/`)
- **TreeView**: Legacy tree view

### Selection Mode (Matrix)
- Enter by long-pressing a message card (white outline appears)
- Multi-select within same cell only
- **Select All**: Circle button in selected cell corner selects all messages in that cell
- **Move/Copy Here**: Appears on hover in empty cells (same row) - click to perform action
- Hold Ctrl/Cmd to switch between Move and Copy mode
- Auto-exits when no messages selected

### Action History & Undo System
- Location: `src/components/Matrix.jsx` (using `actionHistoryRef`)
- Uses `useRef` instead of `useState` to avoid stale closure issues in event handlers
- Logs: add, copy, move operations
- **Undo add**: Deletes the added message
- **Undo copy**: Deletes all copied messages
- **Undo move**: Moves messages back to original audience
- Change tracking excludes "undone" items (new items with status='deleted')

### Keyboard Shortcuts (Matrix View)
| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` / `Cmd+Z` | Undo last action |
| `Ctrl+A` / `Cmd+A` | Select all in cell (selection mode) |
| `Ctrl` (hold) | Switch to Copy mode (selection mode) |
| `ESC` | Exit selection mode |
| `Space` (hold) | Pan mode |

### Templates
- Location: `src/templates/html/`
- Preview uses `previewService.js`
- CSS injection for size-specific styles
