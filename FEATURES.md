# Messaging Matrix - Features Documentation

## Table of Contents
- [Core Features](#core-features)
- [Message Management](#message-management)
- [Preview System](#preview-system)
- [Settings & Configuration](#settings--configuration)
- [Data Synchronization](#data-synchronization)
- [User Interface](#user-interface)

## Core Features

### Interactive Matrix View
The matrix provides a visual grid layout where:
- **Rows** represent Topics
- **Columns** represent Audiences
- **Cells** contain Messages for each Topic-Audience combination

### Drag & Drop Functionality
- **Move Messages**: Drag message cards between audiences
- **Copy Messages**: Ctrl+Drag to copy messages
  - Constraint: Can only copy within same topic (row)
  - Keeps the same message number
  - Updates audience key in the message name

### Advanced Filtering
Filter input in the top-left corner of the matrix:
- **AND Logic**: `keyword1 AND keyword2` - Both keywords must match
- **OR Logic**: `keyword1 OR keyword2` - Either keyword must match
- **Combined**: `key1 AND key2 OR key3` - Complex filtering
- Filters both audiences (columns) and topics (rows)

### Status-based Color Coding
Messages are visually distinguished by status:
- **ACTIVE** - Green background
- **PAUSED** - Gray background
- **PLANNED** - Yellow background
- Empty status defaults to PLANNED

## Message Management

### Creating Messages
1. Click the `+` button in any matrix cell
2. Message is created with:
   - Auto-incremented ID
   - Automatic number assignment (global or cell-specific)
   - Default variant 'a'
   - Version 1
   - Status 'PLANNED'

### Message Numbering Logic
- **Empty Cell**: Gets next global message number with variant 'a'
- **Cell Has Messages**: Uses same number as existing messages, increments variant (a→b→c)
- **Example**: Cell has m1a and m1b → New message becomes m1c

### Content Field Syncing
When editing these fields, changes automatically propagate to all messages with the same number and variant:
- Template
- Landing URL
- Headline
- Copy 1
- Copy 2
- Flash
- CTA

**Unique Fields** (not synced):
- Status
- Comment
- Audience (obviously)
- Topic

### Sync Warning
Edit dialog shows a warning banner listing:
- Number of messages that will be updated
- Which audiences will be affected
- Names of affected messages

### Versioning
- Version increments automatically on save
- Version tracking in message name: `v{version}`
- Helps track message evolution over time

### Validation
- **Delete Protection**: Cannot delete audiences or topics that have messages
- Shows alert if deletion attempted
- Ensures data integrity

## Preview System

### Opening Preview
Click the eye icon on any message card to open preview dialog.

### Preview Components

#### Variant Selector
- Dropdown showing all available variants for the message number
- Switching variant updates the preview content
- Each variant can have different content fields

#### Size Selector
Four template sizes available:
- **300x250** - Medium rectangle
- **300x600** - Half page
- **640x360** - Large mobile banner
- **970x250** - Billboard

Each size has dedicated CSS file for proper formatting.

#### Navigation Buttons
- **Previous ACTIVE**: Navigate to previous ACTIVE message (by number)
- **Next ACTIVE**: Navigate to next ACTIVE message (by number)
- Buttons disabled when no previous/next exists
- Only navigates between ACTIVE status messages
- Skips duplicate numbers (same message in different audiences)

### Template System
Templates use variable replacement:
- `{{headline_text_1}}` → Message headline
- `{{copy_text_1}}` → Message copy1
- `{{copy_text_2}}` → Message copy2
- `{{cta_text_1}}` → Message CTA
- `{{sticker_text_1}}` → Message flash text

Unused variables are cleared from the rendered HTML.

## Settings & Configuration

### Settings Dialog
Access via Settings button (gear icon) in header.

### Spreadsheet ID Management
- Input field for Google Sheets spreadsheet ID
- Google Sheets icon button to open spreadsheet
- Extract ID from URL: `https://docs.google.com/spreadsheets/d/{ID}/edit`

### Persistent Storage
Settings stored in localStorage:
```json
{
  "spreadsheetId": "...",
  "serviceAccountKey": "...",
  "lastUpdated": "2025-01-15T10:30:00Z"
}
```

### Switching Spreadsheets
1. Open Settings dialog
2. Enter new spreadsheet ID
3. Click "Save & Reload"
4. App clears cached data
5. Page reloads and loads new spreadsheet

## Data Synchronization

### Google Sheets Integration

#### Authentication
- Uses Google Cloud service account
- OAuth2 JWT authentication via `jose` library
- Access token cached and refreshed automatically

#### Data Structure
Three sheets required:
1. **Audiences**: ID, Name, Key, Order, Status
2. **Topics**: ID, Name, Key, Order, Status
3. **Messages**: 16 columns including ID, Name, Number, Variant, etc.

#### Save Operation
1. User clicks "Save" button
2. App converts state to row format
3. Clears each sheet completely
4. Writes new data to sheets
5. Updates lastSync timestamp

#### Load Operation
1. App checks localStorage cache first
2. If not found, fetches from Google Sheets using service account
3. Parses rows into structured objects
4. Caches to localStorage
5. Updates UI

### Local Storage
- **Cache Key Format**: `messagingmatrix_data_{SheetName}`
- **Settings Key**: `messagingmatrix_settings`
- **Benefits**: Offline access, faster loading, reduced API calls

### Clear & Reload
Button that:
1. Clears all localStorage
2. Reloads the page
3. Forces fresh fetch from Google Sheets

## User Interface

### Header Bar
- **Title**: "Messaging Matrix"
- **Last Sync**: Shows time since last synchronization
- **Settings**: Opens settings dialog
- **Clear & Reload**: Clears cache and reloads
- **State**: Shows JSON state (for debugging)
- **Save**: Syncs changes to Google Sheets

### Matrix Grid
- **Filter Input**: Top-left cell for filtering
- **Column Headers**: Audiences with edit/add buttons
- **Row Headers**: Topics with edit/add buttons
- **Cells**: Message cards with badges and actions

### Message Cards
Each card shows:
- **Badge**: Message number and variant (e.g., "m1a")
- **Headline**: First line of headline text
- **Actions**:
  - Eye icon: Preview
  - Edit icon: Edit message
  - Visible on hover

### Edit Dialogs

#### Message Edit Dialog
- All message fields editable
- Sync warning banner (if applicable)
- Delete button (with confirmation)
- Save button (increments version)

#### Audience/Topic Edit Dialog
- ID (read-only)
- Name
- Key
- Order
- Status dropdown
- Delete button (with validation)

### Color Scheme
- **Blue**: Settings, links
- **Green**: Save, ACTIVE status, navigation
- **Orange**: Clear & Reload, warnings
- **Purple**: State, preview
- **Yellow**: PLANNED status, sync warnings
- **Gray**: PAUSED status, disabled states
- **Red**: Delete actions

## Performance Optimizations

### Message Lookup
- **O(1) lookup** using hash map
- Index: `${topic}-${audience}` → [messages]
- Rebuilt on message changes
- Eliminates nested loops in rendering

### React Optimization
- `useCallback` for stable function references
- `useMemo` for computed values (implied in effects)
- Efficient re-rendering with proper dependencies

### Caching Strategy
- Primary: localStorage (instant)
- Fallback: Google Sheets API (with auth)
- Update: On save or manual reload

## Keyboard Shortcuts

- **Ctrl+Drag**: Copy message to different audience (same topic only)
- **Escape**: Close dialogs
- **Enter**: Save in input fields

## Data Validation

### ID Auto-increment
- Scans existing IDs
- Finds maximum value
- Increments by 1
- Prevents ID collisions

### Key Uniqueness
While not enforced, keys should be unique:
- Audiences: `aud1`, `aud2`, etc.
- Topics: `top1`, `top2`, etc.

### Required Fields
Messages require:
- ID
- Audience key
- Topic key

Empty or invalid rows are filtered during parsing.

## Error Handling

### Authentication Errors
- Shows error message in UI
- Logs to console
- Provides retry button

### API Errors
- Graceful degradation to localStorage
- Error messages with context
- Console logging for debugging

### Validation Errors
- Alert dialogs for user actions
- Prevents invalid operations
- Clear error messages
