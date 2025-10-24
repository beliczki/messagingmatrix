# Messaging Matrix - API Reference

## Backend API Endpoints

**Base URL**: `http://localhost:3003` (dev), `https://messagingmatrix.ai` (production)
**Server File**: `server.js` (~1,400 lines)

---

## Google Sheets Integration

### GET /api/sheets/:spreadsheetId/values/:range
**Purpose**: Read data from Google Sheets

**Authentication**: Service Account (OAuth2)

**Request**:
```javascript
GET /api/sheets/1a2b3c4d5e/values/Messages!A1:Z1000
```

**Response**:
```json
{
  "range": "Messages!A1:Z1000",
  "majorDimension": "ROWS",
  "values": [
    ["id", "name", "number", "variant", "audience", "topic", ...],
    ["msg-001", "Campaign 1", "1", "a", "audience1", "topic1", ...],
    ...
  ]
}
```

**Error Handling**:
- 401: Authentication failed
- 404: Spreadsheet or range not found
- 500: Google API error

**Implementation**: Uses `getGoogleAccessToken()` for OAuth2

---

### PUT /api/sheets/:spreadsheetId/values/:range
**Purpose**: Write data to Google Sheets

**Request**:
```javascript
PUT /api/sheets/1a2b3c4d5e/values/Messages!A1:Z1000
Content-Type: application/json

{
  "values": [
    ["id", "name", "number", ...],
    ["msg-001", "Campaign 1", "1", ...],
    ...
  ]
}
```

**Response**:
```json
{
  "spreadsheetId": "1a2b3c4d5e",
  "updatedRange": "Messages!A1:Z1000",
  "updatedRows": 100,
  "updatedColumns": 26,
  "updatedCells": 2600
}
```

---

### POST /api/sheets/:spreadsheetId/values/:range/clear
**Purpose**: Clear sheet range

**Request**:
```javascript
POST /api/sheets/1a2b3c4d5e/values/Messages!A1:Z1000/clear
```

**Response**:
```json
{
  "spreadsheetId": "1a2b3c4d5e",
  "clearedRange": "Messages!A1:Z1000"
}
```

---

### GET /api/sheets/:spreadsheetId
**Purpose**: Get spreadsheet metadata

**Response**:
```json
{
  "spreadsheetId": "1a2b3c4d5e",
  "properties": {
    "title": "Messaging Matrix Data",
    "locale": "en_US"
  },
  "sheets": [
    { "properties": { "title": "Audiences", "sheetId": 0 } },
    { "properties": { "title": "Topics", "sheetId": 1 } },
    { "properties": { "title": "Messages", "sheetId": 2 } }
  ]
}
```

---

## Configuration Management

### GET /api/config
**Purpose**: Load application configuration

**Response**:
```json
{
  "spreadsheetId": "1a2b3c4d5e",
  "imageBaseUrls": {
    "image1": "https://cdn.example.com/",
    "image2": "https://cdn.example.com/",
    "image3": "https://cdn.example.com/",
    "image4": "https://cdn.example.com/",
    "image5": "https://cdn.example.com/",
    "image6": "https://cdn.example.com/"
  },
  "patterns": {
    "pmmid": "p_{{audiences[Audience_Key].Buying_platform}}-s_{{audiences[Audience_Key].Strategy}}-a_{{Audience_Key}}-m_{{Number}}-t_{{Topic_Key}}-v_{{Variant}}-n_{{Version}}",
    "topicKey": "{{Field1}}_{{Field2}}",
    "trafficking": {
      "utm_campaign": "{{pmmid}}",
      "utm_source": "{{audiences[Audience_Key].Buying_platform}}",
      "utm_medium": "{{audiences[Audience_Key].Strategy}}",
      "utm_content": "{{Audience_Key}}_{{Topic_Key}}",
      "utm_term": "{{Variant}}",
      "utm_cd26": "{{Number}}"
    },
    "feed": {
      "adform_id": "pattern",
      "adform_name": "pattern"
    }
  },
  "treeStructure": "Product > Strategy > Targeting Type > Audience > Topic > Messages",
  "feedStructure": "field1,field2,field3",
  "lookAndFeel": {
    "baseColor": "#4A90E2",
    "statusColors": {
      "ACTIVE": "#10B981",
      "INACTIVE": "#6B7280",
      "PLANNED": "#F59E0B",
      "IN PROGRESS": "#F97316"
    }
  },
  "users": [
    {
      "email": "user@example.com",
      "password": "sha256hash",
      "role": "admin"
    }
  ]
}
```

**File Location**: `config.json` in project root

---

### POST /api/config
**Purpose**: Save application configuration

**Request**:
```javascript
POST /api/config
Content-Type: application/json

{
  "spreadsheetId": "...",
  "imageBaseUrls": { ... },
  "patterns": { ... },
  ...
}
```

**Response**:
```json
{
  "success": true,
  "message": "Configuration saved successfully"
}
```

---

## AI Integration (Claude API)

### POST /api/claude
**Purpose**: Proxy requests to Claude API

**Request**:
```javascript
POST /api/claude
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "Generate a headline for..." }
  ],
  "context": {
    "audience": { "name": "Young Professionals", "strategy": "Awareness" },
    "topic": { "name": "Product Launch" },
    "message": { "headline": "...", "copy1": "..." }
  },
  "max_tokens": 1000
}
```

**Response** (Streaming):
```json
{
  "id": "msg_123",
  "content": [
    {
      "type": "text",
      "text": "Here's a headline suggestion: ..."
    }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "role": "assistant"
}
```

**Environment Variable**: `VITE_ANTHROPIC_API_KEY`

**Implementation**: Uses `@anthropic-ai/sdk`

---

## Share Gallery

### GET /api/shares/:shareId
**Purpose**: Get share metadata and manifest

**Request**:
```javascript
GET /api/shares/mgy3xn2ze0zcd04tvyd
```

**Response**:
```json
{
  "shareId": "mgy3xn2ze0zcd04tvyd",
  "createdAt": "2025-10-23T14:30:00Z",
  "messages": [
    {
      "id": "msg-001",
      "name": "Campaign 1",
      "sizes": ["300x250", "640x360"],
      "files": [
        "msg-001_300x250.html",
        "msg-001_640x360.html"
      ]
    }
  ],
  "assets": [
    "assets/image1.jpg",
    "assets/image2.png"
  ]
}
```

**File Location**: `public/share/{shareId}/manifest.json`

---

### POST /api/shares
**Purpose**: Create new share

**Request**:
```javascript
POST /api/shares
Content-Type: application/json

{
  "messages": [
    { "id": "msg-001", "name": "Campaign 1", ... }
  ],
  "sizes": ["300x250", "640x360", "970x250"],
  "config": { ... }
}
```

**Response**:
```json
{
  "success": true,
  "shareId": "mgy3xn2ze0zcd04tvyd",
  "shareUrl": "https://messagingmatrix.ai/share/mgy3xn2ze0zcd04tvyd"
}
```

**Process**:
1. Generate unique share ID
2. Create directory: `public/share/{shareId}/`
3. For each message and size:
   - Populate template with message data
   - Save as HTML file
4. Copy all referenced assets to `assets/` subdirectory
5. Generate `manifest.json`
6. Return share URL

---

### POST /api/shares/:shareId/comments
**Purpose**: Add comment to share

**Request**:
```javascript
POST /api/shares/mgy3xn2ze0zcd04tvyd/comments
Content-Type: application/json

{
  "author": "John Doe",
  "messageId": "msg-001",
  "comment": "Looks great!",
  "timestamp": "2025-10-23T15:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "commentId": "cmt-001"
}
```

**File Location**: `public/share/{shareId}/comments.json`

---

## Templates

### GET /api/templates
**Purpose**: List all templates

**Response**:
```json
{
  "templates": [
    {
      "name": "html",
      "files": [
        "index.html",
        "template.json",
        "main.css",
        "300x250.css",
        "300x600.css",
        "640x360.css",
        "970x250.css",
        "1080x1080.css"
      ]
    }
  ]
}
```

---

### GET /api/templates/:templateName/:fileName
**Purpose**: Get template file content

**Request**:
```javascript
GET /api/templates/html/index.html
```

**Response**:
```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="main.css">
  <link rel="stylesheet" href="{{size}}.css">
</head>
<body>
  <div class="container">
    <h1>{{headline_text_1}}</h1>
    <p>{{copy_text_1}}</p>
    <img src="{{image_url_1}}" alt="">
    <a href="{{landing_url}}">{{cta_text}}</a>
  </div>
</body>
</html>
```

---

### POST /api/templates/:templateName/:fileName
**Purpose**: Save template file

**Request**:
```javascript
POST /api/templates/html/index.html
Content-Type: application/json

{
  "content": "<!DOCTYPE html>..."
}
```

**Response**:
```json
{
  "success": true,
  "message": "Template file saved successfully"
}
```

---

## Email Integration

### GET /api/emails
**Purpose**: Fetch emails via IMAP

**Query Parameters**:
- `limit` (default: 50) - Number of emails to fetch
- `folder` (default: INBOX) - Email folder

**Request**:
```javascript
GET /api/emails?limit=20&folder=INBOX
```

**Response**:
```json
{
  "emails": [
    {
      "uid": 12345,
      "from": "sender@example.com",
      "subject": "Campaign feedback",
      "date": "2025-10-23T10:00:00Z",
      "body": "Email content...",
      "flags": ["\\Seen"]
    }
  ]
}
```

**Configuration**:
```json
// email-account.json
{
  "host": "imap.gmail.com",
  "port": 993,
  "secure": true,
  "auth": {
    "user": "email@example.com",
    "pass": "app-specific-password"
  }
}
```

**Service File**: `services/emailService.js`

---

### POST /api/emails/convert-to-tasks
**Purpose**: Convert email to task

**Request**:
```javascript
POST /api/emails/convert-to-tasks
Content-Type: application/json

{
  "uid": 12345,
  "taskData": {
    "title": "Review campaign",
    "description": "Email content...",
    "priority": "high",
    "assignee": "user@example.com"
  }
}
```

**Response**:
```json
{
  "success": true,
  "taskId": "task-001"
}
```

---

### POST /api/emails/:uid/mark-read
**Purpose**: Mark email as read

**Request**:
```javascript
POST /api/emails/12345/mark-read
```

**Response**:
```json
{
  "success": true
}
```

---

## Task Management

### GET /api/tasks
**Purpose**: Get all tasks

**Response**:
```json
{
  "tasks": [
    {
      "id": "task-001",
      "title": "Review campaign",
      "description": "...",
      "status": "open",
      "priority": "high",
      "assignee": "user@example.com",
      "dueDate": "2025-10-30",
      "createdAt": "2025-10-23T10:00:00Z"
    }
  ]
}
```

**File Location**: `tasks.json`

---

### POST /api/tasks
**Purpose**: Create new task

**Request**:
```javascript
POST /api/tasks
Content-Type: application/json

{
  "title": "Update messaging",
  "description": "Update all Q4 messages",
  "priority": "medium",
  "assignee": "user@example.com",
  "dueDate": "2025-11-15"
}
```

**Response**:
```json
{
  "success": true,
  "taskId": "task-002"
}
```

---

## Asset Management

### POST /api/assets/preview-metadata
**Purpose**: Extract metadata from uploaded file

**Request** (multipart/form-data):
```javascript
POST /api/assets/preview-metadata
Content-Type: multipart/form-data

file: [binary image data]
```

**Response**:
```json
{
  "success": true,
  "filename": "original-filename.jpg",
  "metadata": {
    "dimensions": "656x459",
    "type": "image/jpeg",
    "size": 245678,
    "suggestedMetadata": {
      "brand": "ERSTE",
      "product": "VAL",
      "type": "background",
      "visualKeyword": "x",
      "visualDescription": "1",
      "placeholder": "backgroundImage1",
      "crop": "psd",
      "version": "v1"
    }
  },
  "tempPath": "/temp/upload-abc123.jpg"
}
```

**Implementation**: Uses `image-size` library and filename parsing

---

### POST /api/assets/confirm-upload
**Purpose**: Finalize upload and rename file

**Request**:
```javascript
POST /api/assets/confirm-upload
Content-Type: application/json

{
  "tempPath": "/temp/upload-abc123.jpg",
  "metadata": {
    "brand": "ERSTE",
    "product": "VAL",
    "type": "background",
    "visualKeyword": "x",
    "visualDescription": "1",
    "dimensions": "656x459",
    "placeholder": "backgroundImage1",
    "crop": "psd",
    "version": "v1"
  },
  "tags": ["Facebook", "Instagram"],
  "directory": "assets"
}
```

**Response**:
```json
{
  "success": true,
  "filename": "ERSTE_VAL_background_x_1_656x459_backgroundImage1_psd_v1.jpg",
  "path": "/src/assets/ERSTE_VAL_background_x_1_656x459_backgroundImage1_psd_v1.jpg",
  "assetId": "asset-001"
}
```

**Process**:
1. Validate metadata
2. Generate filename using pattern
3. Move file from temp to target directory
4. Add entry to `assets.json`
5. Return final path

---

### POST /api/assets/cancel-upload
**Purpose**: Cancel upload and delete temp file

**Request**:
```javascript
POST /api/assets/cancel-upload
Content-Type: application/json

{
  "tempPath": "/temp/upload-abc123.jpg"
}
```

**Response**:
```json
{
  "success": true
}
```

---

### GET /api/assets/temp-preview/:filename
**Purpose**: Preview uploaded temp file

**Request**:
```javascript
GET /api/assets/temp-preview/upload-abc123.jpg
```

**Response**: Image binary data

---

### GET /api/assets/registry
**Purpose**: Get complete asset registry

**Response**:
```json
{
  "assets": [
    {
      "id": "asset-001",
      "filename": "ERSTE_VAL_background_x_1_656x459_backgroundImage1_psd_v1.jpg",
      "originalFilename": "original.jpg",
      "uploadDate": "2025-10-23T10:00:00Z",
      "metadata": {
        "brand": "ERSTE",
        "product": "VAL",
        "type": "background",
        "visualKeyword": "x",
        "visualDescription": "1",
        "dimensions": "656x459",
        "placeholder": "backgroundImage1",
        "crop": "psd",
        "version": "v1",
        "platform": "Facebook"
      },
      "tags": ["Facebook", "Instagram"],
      "platforms": ["Facebook", "Instagram"],
      "status": "active",
      "directory": "assets"
    }
  ]
}
```

**File Location**: `assets.json`

---

### POST /api/assets/registry
**Purpose**: Add or update asset in registry

**Request**:
```javascript
POST /api/assets/registry
Content-Type: application/json

{
  "id": "asset-001",
  "filename": "...",
  "metadata": { ... },
  "tags": [...],
  "status": "active"
}
```

**Response**:
```json
{
  "success": true,
  "assetId": "asset-001"
}
```

---

### DELETE /api/assets/registry
**Purpose**: Remove asset from registry

**Request**:
```javascript
DELETE /api/assets/registry
Content-Type: application/json

{
  "id": "asset-001"
}
```

**Response**:
```json
{
  "success": true
}
```

---

### GET /api/assets/stats
**Purpose**: Get asset statistics

**Response**:
```json
{
  "total": 150,
  "active": 120,
  "archived": 25,
  "deleted": 5,
  "byPlatform": {
    "Facebook": 80,
    "Instagram": 60,
    "LinkedIn": 10
  },
  "byType": {
    "background": 50,
    "product": 40,
    "lifestyle": 30,
    "icon": 30
  }
}
```

---

## Processed Emails

### GET /api/processed-emails
**Purpose**: Get list of processed email UIDs

**Response**:
```json
{
  "processedEmails": [12345, 12346, 12347]
}
```

**File Location**: `processed-emails.json`

---

### POST /api/processed-emails
**Purpose**: Add email to processed list

**Request**:
```javascript
POST /api/processed-emails
Content-Type: application/json

{
  "uid": 12348
}
```

**Response**:
```json
{
  "success": true
}
```

---

## Authentication

### Google Service Account Flow

**Implementation in `server.js`**:

```javascript
async function getGoogleAccessToken() {
  // Check cache
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  // Load service account key
  const serviceAccount = JSON.parse(
    fs.readFileSync(process.env.GOOGLE_SERVICE_ACCOUNT_PATH)
  );

  // Generate JWT
  const jwt = await new jose.SignJWT({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  })
    .setProtectedHeader({ alg: 'RS256' })
    .sign(await jose.importPKCS8(serviceAccount.private_key, 'RS256'));

  // Exchange for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const { access_token, expires_in } = await tokenResponse.json();

  // Cache token
  tokenCache = {
    token: access_token,
    expiresAt: Date.now() + (expires_in * 1000) - 60000 // 1 min buffer
  };

  return access_token;
}
```

**Token Lifespan**: 1 hour (auto-refreshed)

---

## CORS Configuration

**Allowed Origins**:
```javascript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3003',
  'https://messagingmatrix.ai',
  'https://www.messagingmatrix.ai'
];
```

**Implementation**:
```javascript
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## Error Handling

**Standard Error Response**:
```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Status Codes**:
- 200: Success
- 400: Bad request
- 401: Unauthorized
- 404: Not found
- 500: Server error
