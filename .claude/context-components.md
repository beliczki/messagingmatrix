# Messaging Matrix - Component Reference

## Component Hierarchy & Responsibilities

### App.jsx (Root Component)
**Lines**: ~400
**Location**: `src/App.jsx`

**Responsibilities**:
- Module/view switching (Matrix, CreativeLibrary, Assets, Tasks, Templates, Users, Settings)
- Authentication state management via AuthContext
- Matrix view state persistence (localStorage)
- Look & feel settings management
- Main navigation menu
- Route handling

**Key State**:
```javascript
const [currentModule, setCurrentModule] = useState('matrix');
const [matrixViewState, setMatrixViewState] = useState({
  columnWidths: {},
  sortedAudiences: [],
  sortedTopics: [],
  filters: { audiences: [], topics: [], statuses: [], products: [] }
});
const [config, setConfig] = useState(null);
```

**Key Functions**:
- `handleLogin()` - User authentication
- `handleLogout()` - Clear session
- `loadConfig()` - Load config.json from backend
- `saveConfig()` - Save config.json to backend

---

### Matrix.jsx (Main Business Logic)
**Lines**: 1,530
**Location**: `src/components/Matrix.jsx`

**Purpose**: Core matrix grid interface for organizing messages by topic and audience

**Key Features**:
- Matrix grid rendering with audience columns & topic rows
- Drag & drop message management
- Keyboard controls (Space for pan/zoom)
- Filter system (AND/OR logic)
- Message cell operations (add, edit, delete, move, copy)
- Search functionality
- Claude chat integration
- State management dialog

**Component Structure**:
```javascript
function Matrix({ onViewStateChange, initialViewState, config, onConfigChange }) {
  const matrixRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [filters, setFilters] = useState({
    audiences: [],
    topics: [],
    statuses: [],
    products: [],
    searchText: '',
    searchMode: 'AND'
  });
  const [selectedMessages, setSelectedMessages] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);

  // Core data from useMatrix hook
  const {
    audiences,
    topics,
    messages,
    messageIndex,
    load,
    save,
    addMessage,
    updateMessage,
    deleteMessage,
    moveMessage,
    copyMessage
  } = useMatrix();

  // ... render matrix grid
}
```

**Key Functions**:
- `handleCellClick(topic, audience)` - Create new message
- `handleMessageClick(message)` - Open message editor
- `handleDragStart(message)` - Begin drag operation
- `handleDrop(topic, audience)` - Complete drag operation
- `handleCopyMessage(message)` - Copy message (Ctrl+Drag)
- `applyFilters()` - Filter visible topics/audiences
- `handleSearch()` - Search messages

**Keyboard Shortcuts**:
- `Space + Drag` - Pan view
- `Space + Scroll` - Zoom
- `Ctrl + Drag` - Copy message
- `Drag` - Move message

**File Reference**: `src/components/Matrix.jsx:1530`

---

### TreeView.jsx (Visualization)
**Lines**: 902
**Location**: `src/components/TreeView.jsx`

**Purpose**: Hierarchical decision tree visualization of message strategy

**Key Features**:
- Customizable tree structure (Product → Strategy → Targeting → Audience → Topic → Messages)
- Interactive pan & zoom
- Draggable nodes for custom positioning
- Toggle between curved and elbow connectors
- Status-based color coding
- Real-time filtering

**Tree Structure** (configurable via config.json):
```
Product
└── Strategy
    └── Targeting Type
        └── Audience
            └── Topic
                └── Messages
```

**Component Structure**:
```javascript
function TreeView({ config }) {
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [nodePositions, setNodePositions] = useState({});
  const [connectorStyle, setConnectorStyle] = useState('curved');
  const [statusFilter, setStatusFilter] = useState([]);

  const { audiences, topics, messages } = useMatrix();

  // Build tree from flat data
  const tree = buildTree(audiences, topics, messages, config.treeStructure);

  // Render recursive tree nodes
}
```

**Key Functions**:
- `buildTree()` - Convert flat data to hierarchical structure
- `renderNode()` - Recursive node rendering
- `handleNodeDrag()` - Custom node positioning
- `calculateConnectorPath()` - SVG path generation

**File Reference**: `src/components/TreeView.jsx:902`

---

### MessageEditorDialog.jsx (Message Editor)
**Lines**: 1,320
**Location**: `src/components/MessageEditorDialog.jsx`

**Purpose**: Comprehensive message editing interface

**Tabs**:
1. **Naming**: ID, number, variant, version, status, template
2. **Content**: headline, copy1, copy2, flash, cta, landingUrl, images
3. **Preview**: HTML rendering in multiple sizes
4. **Trafficking**: Auto-generated UTM fields

**Component Structure**:
```javascript
function MessageEditorDialog({ message, onSave, onClose, config }) {
  const [activeTab, setActiveTab] = useState('naming');
  const [formData, setFormData] = useState(message || {
    id: uuidv4(),
    number: nextNumber,
    variant: 'a',
    version: 1,
    status: 'PLANNED',
    headline: '',
    copy1: '',
    copy2: '',
    flash: '',
    cta: '',
    landingUrl: '',
    template: '',
    image1-6: ''
  });
  const [previewSize, setPreviewSize] = useState('300x250');
  const [showClaudeChat, setShowClaudeChat] = useState(false);

  // Auto-generate trafficking fields
  useEffect(() => {
    const trafficking = generateTraffickingFields(formData, audiences, config.patterns.trafficking);
    const pmmid = generatePMMID(formData, audiences, config.patterns.pmmid);
    setFormData(prev => ({ ...prev, ...trafficking, pmmid }));
  }, [formData.audience, formData.topic, formData.number, formData.variant, formData.version]);
}
```

**Key Features**:
- Real-time PMMID & trafficking field generation
- Template variant class support
- Multi-size HTML preview (300x250, 300x600, 640x360, 970x250, 1080x1080)
- Sync warning for multi-audience updates
- Claude AI integration
- Delete confirmation

**File Reference**: `src/components/MessageEditorDialog.jsx:1320`

---

### CreativeLibrary.jsx (Asset Library)
**Lines**: 930
**Location**: `src/components/CreativeLibrary.jsx`

**Purpose**: Visual asset library with filtering and sharing

**Key Features**:
- Virtual scrolling for performance (chunked rendering)
- Masonry layout (3-column, 4-column grid)
- List view option
- Upload dialog with metadata extraction
- Share gallery integration
- Filter & search across multiple dimensions
- ZIP download for batch export

**Component Structure**:
```javascript
function CreativeLibrary({ config }) {
  const [view, setView] = useState('grid-3'); // 'grid-3', 'grid-4', 'list'
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState({
    platform: [],
    type: [],
    brand: [],
    product: [],
    status: [],
    searchText: ''
  });
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);

  // Virtual scrolling state
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

  useEffect(() => {
    fetchAssets();
  }, []);
}
```

**Key Functions**:
- `fetchAssets()` - Load assets.json registry
- `handleUpload()` - Upload workflow
- `handleShare()` - Create share gallery
- `handleDownloadZip()` - Batch download
- `applyFilters()` - Filter assets
- `calculateMasonryLayout()` - Layout calculation

**File Reference**: `src/components/CreativeLibrary.jsx:930`

---

### Assets.jsx (Asset Management)
**Lines**: 1,054
**Location**: `src/components/Assets.jsx`

**Purpose**: Asset upload, management, and registry maintenance

**Key Features**:
- Upload workflow with metadata extraction
- Asset preview dialog
- Registry management (assets.json)
- Asset statistics dashboard
- Status management (active, archived, deleted)
- Bulk operations

**Upload Workflow**:
1. User selects files
2. Backend extracts metadata (dimensions, type, size)
3. Preview dialog shows with editable fields
4. User confirms metadata
5. Backend renames file using naming pattern
6. File moved to `/src/assets/` or `/src/creatives/`
7. Registry updated in `assets.json`

**Component Structure**:
```javascript
function Assets() {
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, archived: 0 });
  const [uploadState, setUploadState] = useState({
    files: [],
    previews: [],
    metadata: []
  });
  const [showUploadDialog, setShowUploadDialog] = useState(false);
}
```

**Asset Metadata Fields**:
1. Brand
2. Product
3. Type
4. Visual Keyword
5. Visual Description
6. Dimensions (auto-extracted)
7. Placeholder Name
8. Cropping Template
9. Version
10. Platform/Tags

**File Reference**: `src/components/Assets.jsx:1054`

---

### ClaudeChat.jsx (AI Integration)
**Lines**: 767
**Location**: `src/components/ClaudeChat.jsx`

**Purpose**: AI-powered content generation via Claude API

**Key Features**:
- Collapsible chat interface
- Context-aware prompts
- Message history
- Resizable window
- Task integration
- API key configuration

**Component Structure**:
```javascript
function ClaudeChat({ context, onContentGenerated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('claudeApiKey'));

  const sendMessage = async () => {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...messages, { role: 'user', content: input }],
        context: context
      })
    });
    // Handle streaming response
  };
}
```

**Context Format**:
```javascript
{
  audience: { name: '...', strategy: '...', product: '...' },
  topic: { name: '...', tags: [...] },
  message: { /* existing message fields */ }
}
```

**File Reference**: `src/components/ClaudeChat.jsx:767`

---

### PreviewView.jsx (Share Gallery)
**Lines**: 1,440
**Location**: `src/components/PreviewView.jsx`

**Purpose**: Message preview and share gallery generation

**Key Features**:
- Multi-message preview
- Share URL generation
- Masonry layout gallery
- Comment system
- ZIP download
- Multiple size previews (300x250, 300x600, 640x360, 970x250, 1080x1080)
- Iframe scaling for HTML ads

**Share Structure**:
```
public/share/{shareId}/
├── manifest.json
├── {message1}_300x250.html
├── {message1}_640x360.html
├── {message2}_300x250.html
├── assets/
│   ├── image1.jpg
│   └── image2.png
└── comments.json
```

**Component Structure**:
```javascript
function PreviewView({ messages, config }) {
  const [shareId, setShareId] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [layout, setLayout] = useState('masonry');
  const [selectedSizes, setSelectedSizes] = useState(['300x250', '640x360']);

  const createShare = async () => {
    const response = await fetch('/api/shares', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: messages,
        sizes: selectedSizes,
        config: config
      })
    });
    const { shareId } = await response.json();
    setShareUrl(`${window.location.origin}/share/${shareId}`);
  };
}
```

**File Reference**: `src/components/PreviewView.jsx:1440`

---

### Templates.jsx (Template Management)
**Lines**: 1,107
**Location**: `src/components/Templates.jsx`

**Purpose**: HTML email template editing and management

**Template Files**:
```
src/templates/html/
├── index.html              # Main template
├── template.json           # Field mappings
├── main.css                # Base styles
├── 300x250.css
├── 300x600.css
├── 640x360.css
├── 970x250.css
└── 1080x1080.css
```

**Component Structure**:
```javascript
function Templates() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedFile, setSelectedFile] = useState('index.html');
  const [fileContent, setFileContent] = useState('');
  const [preview, setPreview] = useState('');

  const loadTemplate = async (templateName, fileName) => {
    const response = await fetch(`/api/templates/${templateName}/${fileName}`);
    const content = await response.text();
    setFileContent(content);
  };

  const saveTemplate = async () => {
    await fetch(`/api/templates/${selectedTemplate}/${selectedFile}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: fileContent })
    });
  };
}
```

**File Reference**: `src/components/Templates.jsx:1107`

---

### Settings.jsx (Configuration UI)
**Lines**: 797
**Location**: `src/components/Settings.jsx`

**Purpose**: Application configuration management

**Configuration Sections**:
1. **Google Sheets**: Spreadsheet ID
2. **Image Base URLs**: CDN/S3 URLs for images
3. **Patterns**: PMMID, topic key, trafficking field patterns
4. **Tree Structure**: Hierarchy configuration
5. **Look & Feel**: Colors and branding
6. **Users**: User management (add/edit/delete)

**File Reference**: `src/components/Settings.jsx:797`

---

### Tasks.jsx (Task Management)
**Lines**: 605
**Location**: `src/components/Tasks.jsx`

**Purpose**: Task tracking and management

**Features**:
- Create tasks from emails
- Task status tracking
- Assignment & priority
- Due dates
- Integration with email service

**File Reference**: `src/components/Tasks.jsx:605`

---

## Utility Hooks

### useMatrix.js
**Lines**: 355
**Location**: `src/hooks/useMatrix.js`

**Purpose**: Central data management hook for audiences, topics, messages

**Exports**:
```javascript
{
  audiences: Audience[],
  topics: Topic[],
  messages: Message[],
  messageIndex: { [key: string]: Message },
  keywords: object,
  loading: boolean,
  lastSync: string,
  load: () => Promise<void>,
  save: () => Promise<void>,
  addAudience: (audience: Audience) => void,
  addTopic: (topic: Topic) => void,
  addMessage: (message: Message) => void,
  updateMessage: (message: Message) => void,
  deleteMessage: (messageId: string) => void,
  moveMessage: (messageId: string, newTopic: string, newAudience: string) => void,
  copyMessage: (messageId: string, newTopic: string) => void,
  getMessages: (topic: string, audience: string) => Message[]
}
```

**File Reference**: `src/hooks/useMatrix.js:355`
