# Messaging Matrix - Context Index

Quick reference guide to all context files and where to find specific information.

**Last Updated**: 2025-10-26 | **Version**: 2.0.0

## Quick Navigation

| Need to... | Check this file |
|------------|----------------|
| Get started quickly | `context-quickstart.md` |
| Understand data flow | `context-architecture.md` → Data Model |
| Find a component | `context-components.md` → Component Hierarchy |
| Debug sync issues | `skills/debug-sync.md` |
| Understand API endpoints | `context-api.md` |
| Learn common workflows | `context-workflows.md` |
| Debug PMMID generation | `skills/analyze-pattern.md` |
| Optimize performance | `skills/optimize-performance.md` |
| Upload assets | `context-workflows.md` → Asset Upload |
| Create shares | `skills/create-share.md` |
| Find configuration | `context-architecture.md` → Configuration System |
| **NEW: Google Drive setup** | `docs/GOOGLE_DRIVE_SETUP.md` |
| **NEW: Asset naming** | `docs/ASSET_NAMING_SYSTEM.md` |
| **NEW: PM2 management** | `docs/SERVER_MANAGEMENT.md` |

---

## By Topic

### Architecture & Setup
- **System Overview**: `context-architecture.md` → Project Overview
- **Directory Structure**: `context-architecture.md` → Key Directory Structure
- **Data Model**: `context-architecture.md` → Data Model
- **Storage Strategy**: `context-architecture.md` → Data Model → Data Storage Strategy
- **Authentication**: `context-architecture.md` → Authentication Systems
- **Configuration**: `context-architecture.md` → Configuration System
- **Environment Setup**: `context-quickstart.md` → Development Setup
- **Google Drive Integration**: `docs/GOOGLE_DRIVE_SETUP.md`
- **PM2 Process Management**: `docs/SERVER_MANAGEMENT.md`

### Components
- **Component List**: `context-components.md` → Component Hierarchy
- **Matrix Component**: `context-components.md` → Matrix.jsx (1,530 lines)
- **Message Editor**: `context-components.md` → MessageEditorDialog.jsx (1,320 lines)
- **Tree View**: `context-components.md` → TreeView.jsx (902 lines)
- **Asset Management**: `context-components.md` → Assets.jsx (377 lines) ✨ Refactored
- **Creative Library**: `context-components.md` → CreativeLibrary.jsx (525 lines) ✨ Refactored
- **MediaLibraryBase**: `context-components.md` → MediaLibraryBase.jsx (674 lines) 🆕
- **AI Integration**: `context-components.md` → AIAssistant.jsx (1,400+ lines)
- **useMatrix Hook**: `context-components.md` → useMatrix.js (355 lines)
- **State Dialog**: `context-components.md` → StateManagementDialog.jsx

### Workflows
- **Message Creation**: `context-workflows.md` → Message Creation Workflow
- **Data Sync**: `context-workflows.md` → Data Sync Workflow
- **Asset Upload**: `context-workflows.md` → Asset Upload Workflow
- **Asset Sync (Google Drive)**: `context-workflows.md` → Google Drive Sync 🆕
- **Creative Sync (Google Drive)**: `context-workflows.md` → Google Drive Sync 🆕
- **AI Content**: `context-workflows.md` → AI Content Generation Workflow
- **Template Management**: `context-workflows.md` → Template Management Workflow
- **Share Gallery**: `context-workflows.md` → Share Gallery Workflow
- **Virtual Scrolling**: `context-workflows.md` → Performance Patterns 🆕

### API & Backend
- **API Overview**: `context-api.md`
- **Google Sheets**: `context-api.md` → Google Sheets Integration
- **Google Drive**: `context-api.md` → Google Drive Integration 🆕
- **Authentication**: `context-api.md` → Authentication
- **Configuration**: `context-api.md` → Configuration Management
- **Assets**: `context-api.md` → Asset Management
- **Drive Proxy**: `context-api.md` → /api/drive/proxy/:fileIdOrName 🆕
- **Shares**: `context-api.md` → Share Gallery
- **Templates**: `context-api.md` → Templates

### Patterns & Utils
- **Pattern Evaluation**: `context-workflows.md` → Pattern 2: Pattern Evaluation
- **Message Lookup**: `context-workflows.md` → Pattern 1: Message Lookup
- **Google Sheets Ops**: `context-workflows.md` → Pattern 3: Google Sheets Operations
- **Asset Registry**: `context-workflows.md` → Pattern 4: Asset Registry Management
- **State Management**: `context-workflows.md` → Pattern 5: State Management
- **Virtual Scrolling**: `context-workflows.md` → Pattern 6: Virtual Scrolling 🆕
- **Masonry Layout**: `context-workflows.md` → Pattern 7: Masonry Layout 🆕

### Debugging
- **Sync Issues**: `skills/debug-sync.md`
- **Pattern Issues**: `skills/analyze-pattern.md`
- **Asset Upload**: `skills/test-asset-upload.md`
- **Performance**: `skills/optimize-performance.md`
- **General Debugging**: `context-workflows.md` → Debugging Tips

---

## By File Location

### React Components (`src/components/`)

| Component | Lines | Status | Notes |
|-----------|-------|--------|-------|
| Matrix.jsx | 1,530 | ✓ | Main matrix grid |
| MessageEditorDialog.jsx | 1,320 | ✓ | Message editor |
| PreviewView.jsx | 1,440 | ✓ | Share gallery viewer |
| TreeView.jsx | 902 | ✓ | Decision tree |
| AIAssistant.jsx | 1,400+ | ✓ | AI integration with Chat/Context tabs |
| **MediaLibraryBase.jsx** | **674** | **🆕** | **Shared base for Assets/Creatives** |
| CreativeLibrary.jsx | 525 | ✨ | Reduced from 931 |
| Assets.jsx | 377 | ✨ | Reduced from 1,103 |
| Templates.jsx | 1,107 | ✓ | Template management |
| StateManagementDialog.jsx | 260 | ✓ | Application state viewer |
| CreativePreview.jsx | ~500 | ✓ | Creative preview dialog |
| CreativeLibraryMasonryView.jsx | ~400 | ✓ | Masonry layout renderer |
| CreativeLibraryItem.jsx | 295 | ✓ | Individual creative item |
| Login.jsx | ~200 | ✓ | Authentication |
| Tasks.jsx | ~300 | ✓ | Task management |
| Monitoring.jsx | ~200 | ✓ | Analytics |
| Users.jsx | ~300 | ✓ | User management |
| Settings.jsx | ~400 | ✓ | App settings |

Legend: ✓ Stable | ✨ Refactored | 🆕 New

### Hooks (`src/hooks/`)
- **useMatrix.js** (355 lines) → `context-components.md` → useMatrix.js
  - Now exposes: audiences, topics, messages, assets, creatives, feed, keywords

### Utils (`src/utils/`)
- **patternEvaluator.js** (240 lines) → `context-workflows.md` → Pattern Evaluation
- **treeBuilder.js** → `context-components.md` → TreeView.jsx
- **assetUtils.js** → `context-workflows.md` → Asset Upload
- **templatePopulator.js** → `context-workflows.md` → Template Management

### Services (`src/services/`)
- **sheets.js** (520 lines) → `context-architecture.md` → Data Storage Strategy
- **settings.js** → `context-architecture.md` → Configuration System
- **previewService.js** → `context-workflows.md` → Share Gallery Workflow

### Backend
- **server.js** (1,400+ lines) → `context-api.md`
  - Added Google Drive integration endpoints
  - Added proxy endpoint for file serving
  - Enhanced asset and creative handling

### Configuration
- **config.json** → `context-architecture.md` → Configuration System
- **.env** → `context-quickstart.md` → Environment Variables
- **ecosystem.config.cjs** → `context-architecture.md` → PM2 Process Management

---

## Common Questions

### "How do I create a new message?"
→ `context-workflows.md` → Message Creation Workflow
→ `context-quickstart.md` → Common Tasks → Create Message

### "How does PMMID generation work?"
→ `context-workflows.md` → Pattern 2: Pattern Evaluation
→ `skills/analyze-pattern.md`

### "Where is the data stored?"
→ `context-architecture.md` → Data Model → Data Storage Strategy
→ Google Sheets (source of truth) + localStorage (cache)

### "How do I debug sync issues?"
→ `skills/debug-sync.md`
→ `context-workflows.md` → Debugging Tips

### "How do I upload an asset?"
→ `context-workflows.md` → Asset Upload Workflow
→ `skills/test-asset-upload.md`

### "How do I sync assets from Google Drive?" 🆕
→ `docs/GOOGLE_DRIVE_SETUP.md`
→ `context-workflows.md` → Google Drive Sync

### "How does the proxy work?" 🆕
→ `context-api.md` → /api/drive/proxy/:fileIdOrName
→ server.js:1400+

### "How do I create a share gallery?"
→ `context-workflows.md` → Share Gallery Workflow
→ `skills/create-share.md`

### "What API endpoints are available?"
→ `context-api.md`

### "How do I add AI content generation?"
→ `context-workflows.md` → AI Content Generation Workflow
→ `context-components.md` → AIAssistant.jsx

### "How is authentication handled?"
→ `context-architecture.md` → Authentication Systems
→ `context-api.md` → Authentication

### "How do I optimize performance?"
→ `skills/optimize-performance.md`
→ `context-architecture.md` → Performance Optimizations

### "How does virtual scrolling work?" 🆕
→ `context-components.md` → MediaLibraryBase.jsx
→ `context-workflows.md` → Virtual Scrolling Pattern

### "How does the masonry layout work?" 🆕
→ `context-components.md` → MediaLibraryMasonryView.jsx
→ Sequential loading for accurate height calculation

---

## File Reference Format

When referencing code in context files, use this format:
- Component: `ComponentName.jsx:lineNumber`
- Function: `fileName.js:lineNumber - functionName()`
- Pattern: `context-workflows.md` → Pattern Name
- API: `context-api.md` → Endpoint Name

Example: "Check `Matrix.jsx:1530` for the main grid rendering logic"

---

## v2.0.0 Major Changes Summary

### Code Refactoring
1. **MediaLibraryBase.jsx** (NEW - 674 lines)
   - Shared component for Assets and CreativeLibrary
   - Provides virtual scrolling, masonry layout, list view
   - Render props pattern for customization
   - Eliminated ~1000 lines of duplicate code

2. **Assets.jsx** (377 lines, reduced from 1,103)
   - Now uses MediaLibraryBase
   - Focused on asset-specific logic only

3. **CreativeLibrary.jsx** (525 lines, reduced from 931)
   - Now uses MediaLibraryBase
   - Focused on creative-specific logic only

### New Features
1. **Google Drive Integration**
   - Auto-sync assets and creatives from Drive folders
   - Spreadsheet-first sync strategy
   - File metadata extraction
   - Backend proxy for secure serving

2. **Virtual Scrolling & Masonry**
   - High-performance rendering for large libraries
   - Pinterest-style responsive grid
   - Dynamic height calculation
   - Sequential image loading

3. **Preview Enhancements**
   - Dark-themed preview dialog
   - Left-side metadata panel
   - Width-based transitions
   - External link buttons

4. **Template System**
   - HTML5 banner support
   - path-messagingmatrix configuration
   - CSS injection
   - Live preview

5. **State Management**
   - Creatives tab in StateManagementDialog
   - JSON view of all application state

### Updated API Endpoints
- `/api/drive/proxy/:fileIdOrName` - Proxy files from Google Drive
- `/api/drive/assets` - List assets from Drive folder
- `/api/drive/creatives` - List creatives from Drive folder
- `/api/assets/sync` - Sync assets with Drive
- `/api/creatives/sync` - Sync creatives with Drive

---

## Updating This Index

When adding new context files or sections:
1. Add entry to appropriate table
2. Update "By Topic" section if new topic
3. Update "Common Questions" if addressing FAQ
4. Update "v2.0.0 Major Changes" when significant changes occur
5. Keep format consistent
6. Use relative links where possible
7. Mark new features with 🆕 and refactored code with ✨

---

## Context File Dependencies

```
context-quickstart.md
  ├─ Quick reference for common tasks
  ├─ Links to detailed sections in other files
  └─ Updated with v2.0.0 features

context-architecture.md
  ├─ System-level overview
  ├─ Data model (updated with Assets/Creatives)
  ├─ Configuration (updated with Drive settings)
  └─ Performance optimizations (virtual scrolling)

context-workflows.md
  ├─ Uses architecture concepts
  ├─ References components (updated line counts)
  ├─ Uses API endpoints (new Drive endpoints)
  └─ NEW: Virtual scrolling and masonry patterns

context-components.md
  ├─ Uses architecture concepts
  ├─ Uses workflows
  ├─ References utils
  ├─ NEW: MediaLibraryBase documentation
  └─ UPDATED: Assets and CreativeLibrary

context-api.md
  ├─ Uses architecture concepts
  ├─ Complements workflows
  └─ NEW: Google Drive API endpoints

skills/*
  ├─ Specific task guides
  ├─ Reference all context files
  └─ Actionable step-by-step instructions
```

---

## Maintenance Checklist

When updating the codebase, check if these need updates:

- [x] Component line counts changed significantly?
     → Updated `context-components.md` and this index
     → Assets: 1,103 → 377 lines
     → CreativeLibrary: 931 → 525 lines
     → NEW: MediaLibraryBase: 674 lines

- [x] New API endpoints added?
     → Updated `context-api.md`
     → Added `/api/drive/*` endpoints

- [x] New workflow introduced?
     → Updated `context-workflows.md`
     → Added Google Drive sync workflow
     → Added virtual scrolling pattern

- [x] Architecture changed?
     → Updated `context-architecture.md`
     → Added Google Drive integration
     → Added virtual scrolling strategy

- [x] New common pattern emerged?
     → Added to `context-workflows.md`
     → MediaLibraryBase render props pattern
     → Virtual scrolling with sequential loading

- [x] Configuration structure changed?
     → Updated `context-architecture.md`
     → Added assetsFolderId and creativesFolderId

- [x] Performance optimizations added?
     → Updated `context-architecture.md` → Performance Optimizations
     → Updated `skills/optimize-performance.md`
     → Virtual scrolling for 1000+ items
     → Masonry layout with lazy loading

---

**Last Updated**: 2025-10-26
**Version**: 2.0.0
**Maintainer**: Development Team
