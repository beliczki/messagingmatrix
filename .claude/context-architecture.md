# Messaging Matrix - Architecture Context

## Project Overview
**Messaging Matrix** is a web-based marketing campaign management platform for organizing and managing messages across audiences and topics. The system provides visual matrix and tree-based interfaces with integrated Google Sheets sync, AI-powered content generation via Claude API, and comprehensive asset management.

**Technology Stack**: React 18.3 + Vite 5.4 (frontend), Node.js/Express (backend), Google Sheets API, Claude API

## Core System Architecture

### Frontend (React + Vite)
- **Port**: 5173 (dev), production serves via Express
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Build Tool**: Vite with HMR and API proxy to backend
- **State Management**: React hooks + Context API (AuthContext)
- **Styling**: TailwindCSS + component-level CSS

### Backend (Express.js)
- **Port**: 3003
- **File**: `server.js` (~1,400 lines)
- **Authentication**: Google Service Account (Sheets) + Local SHA-256 user auth
- **Storage**: Google Sheets (primary) + localStorage (cache)
- **File Handling**: Multer for uploads, image-size for metadata

## Key Directory Structure

```
messagingmatrix/
├── src/
│   ├── components/        # 39 React components (~17.7KB total)
│   │   ├── Matrix.jsx           # (1,530 lines) - Main grid interface
│   │   ├── TreeView.jsx         # (902 lines) - Decision tree visualization
│   │   ├── PreviewView.jsx      # (1,440 lines) - Preview/share gallery
│   │   ├── MessageEditorDialog.jsx # (1,320 lines) - Message editor
│   │   ├── CreativeLibrary.jsx  # (930 lines) - Asset library
│   │   ├── Assets.jsx           # (1,054 lines) - Asset management
│   │   ├── Templates.jsx        # (1,107 lines) - Template management
│   │   ├── ClaudeChat.jsx       # (767 lines) - AI integration
│   │   ├── Tasks.jsx            # (605 lines) - Task management
│   │   └── Settings.jsx         # (797 lines) - Configuration UI
│   ├── hooks/
│   │   └── useMatrix.js         # (355 lines) - Core data hook
│   ├── services/
│   │   ├── sheets.js            # (520 lines) - Google Sheets integration
│   │   ├── previewService.js    # Preview/share service
│   │   └── settings.js          # Config management
│   ├── utils/
│   │   ├── patternEvaluator.js  # (240 lines) - Template evaluation
│   │   ├── treeBuilder.js       # Tree structure generation
│   │   ├── treeLayout.js        # Tree layout calculations
│   │   ├── assetUtils.js        # Asset processing
│   │   └── templatePopulator.js # Template variable replacement
│   ├── templates/html/          # Email templates with size variants
│   ├── assets/                  # User-uploaded assets
│   └── App.jsx                  # Root component & routing
├── server.js                    # Express backend (1,400+ lines)
├── config.json                  # App configuration
├── assets.json                  # Asset registry
├── ecosystem.config.cjs         # PM2 process management
└── public/share/                # Share preview gallery
```

## Data Model

### Core Entities

**Audiences** (Customer Segments):
```javascript
{
  id: string,
  name: string,
  key: string,           // Unique identifier
  order: number,
  status: string,
  product: string,
  strategy: string,
  buying_platform: string,
  targeting_type: string
}
```

**Topics** (Campaign Messages):
```javascript
{
  id: string,
  name: string,
  key: string,           // Auto-generated from pattern
  order: number,
  status: string,
  tags: string[]
}
```

**Messages** (Content Items):
```javascript
{
  id: string,            // Unique identifier
  name: string,          // Display name
  number: number,        // Message number (auto-incremented)
  variant: 'a'|'b'|'c'|...,
  audience: string,      // Audience key
  topic: string,         // Topic key
  version: number,       // Auto-incremented on save
  status: 'ACTIVE'|'INACTIVE'|'PLANNED'|'IN PROGRESS',

  // Content fields
  headline: string,
  copy1: string,
  copy2: string,
  flash: string,
  cta: string,
  landingUrl: string,
  template: string,
  image1: string,        // URLs
  image2: string,
  image3: string,
  image4: string,
  image5: string,
  image6: string,

  // Auto-generated fields
  pmmid: string,         // Generated from pattern
  utm_campaign: string,
  utm_source: string,
  utm_medium: string,
  utm_content: string,
  utm_term: string,
  utm_cd26: string
}
```

### Data Storage Strategy

**Dual Persistence**:
1. **Google Sheets** (source of truth):
   - `Audiences` sheet
   - `Topics` sheet
   - `Messages` sheet
   - Service account authentication
   - Batch clear + write operations

2. **localStorage** (cache):
   - Faster read/write
   - Offline capability
   - Synced on load/save

**Message Lookup Index**:
- Hash map: `"topic-audience"` → message
- O(1) lookup performance
- Maintained by `useMatrix` hook

## Critical API Endpoints

### Google Sheets
- `GET /api/sheets/:spreadsheetId/values/:range` - Read sheet
- `PUT /api/sheets/:spreadsheetId/values/:range` - Write sheet
- `POST /api/sheets/:spreadsheetId/values/:range/clear` - Clear sheet

### Configuration
- `GET /api/config` - Load config.json
- `POST /api/config` - Save config.json

### AI Integration
- `POST /api/claude` - Claude API proxy

### Share Gallery
- `GET /api/shares/:shareId` - Get share info
- `POST /api/shares` - Create share
- `POST /api/shares/:shareId/comments` - Add comment

### Assets
- `POST /api/assets/preview-metadata` - Extract metadata
- `POST /api/assets/confirm-upload` - Finalize upload
- `GET /api/assets/registry` - Get assets.json
- `POST /api/assets/registry` - Update registry

### Templates
- `GET /api/templates` - List templates
- `GET /api/templates/:templateName/:fileName` - Get template file
- `POST /api/templates/:templateName/:fileName` - Save template file

## Authentication Systems

### Google Sheets (Service Account)
1. Load RSA private key from service account JSON
2. Generate JWT with Google OAuth2 claims
3. Exchange JWT for access token
4. Cache token for 1 hour
5. Auto-refresh on expiration

**Location**: `server.js` - `getGoogleAccessToken()` function

### User Authentication (Local)
1. SHA-256 password hashing (Web Crypto API)
2. localStorage session management
3. AuthContext provider wraps App

**Default Users** (in config.json):
- `beliczki.robert@gmail.com` / `temporary123` (admin)
- `demo@messagingmatrix.ai` / `vegtelenlove` (demo)

## Configuration System

**config.json Structure**:
```json
{
  "spreadsheetId": "Google Sheets ID",
  "imageBaseUrls": {
    "image1": "https://cdn.example.com/",
    "image2": "https://cdn.example.com/",
    "image3-6": "..."
  },
  "patterns": {
    "pmmid": "p_{{audiences[Audience_Key].Buying_platform}}-s_{{audiences[Audience_Key].Strategy}}-a_{{Audience_Key}}-m_{{Number}}-t_{{Topic_Key}}-v_{{Variant}}-n_{{Version}}",
    "topicKey": "{{Field1}}_{{Field2}}",
    "trafficking": {
      "utm_campaign": "pattern",
      "utm_source": "pattern",
      "utm_medium": "pattern",
      "utm_content": "pattern",
      "utm_term": "pattern",
      "utm_cd26": "pattern"
    },
    "feed": { /* Adform patterns */ }
  },
  "treeStructure": "Product > Strategy > Targeting Type > Audience > Topic > Messages",
  "feedStructure": "field,field,field",
  "lookAndFeel": {
    "baseColor": "#4A90E2",
    "statusColors": {
      "ACTIVE": "#10B981",
      "INACTIVE": "#6B7280",
      "PLANNED": "#F59E0B",
      "IN PROGRESS": "#F97316"
    }
  }
}
```

## Performance Optimizations

1. **O(1) Message Lookup**: Hash map by `"topic-audience"` key
2. **Virtual Scrolling**: CreativeLibrary chunks large lists
3. **Lazy Loading**: Templates loaded on demand
4. **Token Caching**: Google OAuth2 tokens cached 1 hour
5. **Debounced State**: 300ms debounce for view state saves
6. **React Memoization**: useCallback/useMemo for stable references

## Development Commands

```bash
npm run dev          # Vite dev server (port 5173)
npm run server       # Express backend (port 3003)
npm run dev:all      # Both servers concurrently
npm run build        # Production build → dist/
npm run preview      # Preview production build
npm run lint         # ESLint check
```

## PM2 Process Management

**ecosystem.config.cjs** defines:
- `messagingmatrix-server` - Backend (fork mode, auto-restart, 1GB limit)
- `messagingmatrix-frontend` - Frontend (Vite dev server)
- Auto-restart on crash with exponential backoff
- Logs to `logs/` directory
- Graceful shutdown (5s timeout)

**Commands**:
```bash
pm2 start ecosystem.config.cjs
pm2 restart all
pm2 logs
pm2 status
```

## Environment Variables

```env
PORT=3003
NODE_ENV=production
VITE_ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_SERVICE_ACCOUNT_PATH=./service-account.json
VITE_API_URL=https://messagingmatrix.ai
```

## Recent Development Focus

Based on last 20 commits:
1. HTML ad rendering & iframe scaling
2. Share gallery improvements
3. ZIP download for static HTML ads
4. Template overlay system for references
5. CreativeLibrary scaling methods
