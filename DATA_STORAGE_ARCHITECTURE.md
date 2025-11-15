# Data Storage Architecture

This document explains what data is stored where and how the data flow works in the Messaging Matrix application.

## Overview

The application uses **THREE different storage locations** for different types of data:

1. **Google Sheets** - Source of truth for matrix data (audiences, topics, messages, assets)
2. **SQLite Database** - Server-side cache + application data (config, users, tasks)
3. **Browser localStorage** - UI preferences and session data

---

## 1. Google Sheets (Source of Truth for Matrix Data)

**Location:** External Google Sheets spreadsheet (configured via `spreadsheetId` in config)

**What's Stored:**
- **Audiences** - Marketing audiences with targeting info
- **Topics** - Content topics for messaging
- **Messages** - Message configurations linking audiences × topics
- **Assets** - Image/video assets with Drive links
- **Creatives** - Pre-built creative files
- **Text Formatting** - Text transformation rules
- **Feed** - Generated feed data (auto-populated from messages)
- **Keywords** - Dynamic keyword mappings

**How It Works:**
- Spreadsheet is the **single source of truth** for matrix data
- Data is loaded from sheets on app start
- Data is saved back to sheets when user clicks "Save"
- Each sheet tab corresponds to a data type

**API Service:** `src/services/sheets.js`
- `loadAll()` - Load all data from Google Sheets
- `saveAll()` - Save all data back to Google Sheets

---

## 2. SQLite Database (Server-Side Cache + App Data)

**Location:** `db/messaging-matrix.db` (on server)

### A. Cached Google Sheets Data (Read-Only Cache)

**Purpose:** Fast local access to sheets data without hitting Google API

**Tables:**
- `audiences` - Cached audience data
- `topics` - Cached topic data
- `messages` - Cached message data
- `assets` - Cached asset data
- `creatives` - Cached creative data
- `text_formatting` - Cached text formatting rules
- `cache_metadata` - Cache status tracking

**How It Works:**
- Cache is updated via `/api/cache/sync` endpoint
- Cache has 15-minute TTL (time-to-live)
- If cache is stale, data is fetched from Google Sheets
- Frontend can use `/api/cache/:table` for fast reads

**Performance:**
- Google Sheets query: 200-500ms
- SQLite cache query: 1-10ms (10-100x faster!)

### B. Application Data (Persistent Storage)

**Purpose:** Store application-specific data not in Google Sheets

**Tables:**

#### `config` table
- **Stores:** Application configuration (spreadsheet ID, Drive folders, patterns, etc.)
- **Replaces:** Old `config.json` file
- **Structure:** Key-value pairs with JSON values
- **API Endpoints:**
  - `GET /api/config` - Get all config
  - `POST /api/config` - Update config

#### `users` table
- **Stores:** User accounts (email, hashed password, role)
- **Replaces:** Old `localStorage` users
- **API Endpoints:**
  - `POST /api/users/login` - Authenticate user
  - `POST /api/users/register` - Create user
  - `GET /api/users` - List all users
  - `PUT /api/users/:id` - Update user
  - `DELETE /api/users/:id` - Delete user

#### `tasks` table
- **Stores:** Task management (extracted from emails, manual tasks)
- **Replaces:** Old `tasks.json` file
- **API Endpoints:**
  - `GET /api/tasks` - Get all tasks
  - `POST /api/tasks/create` - Create task
  - `PUT /api/tasks/:id` - Update task
  - `DELETE /api/tasks/:id` - Delete task

#### `share_galleries` table
- **Stores:** Share gallery metadata (creative/asset collections)
- **Replaces:** Old `public/share/*/share.json` files
- **API Endpoints:**
  - `GET /api/shares/:shareId` - Get share
  - `POST /api/shares` - Create share
  - `POST /api/shares/:shareId/comments` - Add comment

#### `processed_emails` table
- **Stores:** UIDs of processed emails (prevents duplicate task creation)
- **Replaces:** Old `processed-emails.json` file
- **API Endpoints:**
  - `GET /api/processed-emails` - Get processed UIDs
  - `POST /api/processed-emails` - Mark email as processed

#### `uploaded_assets` table
- **Stores:** Registry of locally uploaded assets (different from Google Sheets assets cache)
- **Replaces:** Old `assets.json` file
- **Structure:** Asset metadata (filename, upload date, brand, product, type, dimensions, tags, platforms, status)
- **API Endpoints:**
  - `GET /api/assets/registry` - Get all uploaded assets
  - `POST /api/assets/registry` - Add/update uploaded asset
  - `DELETE /api/assets/registry` - Delete uploaded asset
  - Updated on: `POST /api/assets/confirm-upload` (after asset upload)

---

## 3. Browser localStorage (UI Preferences)

**Location:** Browser's localStorage (client-side)

**What's Stored:**

### `matrixViewState`
**Purpose:** Persist UI view preferences

**Contains:**
- `view` - Current view mode (grid/feed/tree/keywords)
- `statusFilters` - Selected status filters
- `productFilters` - Selected product filters
- `audienceFilter` - Audience search filter
- `topicFilter` - Topic search filter
- `selectedMessages` - Multi-select mode selections
- `treeExpanded` - Tree view expansion state
- `gridZoom` - Grid zoom level (xs/sm/md/lg/xl)

**Saved:** Automatically on every change
**Cleared:** Never (persists across sessions)

### `matrix_state_panel_height`
**Purpose:** Remember panel height preference
**Value:** Height in pixels

### `current_user`
**Purpose:** Session persistence (user is logged in)
**Value:** `{ id, email, role }`
**Note:** Auth data is in SQLite, this is just for session

---

## 4. File System (Text Files for AI Prompts)

**Location:** `src/prompts/*.txt` (on server)

**What's Stored:**
- AI Assistant custom instructions per module
- Data structure documentation for AI context

**Files:**
- `AIMatrixInstructions.txt` - Matrix module AI prompt
- `AICreativeLibraryInstructions.txt` - Creative Library AI prompt
- `AIAssetsInstructions.txt` - Assets AI prompt
- `AIMonitoringInstructions.txt` - Monitoring AI prompt
- `AITemplatesInstructions.txt` - Templates AI prompt
- `AIUsersInstructions.txt` - Users AI prompt
- `AITasksInstructions.txt` - Tasks AI prompt
- `AISettingsInstructions.txt` - Settings AI prompt
- `AIMessagingMatrixDataStructure.txt` - Data structure docs for AI

**How It Works:**
- Text files store module-specific AI prompts
- Loaded via `GET /api/ai-prompts/:module`
- Saved via `POST /api/ai-prompts/:module`
- Edited in Settings module
- Provides context to AI Assistant

**Service:** `src/prompts/` directory
- **Not migrated to SQLite** (intentionally kept as text files for easy editing)

---

## Settings Module Data Storage

### What the Settings Module Manages

**Location:** Settings module (`src/components/Settings.jsx`)

**Data Types:**

#### 1. Application Config (SQLite)
**Stored in:** SQLite `config` table

**Includes:**
- `spreadsheetId` - Google Sheets spreadsheet ID
- `googleDrive` - Drive folder configuration
  - `enabled` - Drive integration on/off
  - `assetsFolderId` - Assets folder ID
  - `creativesFolderId` - Creatives folder ID
- `patterns` - Dynamic pattern templates
  - `pmmid` - PMMID generation pattern
  - `topicKey` - Topic key generation pattern
  - `trafficking` - UTM and trafficking patterns
  - `feed` - Feed field patterns
- `imageBaseUrls` - Base URLs for images
- `treeStructure` - Tree view hierarchy definition
- `feedStructure` - Feed CSV column structure
- `lookAndFeel` - UI theming
  - `logo` - Logo URL
  - `headerColor` - Header background color
  - `logoStyle` - CSS for logo
  - `buttonColor` - Button color
  - `buttonStyle` - Button CSS
  - `secondaryColor1/2/3` - Additional theme colors
  - `statusColors` - Status badge colors

**How It's Stored:**
- Settings service (`src/services/settings.js`) fetches from `/api/config`
- Server reads from SQLite `config` table
- Saved via `POST /api/config` → SQLite `config` table
- **Auto-saved immediately** when you click "Save Settings"

#### 2. AI Prompts (Text Files)
**Stored in:** `src/prompts/*.txt` files (file system)

**Includes:**
- Module-specific AI instructions
- Data structure documentation
- Custom prompts per module

**How It's Stored:**
- Loaded from text files via `/api/ai-prompts`
- Saved to text files via `POST /api/ai-prompts/:module`
- **Saved to disk immediately** when you click "Save Settings"
- Files edited directly by Settings module

### Settings Save Operation

**What happens when you click "Save Settings":**

1. **Config data** → Saved to SQLite via `POST /api/config`
2. **AI prompts** → Saved to text files via `POST /api/ai-prompts/:module`
3. Settings service cache updated
4. Success message shown

**Important:**
- ✅ Settings are **immediately persisted** (no "working state")
- ✅ Changes survive page refresh
- ✅ No need to click "Save" in Matrix State Panel
- Settings ≠ Matrix Data (different save operations)

---

## Matrix State System

### What is "Matrix State"?

**Matrix State** = In-memory representation of the current working data (audiences, topics, messages, etc.)

This is **NOT** the same as database state or saved state!

### Where is Matrix State Stored?

**Location:** React component state in `src/hooks/useMatrix.js`

```javascript
const [audiences, setAudiences] = useState([]);
const [topics, setTopics] = useState([]);
const [messages, setMessages] = useState([]);
const [keywords, setKeywords] = useState({});
const [assets, setAssets] = useState([]);
const [creatives, setCreatives] = useState([]);
const [textFormatting, setTextFormatting] = useState([]);
```

**Important:** Matrix state is in **memory only** until saved!

### Data Flow Diagram

```
┌─────────────────┐
│ Google Sheets   │ ← Source of Truth
│ (Spreadsheet)   │
└────────┬────────┘
         │
         │ Load (on app start)
         ├──────────────────────────┐
         │                          │
         ▼                          ▼
┌────────────────┐          ┌──────────────┐
│  Matrix State  │          │ SQLite Cache │
│  (in memory)   │          │  (optional)  │
└────────┬───────┘          └──────────────┘
         │
         │ User edits
         │ (add/update/delete)
         │
         ▼
┌────────────────┐
│ Modified State │
│ (unsaved)      │
└────────┬───────┘
         │
         │ Click "Save" button
         │
         ▼
┌────────────────┐
│ Google Sheets  │ ← Data saved back
│ (updated)      │
└────────────────┘
```

---

## What Happens On...

### 🔵 App Start / Page Load

1. User logs in (or session restored from localStorage)
2. Config loaded from SQLite (`GET /api/config`)
3. Matrix data loaded from Google Sheets (`sheets.loadAll()`)
4. Matrix state populated in memory
5. UI view state restored from localStorage
6. Matrix displayed to user

### 💾 Save Button Click

**What happens:**
1. User clicks "Save" button in Matrix State Panel
2. Progress modal shows steps
3. `useMatrix.save()` is called
4. Auto-generated fields computed (PMMID, trafficking fields)
5. Complete messages sent to `sheets.saveAll()`
6. Google Sheets API updates all sheets:
   - Audiences sheet
   - Topics sheet
   - Messages sheet
   - Feed sheet (auto-generated)
   - Assets sheet
   - Creatives sheet
7. `lastSync` timestamp updated
8. Success message shown

**Important:**
- ❌ Data is **NOT** saved to SQLite during this process
- ✅ Data is saved to **Google Sheets only**
- The SQLite cache would need to be manually synced via `/api/cache/sync`

### 🔄 Clear & Reload Button Click

**What happens:**
1. User clicks "Clear & Reload" in Matrix State Panel
2. `useMatrix.load()` is called
3. Fresh data fetched from Google Sheets
4. Matrix state overwritten with fresh data
5. All unsaved changes are **LOST**
6. UI refreshed with new data

**Use case:** Discard local changes and reload from source of truth

### 🔍 SQLite Cache Sync

**Manual operation** (not triggered by Save/Reload):

```bash
POST /api/cache/sync
```

**What happens:**
1. Server reads data from Google Sheets
2. SQLite cache tables cleared
3. Fresh data inserted into cache tables
4. Cache metadata updated with sync timestamp

**When to use:**
- After major saves to sheets
- When you want fast API access to latest data
- For offline/low-latency access

---

## Data Persistence Summary

| Data Type | Storage | Persists On | Cleared By |
|-----------|---------|-------------|------------|
| Audiences, Topics, Messages | Google Sheets | Matrix "Save" button | Never (manual deletion) |
| Matrix working state | Memory | Nothing | Reload/Page refresh |
| UI view preferences | localStorage | Auto (on change) | Manual clear |
| **Settings config** | **SQLite** | **Settings "Save" button** | **Database delete** |
| **AI prompts** | **Text files** | **Settings "Save" button** | **Manual file deletion** |
| Users, Tasks | SQLite | API calls | Database delete |
| Share galleries | SQLite | API calls | Database delete |
| **Uploaded assets registry** | **SQLite** | **Asset upload** | **Database delete** |
| Cache (sheets data) | SQLite | Cache sync | Cache clear |
| User session | localStorage | Login | Logout |

---

## Migration Notes

### Old System (Before SQLite)
- Config → `config.json` file
- Tasks → `tasks.json` file
- Processed Emails → `processed-emails.json` file
- Users → `localStorage.app_users`
- Share Galleries → `public/share/*/share.json` files
- Uploaded Assets Registry → `assets.json` file

### New System (After SQLite)
- Config → SQLite `config` table
- Tasks → SQLite `tasks` table
- Processed Emails → SQLite `processed_emails` table
- Users → SQLite `users` table (auth via API)
- Share Galleries → SQLite `share_galleries` table
- Uploaded Assets Registry → SQLite `uploaded_assets` table

**Migration Scripts:**
- `scripts/migrateJsonToSqlite.js` - Migrated config, tasks, emails, shares (already run)
- `scripts/migrateAssetsJsonToSqlite.js` - Migrated uploaded assets (already run)

---

## Best Practices

### When to Save
✅ Save when you've made changes you want to keep
✅ Save before switching to another app/tab (changes in memory only!)
❌ Don't save partial/invalid data
❌ Don't save constantly (Google Sheets API has rate limits)

### When to Reload
✅ Reload when you want to discard changes
✅ Reload when Google Sheets was edited externally
✅ Reload to sync with team changes
❌ Don't reload if you have unsaved work!

### Cache Management
✅ Sync cache after major saves for fast API access
✅ Check cache staleness via `/api/cache/status`
❌ Don't rely on cache for real-time data (use Google Sheets)

---

## API Reference

See `server.js` for full endpoint documentation:

### Matrix Data (Google Sheets)
- No direct API - uses Google Sheets API via `services/sheets.js`

### Config
- `GET /api/config` - Get all config
- `POST /api/config` - Update config

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks/create` - Create task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Users
- `POST /api/users/login` - Login
- `POST /api/users/register` - Register
- `GET /api/users` - List users
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Cache
- `GET /api/cache/:table` - Get cached data
- `POST /api/cache/sync` - Sync from sheets
- `GET /api/cache/status` - Cache metadata

---

**Last Updated:** 2025-11-15 after SQLite migration
