# Messaging Matrix - Common Workflows & Patterns

## Core User Workflows

### 1. Message Creation Workflow

**Location**: `Matrix.jsx` → `MessageEditorDialog.jsx`

**Steps**:
1. User clicks "+" button in matrix cell (topic-audience intersection)
2. System auto-generates:
   - Message ID (UUID)
   - Message number (auto-incremented based on existing messages)
   - Initial variant ('a')
   - Version (1)
3. `MessageEditorDialog` opens with blank form
4. User fills content fields:
   - Naming tab: name, status, template
   - Content tab: headline, copy1, copy2, flash, cta, landingUrl, images
5. **Optional**: User clicks Claude icon to generate AI content
6. User clicks "Save"
7. System auto-generates:
   - PMMID using pattern from config.json
   - Trafficking fields (UTM parameters)
   - Topic key if needed
8. Message saved to state (useMatrix hook)
9. User clicks "Save" in Matrix view to persist to Google Sheets

**Key Files**:
- `src/components/Matrix.jsx:1530`
- `src/components/MessageEditorDialog.jsx:1320`
- `src/utils/patternEvaluator.js:240`

### 2. Data Sync Workflow

**Location**: `Matrix.jsx` + `useMatrix.js` + `sheets.js`

**Load Process**:
1. User clicks "Load" button in Matrix view
2. `useMatrix.load()` called
3. Backend authenticates with Google (service account)
4. Fetches all sheets: Audiences, Topics, Messages
5. Data cached in localStorage
6. State updated in React
7. Message lookup index rebuilt
8. lastSync timestamp updated

**Save Process**:
1. User makes changes (add/edit/delete messages)
2. User clicks "Save" button
3. For each new/modified message:
   - Generate PMMID via `patternEvaluator.js`
   - Generate trafficking fields
4. Backend clears Google Sheets
5. Backend writes all data in batch
6. Updates localStorage cache
7. Updates lastSync timestamp

**Key Files**:
- `src/hooks/useMatrix.js:355` - Load/save logic
- `src/services/sheets.js:520` - Google Sheets API
- `server.js` - `/api/sheets/*` endpoints

### 3. Asset Upload Workflow

**Location**: `Assets.jsx` + `CreativeLibrary.jsx`

**Steps**:
1. User clicks "Upload Assets" button
2. Selects files (images or videos)
3. Backend extracts metadata:
   - Image dimensions (via `image-size` library)
   - File type, size
   - Attempts to parse filename for metadata
4. `UploadAssetDialog` shows preview with metadata fields:
   - Brand, Product, Type, Visual Keyword, Visual Description
   - Dimensions (auto-filled), Placeholder Name, Cropping Template
   - Version, Platform, Tags
5. User confirms or edits metadata
6. Backend renames file using pattern:
   ```
   Brand_Product_Type_VisualKeyword_VisualDescription_Dimensions_Placeholder_Crop_Version.ext
   ```
7. File moved from temp to `/src/assets/` or `/src/creatives/`
8. Entry added to `assets.json` registry with full metadata
9. Asset appears in CreativeLibrary view

**Asset Naming Pattern**:
```
ERSTE_VAL_background_x_1_656x459_backgroundImage1_psd_v1.jpg
│     │   │          │ │ │       │                │    │
│     │   │          │ │ └───────┼────────────────┼────┴─ Dimensions
│     │   │          │ └─────────┼────────────────┴────── Visual description
│     │   │          └───────────┴───────────────────────Visual keyword
│     │   └──────────────────────────────────────────────Type
│     └──────────────────────────────────────────────────Product
└────────────────────────────────────────────────────────Brand
```

**Key Files**:
- `src/components/Assets.jsx:1054`
- `src/components/CreativeLibrary.jsx:930`
- `src/utils/assetUtils.js`
- `src/utils/assetsJsonManager.js`
- `server.js` - `/api/assets/*` endpoints
- `ASSET_NAMING_SYSTEM.md`

### 4. AI Content Generation Workflow

**Location**: `ClaudeChat.jsx` + `MessageEditorDialog.jsx`

**Steps**:
1. User opens message in `MessageEditorDialog`
2. Clicks Claude icon or opens chat panel
3. `ClaudeChat` component expands
4. User types prompt OR system auto-generates context:
   ```
   Generate content for:
   Audience: {{audience.name}}
   Topic: {{topic.name}}
   Product: {{product}}
   Strategy: {{strategy}}
   ```
5. User submits prompt
6. Frontend calls `/api/claude` (proxy endpoint)
7. Backend calls Anthropic API with Claude SDK
8. Response streamed back to chat
9. User can click suggestions to populate message fields
10. If message has number/variant, system offers to sync to other messages

**API Flow**:
```
ClaudeChat → POST /api/claude → Anthropic API
                               ↓
                    Stream response chunks
                               ↓
                    Display in chat UI
```

**Key Files**:
- `src/components/ClaudeChat.jsx:767`
- `src/components/MessageEditorDialog.jsx:1320` - Integration
- `server.js` - `/api/claude` endpoint
- `src/api/claude-proxy.js`

### 5. Template Management Workflow

**Location**: `Templates.jsx`

**HTML Email Template Structure**:
```
src/templates/html/
├── index.html              # Main template with {{placeholders}}
├── template.json           # Config & field mappings
├── main.css                # Base styles
├── 300x250.css             # Size-specific styles
├── 300x600.css
├── 640x360.css
├── 970x250.css
└── 1080x1080.css
```

**Workflow**:
1. User selects template from Templates view
2. Can edit any file:
   - HTML structure in `index.html`
   - Field mappings in `template.json`
   - Styles in CSS files
3. Changes saved via `/api/templates/:templateName/:fileName`
4. Preview updates in real-time
5. Message editor uses templates for preview rendering

**Template Variables**:
```html
{{headline_text_1}}
{{copy_text_1}}
{{copy_text_2}}
{{flash_text}}
{{cta_text}}
{{landing_url}}
{{image_url_1}}
{{image_url_2}}
...
```

**Populated by**: `src/utils/templatePopulator.js`

### 6. Share Gallery Workflow

**Location**: `PreviewView.jsx`

**Steps**:
1. User selects messages in Matrix view
2. Clicks "Share" or "Preview" button
3. System generates share ID (unique)
4. Creates share directory: `/public/share/{shareId}/`
5. For each message:
   - Renders HTML template with message content
   - Copies all referenced assets
   - Generates manifest.json with metadata
6. Saves share metadata via `/api/shares`
7. User receives shareable URL: `https://domain.com/share/{shareId}`
8. Share page shows masonry gallery with:
   - Scaled previews (iframe for HTML, img for static)
   - Message names/details
   - Comment capability
   - ZIP download option

**Share Structure**:
```
public/share/{shareId}/
├── manifest.json           # Share metadata
├── message1_300x250.html
├── message1_640x360.html
├── message2_300x250.html
├── assets/
│   ├── image1.jpg
│   └── image2.png
└── comments.json          # User comments
```

**Key Files**:
- `src/components/PreviewView.jsx:1440`
- `src/services/previewService.js`
- `server.js` - `/api/shares/*` endpoints

## Common Coding Patterns

### Pattern 1: Message Lookup

**Always use the message index for fast lookup**:

```javascript
// ❌ DON'T: Linear search
const message = messages.find(m => m.topic === topic && m.audience === audience);

// ✅ DO: O(1) hash lookup
const { messageIndex } = useMatrix();
const message = messageIndex[`${topic}-${audience}`];
```

**Location**: `src/hooks/useMatrix.js:355`

### Pattern 2: Pattern Evaluation

**Use patternEvaluator for all auto-generated fields**:

```javascript
import { evaluatePattern, generatePMMID, generateTraffickingFields } from '../utils/patternEvaluator';

// Generate PMMID
const pmmid = generatePMMID(message, audiences, config.patterns.pmmid);

// Generate all trafficking fields
const traffickingFields = generateTraffickingFields(
  message,
  audiences,
  config.patterns.trafficking
);

// Evaluate single pattern
const topicKey = evaluatePattern(config.patterns.topicKey, {
  Field1: topic.field1,
  Field2: topic.field2,
  audiences: audiences
});
```

**Location**: `src/utils/patternEvaluator.js:240`

### Pattern 3: Google Sheets Operations

**Always use service account authentication**:

```javascript
// Load data
const response = await fetch(`/api/sheets/${spreadsheetId}/values/Messages!A1:Z1000`);
const data = await response.json();

// Write data
await fetch(`/api/sheets/${spreadsheetId}/values/Messages!A1:Z1000`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ values: rowsArray })
});

// Clear sheet
await fetch(`/api/sheets/${spreadsheetId}/values/Messages!A1:Z1000/clear`, {
  method: 'POST'
});
```

**Location**: `src/services/sheets.js:520`

### Pattern 4: Asset Registry Management

**Always update assets.json when adding/removing assets**:

```javascript
import { fetchAssetsRegistry, updateAssetInRegistry } from '../utils/assetsJsonManager';

// Fetch registry
const registry = await fetchAssetsRegistry();

// Add/update asset
await updateAssetInRegistry({
  id: 'unique-id',
  filename: 'Brand_Product_Type_Visual_Description_Dimensions_Placeholder_Crop_Version.ext',
  metadata: { /* 10 fields */ },
  tags: ['platform', 'category'],
  platforms: ['Facebook', 'Instagram'],
  status: 'active',
  directory: 'assets'
});

// Delete asset
await fetch('/api/assets/registry', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: assetId })
});
```

**Location**: `src/utils/assetsJsonManager.js`

### Pattern 5: State Management with useMatrix

**Central data management hook**:

```javascript
import useMatrix from '../hooks/useMatrix';

function Component() {
  const {
    audiences,      // Array of audience objects
    topics,         // Array of topic objects
    messages,       // Array of message objects
    messageIndex,   // Hash map: "topic-audience" → message
    keywords,       // Keywords object
    load,           // Function to load from Google Sheets
    save,           // Function to save to Google Sheets
    addMessage,     // Add new message
    updateMessage,  // Update existing message
    deleteMessage,  // Delete message
    moveMessage,    // Move message to different cell
    copyMessage,    // Copy message within topic
    getMessages,    // Get messages for topic-audience
    loading,        // Boolean loading state
    lastSync        // Timestamp of last sync
  } = useMatrix();

  // Use state and functions
}
```

**Location**: `src/hooks/useMatrix.js:355`

## Debugging Tips

### Check Google Sheets Sync Status
```javascript
// In browser console
const lastSync = localStorage.getItem('lastSync');
console.log('Last sync:', new Date(lastSync));
```

### Verify Message Index
```javascript
// In browser console
const messageIndex = JSON.parse(localStorage.getItem('messageIndex'));
console.log('Indexed messages:', Object.keys(messageIndex).length);
```

### Check Asset Registry
```bash
# In terminal
cat assets.json | jq '.assets | length'
```

### Verify Service Account Token
```javascript
// Check token expiration (server.js)
console.log('Token expires:', new Date(tokenCache.expiresAt));
```

### PM2 Process Status
```bash
pm2 status
pm2 logs messagingmatrix-server --lines 50
pm2 logs messagingmatrix-frontend --lines 50
```

## Testing Checklist

When making changes, test these workflows:
- [ ] Load data from Google Sheets
- [ ] Create new message with auto-generated PMMID
- [ ] Edit message and verify version increment
- [ ] Move message to different cell
- [ ] Copy message within topic
- [ ] Save data to Google Sheets
- [ ] Upload asset with metadata extraction
- [ ] Generate AI content via Claude
- [ ] Create share with multiple messages
- [ ] Download share as ZIP
- [ ] Template preview in multiple sizes

## Common Gotchas

1. **PMMID Generation**: Always regenerate when audience/topic changes
2. **Version Increment**: Only increment on explicit save, not on auto-save
3. **Message Index**: Rebuild after load/save operations
4. **Asset Paths**: Use base URLs from config.json, not hardcoded
5. **Template Variables**: Must match template.json field mappings
6. **Google Sheets Auth**: Token expires after 1 hour, auto-refreshes
7. **localStorage Limit**: ~5MB limit, monitor size for large datasets
8. **PM2 Restarts**: Graceful shutdown requires 5s, ensure no orphaned processes
