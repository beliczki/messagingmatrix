# Messaging Matrix - Quick Start Guide

## What is Messaging Matrix?

A web-based marketing campaign management platform for organizing messages across audiences (customer segments) and topics (campaign themes). Features include:
- Visual matrix and tree-based interfaces
- Google Sheets sync with dual persistence
- AI-powered content generation (Claude API)
- Comprehensive asset management
- HTML email template system
- Share galleries with URL generation

---

## Tech Stack

**Frontend**: React 18.3 + Vite 5.4 + TailwindCSS
**Backend**: Node.js/Express (port 3003)
**APIs**: Google Sheets API, Claude API
**Deployment**: PM2 process management

---

## Project Structure (Key Files)

```
messagingmatrix/
├── src/
│   ├── components/
│   │   ├── Matrix.jsx (1,530 lines)         # Main grid interface
│   │   ├── MessageEditorDialog.jsx (1,320)  # Message editor
│   │   ├── TreeView.jsx (902)               # Decision tree
│   │   ├── PreviewView.jsx (1,440)          # Share gallery
│   │   ├── CreativeLibrary.jsx (930)        # Asset library
│   │   ├── Assets.jsx (1,054)               # Asset management
│   │   ├── ClaudeChat.jsx (767)             # AI integration
│   │   └── Templates.jsx (1,107)            # Template editor
│   ├── hooks/
│   │   └── useMatrix.js (355)               # Core data management
│   ├── utils/
│   │   ├── patternEvaluator.js (240)        # PMMID/UTM generation
│   │   ├── treeBuilder.js                   # Tree structure
│   │   ├── assetUtils.js                    # Asset processing
│   │   └── templatePopulator.js             # Template variables
│   ├── services/
│   │   ├── sheets.js (520)                  # Google Sheets API
│   │   └── previewService.js                # Share service
│   └── templates/html/                      # Email templates
├── server.js (1,400+ lines)                 # Express backend
├── config.json                              # App configuration
├── assets.json                              # Asset registry
└── .env                                     # Environment variables
```

---

## Core Data Model

### Message Structure
```javascript
{
  id: string,              // UUID
  name: string,            // Display name
  number: number,          // Auto-incremented
  variant: 'a'|'b'|'c',
  audience: string,        // Audience key
  topic: string,           // Topic key
  version: number,         // Auto-incremented on save
  status: 'ACTIVE'|'INACTIVE'|'PLANNED'|'IN PROGRESS',

  // Content
  headline: string,
  copy1: string,
  copy2: string,
  flash: string,
  cta: string,
  landingUrl: string,
  template: string,
  image1-6: string,        // URLs

  // Auto-generated
  pmmid: string,           // Pattern-based ID
  utm_campaign: string,
  utm_source: string,
  utm_medium: string,
  utm_content: string,
  utm_term: string
}
```

### Storage Strategy
1. **Google Sheets** (source of truth): 3 sheets (Audiences, Topics, Messages)
2. **localStorage** (cache): Fast reads, offline capability
3. **Message Index**: Hash map `"topic-audience"` → message for O(1) lookup

---

## Development Setup

### Start Servers
```bash
npm run dev          # Frontend only (port 5173)
npm run server       # Backend only (port 3003)
npm run dev:all      # Both servers concurrently
```

### Using PM2
```bash
pm2 start ecosystem.config.cjs
pm2 logs
pm2 status
pm2 restart all
```

### Environment Variables (.env)
```
PORT=3003
NODE_ENV=development
VITE_ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
VITE_API_URL=http://localhost:3003
```

---

## Common Tasks

### 1. Load Data from Google Sheets
**File**: `src/hooks/useMatrix.js:355`
```javascript
const { load, audiences, topics, messages } = useMatrix();
await load(); // Fetches from sheets, caches in localStorage
```

### 2. Generate PMMID
**File**: `src/utils/patternEvaluator.js:240`
```javascript
import { generatePMMID } from '../utils/patternEvaluator';

const pmmid = generatePMMID(message, audiences, config.patterns.pmmid);
// Returns: p_facebook-s_awareness-a_young_prof-m_1-t_launch-v_a-n_2
```

### 3. Create Message
**File**: `src/components/Matrix.jsx:1530`
```javascript
const { addMessage } = useMatrix();

addMessage({
  id: uuidv4(),
  number: 1,
  variant: 'a',
  version: 1,
  audience: 'young_professionals',
  topic: 'product_launch',
  status: 'PLANNED',
  headline: 'New Product Launch',
  // ... other fields
});
```

### 4. Upload Asset
**Files**: `src/components/Assets.jsx:1054`, `server.js`
```javascript
// 1. Upload file
POST /api/assets/preview-metadata (multipart/form-data)

// 2. Confirm with metadata
POST /api/assets/confirm-upload
{
  "tempPath": "/temp/upload-123.jpg",
  "metadata": {
    "brand": "ERSTE",
    "product": "VAL",
    "type": "background",
    // ... 10 fields total
  },
  "directory": "assets"
}

// Result: ERSTE_VAL_background_x_1_656x459_backgroundImage1_psd_v1.jpg
```

### 5. Create Share Gallery
**File**: `src/services/previewService.js`
```javascript
POST /api/shares
{
  "messages": [{ /* message objects */ }],
  "sizes": ["300x250", "640x360"],
  "config": { /* config.json */ }
}

// Returns: { shareId, shareUrl }
```

---

## Key API Endpoints

```
# Google Sheets
GET    /api/sheets/:spreadsheetId/values/:range
PUT    /api/sheets/:spreadsheetId/values/:range
POST   /api/sheets/:spreadsheetId/values/:range/clear

# Configuration
GET    /api/config
POST   /api/config

# AI
POST   /api/claude

# Assets
POST   /api/assets/preview-metadata
POST   /api/assets/confirm-upload
GET    /api/assets/registry

# Shares
POST   /api/shares
GET    /api/shares/:shareId

# Templates
GET    /api/templates
GET    /api/templates/:templateName/:fileName
POST   /api/templates/:templateName/:fileName
```

---

## Debugging Tips

### Check Sync Status
```javascript
// Browser console
const lastSync = localStorage.getItem('lastSync');
console.log('Last sync:', new Date(lastSync));
```

### Verify Message Index
```javascript
const messageIndex = JSON.parse(localStorage.getItem('messageIndex'));
console.log('Messages indexed:', Object.keys(messageIndex).length);
```

### Check PM2 Logs
```bash
pm2 logs --lines 100
pm2 logs messagingmatrix-server --lines 50
```

### Verify Google Sheets Auth
```bash
# Check service account file exists
ls -la service-account.json

# Test API endpoint
curl http://localhost:3003/api/config
```

---

## Common Patterns

### 1. Message Lookup (O(1))
```javascript
const { messageIndex } = useMatrix();
const message = messageIndex[`${topic}-${audience}`];
```

### 2. Pattern Evaluation
```javascript
import { evaluatePattern } from '../utils/patternEvaluator';

const result = evaluatePattern(pattern, {
  audiences: audiences,
  Audience_Key: 'young_prof',
  Number: 1,
  Variant: 'a'
});
```

### 3. Asset Registry Management
```javascript
import { fetchAssetsRegistry, updateAssetInRegistry } from '../utils/assetsJsonManager';

const registry = await fetchAssetsRegistry();
await updateAssetInRegistry(assetData);
```

---

## Important Files to Know

**Configuration**:
- `config.json` - App settings, patterns, tree structure
- `.env` - Environment variables
- `ecosystem.config.cjs` - PM2 configuration

**Documentation**:
- `SPECIFICATION.md` - Detailed specs
- `FEATURES.md` - Feature documentation
- `ASSET_NAMING_SYSTEM.md` - Asset conventions
- `DEPLOYMENT_MESSAGINGMATRIX_AI.md` - Production deployment

**Context Files** (you're reading one!):
- `.claude/context-architecture.md` - System architecture
- `.claude/context-workflows.md` - Common workflows
- `.claude/context-components.md` - Component reference
- `.claude/context-api.md` - API documentation
- `.claude/context-quickstart.md` - This file

---

## When You Need Help

1. **Pattern Issues**: Check `src/utils/patternEvaluator.js:240`
2. **Data Sync Issues**: Check `src/hooks/useMatrix.js:355` and `src/services/sheets.js:520`
3. **Asset Problems**: Check `ASSET_NAMING_SYSTEM.md` and `src/utils/assetUtils.js`
4. **Template Issues**: Check `src/templates/html/` and `src/utils/templatePopulator.js`
5. **API Errors**: Check `server.js` and browser network tab

---

## Recent Development Focus

Based on git history:
- HTML ad rendering and iframe scaling
- Share gallery improvements
- ZIP download for static HTML ads
- Template overlay system for references
- CreativeLibrary scaling methods

---

## Performance Notes

**Optimizations in place**:
- O(1) message lookup via hash map
- Virtual scrolling in CreativeLibrary
- Google OAuth2 token caching (1 hour)
- localStorage caching for offline access
- React memo/callback for stable references

**Known Limitations**:
- localStorage limit: ~5MB
- Large datasets (>1000 messages) may slow matrix rendering
- Asset upload limited by server memory (recommend <50MB files)

---

## Quick Reference Commands

```bash
# Development
npm run dev:all              # Start both servers
pm2 start ecosystem.config.cjs  # Start with PM2

# Debugging
pm2 logs                     # View all logs
pm2 status                   # Check status
curl http://localhost:3003/api/config  # Test backend

# Build
npm run build                # Production build
npm run preview              # Preview build
npm run lint                 # Check code quality
```
