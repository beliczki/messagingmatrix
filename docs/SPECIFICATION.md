# Messaging Matrix - Technical Specification

## Document Version
- **Version**: 1.0.0
- **Last Updated**: 2025-10-10
- **Status**: Current Implementation

---

## 1. System Overview

### 1.1 Purpose
The Messaging Matrix is a web application for managing marketing messages across multiple audiences and topics. It provides:
- Visual matrix interface for message organization
- Hierarchical tree view for strategic planning
- Google Sheets integration for data persistence
- AI-powered message creation via Claude API

### 1.2 Target Users
- Marketing managers
- Content strategists
- Campaign planners
- Creative teams

### 1.3 System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              React Application (Vite)                  │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │ │
│  │  │   Matrix.jsx │  │ TreeView.jsx │  │ClaudeChat   │  │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │ │
│  │         │                  │                 │         │ │
│  │         └──────────────────┴─────────────────┘         │ │
│  │                          │                              │ │
│  │                   ┌──────▼────────┐                     │ │
│  │                   │  useMatrix.js │                     │ │
│  │                   └──────┬────────┘                     │ │
│  │                          │                              │ │
│  │         ┌────────────────┴────────────────┐             │ │
│  │         │                                 │             │ │
│  │  ┌──────▼──────┐                 ┌───────▼────────┐    │ │
│  │  │ sheets.js   │                 │ settings.js    │    │ │
│  │  └──────┬──────┘                 └────────────────┘    │ │
│  └─────────┼─────────────────────────────────────────────┘ │
│            │                                                │
│     ┌──────▼────────┐                                      │
│     │ localStorage  │                                      │
│     └───────────────┘                                      │
└─────────────┬───────────────────────────────────────────────┘
              │
    ┌─────────┴──────────┐
    │                    │
┌───▼────────────┐  ┌────▼─────────────┐
│ Express Server │  │ Google Sheets    │
│  (Claude Proxy)│  │  API             │
└────────┬───────┘  └──────────────────┘
         │
    ┌────▼─────────────┐
    │ Anthropic API    │
    │ (Claude)         │
    └──────────────────┘
```

---

## 2. Data Models

### 2.1 Audience Entity

**Purpose**: Represents a target audience segment for messaging campaigns.

**Storage**:
- Google Sheets: "Audiences" sheet (17 columns, A-Q)
- localStorage: `messagingmatrix_data_Audiences`

**Schema**:
```typescript
interface Audience {
  id: number;              // Auto-increment numeric ID
  key: string;             // Unique key (e.g., "aud1", "aud2")
  name: string;            // Display name
  order: number;           // Sort order in matrix
  status: string;          // "ACTIVE" | "INACTIVE" | ""
  product: string;         // Product identifier
  strategy: string;        // "Prospecting" | "Retargeting" | custom
  buying_platform: string; // Platform identifier
  data_source: string;     // Data provider/source
  targeting_type: string;  // "Segment" | "Lookalike" | custom
  device: string;          // "Mobile" | "Desktop" | "All"
  tag: string;             // Custom tag
  comment: string;         // Notes
  campaign_name: string;   // Campaign reference
  campaign_id: string;     // External campaign ID
  lineitem_name: string;   // Line item reference
  lineitem_id: string;     // External line item ID
}
```

**Constraints**:
- `id`: Must be unique, auto-generated
- `key`: Must be unique, format: /aud\d+/
- `order`: Must be positive integer
- All other fields optional (empty string default)

**Indexes**:
- Primary: `id`
- Unique: `key`
- Sort: `order`

**Operations**:
```typescript
// Create
addAudience(audience: Audience | string): void

// Read
audiences: Audience[]  // All audiences

// Update
updateAudience(id: number, updates: Partial<Audience>): void

// Delete
deleteAudience(id: number): void
```

### 2.2 Topic Entity

**Purpose**: Represents a message topic or theme.

**Storage**:
- Google Sheets: "Topics" sheet (12 columns, A-L)
- localStorage: `messagingmatrix_data_Topics`

**Schema**:
```typescript
interface Topic {
  id: number;        // Auto-increment numeric ID
  key: string;       // Unique key (e.g., "top1", "top2")
  name: string;      // Display name
  order: number;     // Sort order in matrix
  status: string;    // Topic status
  product: string;   // Product identifier
  tag1: string;      // Category tag 1
  tag2: string;      // Category tag 2
  tag3: string;      // Category tag 3
  tag4: string;      // Category tag 4
  created: string;   // Creation date (ISO 8601)
  comment: string;   // Notes
}
```

**Constraints**:
- `id`: Must be unique, auto-generated
- `key`: Must be unique, format: /top\d+/
- `order`: Must be positive integer
- `created`: ISO 8601 format (optional)

**Indexes**:
- Primary: `id`
- Unique: `key`
- Sort: `order`

**Operations**:
```typescript
// Create
addTopic(topic: Topic | string): void

// Read
topics: Topic[]  // All topics

// Update
updateTopic(id: number, updates: Partial<Topic>): void

// Delete
deleteTopic(id: number): void
```

### 2.3 Message Entity

**Purpose**: Represents a marketing message within a specific audience-topic cell.

**Storage**:
- Google Sheets: "Messages" sheet (26 columns, A-Z)
- localStorage: `messagingmatrix_data_Messages`

**Schema**:
```typescript
interface Message {
  // Identity
  id: number;              // Auto-increment numeric ID
  name: string;            // Custom name (optional)
  number: number;          // Message number (global)
  variant: string;         // Variant letter ('a', 'b', 'c'...)
  version: number;         // Version number (starts at 1)

  // Relationships
  audience: string;        // FK to Audience.key
  topic: string;           // FK to Topic.key

  // Composite Key
  pmmid: string;           // Format: "a_{audience}-t_{topic}-m_{number}-v_{variant}-n_{version}"

  // Status
  status: string;          // "PLANNED" | "LIVE" | "RUNNING" | "PAUSED" | "DRAFT" | "deleted"
  start_date: string;      // Campaign start (ISO 8601)
  end_date: string;        // Campaign end (ISO 8601)

  // Template
  template: string;        // Template identifier
  template_variant_classes: string; // CSS classes for template variant

  // Content
  headline: string;        // Message headline
  copy1: string;           // Primary copy
  copy2: string;           // Secondary copy
  cta: string;             // Call-to-action text

  // Assets
  image1: string;          // Image filename/URL 1
  image2: string;          // Image filename/URL 2
  image3: string;          // Image filename/URL 3
  image4: string;          // Image filename/URL 4
  image5: string;          // Image filename/URL 5
  image6: string;          // Sticker/icon filename/URL
  flash: string;           // Flash animation reference

  // Metadata
  landingUrl: string;      // Destination URL
  comment: string;         // Notes
}
```

**Constraints**:
- `id`: Must be unique, auto-generated
- `audience`: Must reference valid Audience.key
- `topic`: Must reference valid Topic.key
- `number`: Must be positive integer
- `variant`: Must be lowercase letter [a-z]
- `version`: Must be positive integer
- `pmmid`: Auto-generated, format validated
- `status`: Enum validation (optional for backward compatibility)

**Composite Identity**:
Messages are uniquely identified by: `(audience, topic, number, variant, version)`

**PMMID Format**:
```
a_{audience}-t_{topic}-m_{number}-v_{variant}-n_{version}
Example: a_aud2-t_top1-m_5-v_b-n_2
```

**Message Numbering Logic**:

1. **Empty Cell** (no messages for audience+topic):
   ```
   number = MAX(all message numbers) + 1
   variant = 'a'
   version = 1
   ```

2. **Occupied Cell** (messages exist for audience+topic):
   ```
   number = existing number in cell
   variant = NEXT_CHAR(MAX(variants in cell))
   version = 1
   ```

3. **Duplicate/Version**:
   ```
   number = unchanged
   variant = unchanged
   version = MAX(versions) + 1
   ```

**Status Lifecycle**:
```
         ┌──────────┐
         │ PLANNED  │ (default)
         └────┬─────┘
              │
              ▼
         ┌──────────┐
         │   LIVE   │ or │ RUNNING │
         └────┬─────┘
              │
         ┌────┴─────┐
         ▼          ▼
    ┌────────┐  ┌────────┐
    │ PAUSED │  │ deleted│ (soft delete)
    └────────┘  └────────┘
```

**Indexes**:
- Primary: `id`
- Composite: `(audience, topic, number, variant, version)`
- Lookup: `messagesByCell["{topic}-{audience}"]`
- Filter: `status !== 'deleted'`

**Operations**:
```typescript
// Create
addMessage(topic: string, audience: string): void

// Read
getMessages(topic: string, audience: string): Message[]
messages: Message[]  // All messages

// Update
updateMessage(id: number, updates: Partial<Message>): void

// Delete
deleteMessage(id: number): void  // Soft delete (status='deleted')

// Copy
copyMessage(id: number, newAudience: string): void

// Move
moveMessage(id: number, newAudience: string): void

// Duplicate (new version)
duplicateMessage(id: number): void
```

---

## 3. Core Components

### 3.1 Matrix.jsx

**Purpose**: Main application container, coordinates views and data operations.

**Props**: None (root component)

**State**:
```typescript
interface MatrixState {
  viewMode: 'matrix' | 'tree';
  showClaudeChat: boolean;
  audienceFilter: string;      // Status filter
  topicTagFilters: string[];   // Tag filters
  // ... delegated to useMatrix
}
```

**View Modes**:

#### Matrix View
- Grid layout with audiences (rows) × topics (columns)
- Cell-based message management
- Inline editing for audiences/topics
- Message cards with status indicators
- Add/edit/delete operations

#### Tree View
- Hierarchical visualization
- Strategy → Targeting Type → Audience → Topic → Messages
- Drag-and-drop repositioning
- Elbow connectors between nodes
- Color-coded levels

**Key Functions**:

```typescript
// View Management
function toggleView(): void
function toggleClaudeChat(): void

// Filter Management
function setAudienceFilter(status: string): void
function setTopicTagFilter(tag: string, enabled: boolean): void

// Message Operations
function handleAddMessage(topic: string, audience: string): void
function handleUpdateMessage(id: number, updates: Partial<Message>): void
function handleDeleteMessage(id: number): void
function handleDuplicateMessage(id: number): void
function handleMoveMessage(id: number, newAudience: string): void
function handleCopyMessage(id: number, newAudience: string): void

// Audience Operations
function handleAddAudience(): void
function handleUpdateAudience(id: number, updates: Partial<Audience>): void
function handleDeleteAudience(id: number): void

// Topic Operations
function handleAddTopic(): void
function handleUpdateTopic(id: number, updates: Partial<Topic>): void
function handleDeleteTopic(id: number): void

// Data Sync
function handleLoad(): void
function handleSave(): void
```

**Rendering Logic**:

```typescript
return (
  <div className="app-container">
    {/* Header */}
    <div className="header">
      <ViewToggle mode={viewMode} onChange={toggleView} />
      <FilterControls />
      <SyncStatus />
      <ClaudeChatToggle />
    </div>

    {/* Main Content */}
    {viewMode === 'matrix' ? (
      <MatrixGrid
        audiences={filteredAudiences}
        topics={filteredTopics}
        getMessages={getMessages}
        onAddMessage={handleAddMessage}
        {...handlers}
      />
    ) : (
      <TreeView
        audiences={filteredAudiences}
        topics={filteredTopics}
        messages={messages}
        getMessages={getMessages}
      />
    )}

    {/* Sidebar */}
    {showClaudeChat && (
      <ClaudeChat
        audiences={audiences}
        topics={topics}
        onCreateMessage={handleAddMessage}
      />
    )}
  </div>
);
```

**Event Flow**:

```
User Action
    │
    ├─ Add Message
    │   └─> handleAddMessage(topic, audience)
    │       └─> useMatrix.addMessage()
    │           └─> Calculate number/variant
    │           └─> Generate PMMID
    │           └─> setState([...messages, newMessage])
    │
    ├─ Update Message
    │   └─> handleUpdateMessage(id, updates)
    │       └─> useMatrix.updateMessage()
    │           └─> setState(messages.map())
    │
    ├─ Delete Message
    │   └─> handleDeleteMessage(id)
    │       └─> useMatrix.deleteMessage()
    │           └─> setState(messages.map(m => m.id === id ? {...m, status: 'deleted'} : m))
    │
    └─ Save
        └─> handleSave()
            └─> useMatrix.save()
                └─> sheets.saveAll()
                    └─> Serialize to 2D arrays
                    └─> POST /clear
                    └─> PUT /values
```

### 3.2 TreeView.jsx

**Purpose**: Hierarchical decision tree visualization with drag-and-drop.

**Props**:
```typescript
interface TreeViewProps {
  audiences: Audience[];
  topics: Topic[];
  messages: Message[];
  getMessages: (topic: string, audience: string) => Message[];
}
```

**State**:
```typescript
interface TreeViewState {
  nodePositions: Record<string, {x: number, y: number}>;
  dragging: {
    type: string;
    data: any;
    offsetX: number;
    offsetY: number;
  } | null;
}
```

**Data Transformation**:

```typescript
interface TreeData {
  strategies: {
    [strategyName: string]: {
      name: string;
      targetingTypes: {
        [typeName: string]: {
          name: string;
          audiences: {
            [audienceKey: string]: {
              data: Audience;
              topics: {
                [topicKey: string]: {
                  data: Topic;
                  messages: Message[];
                };
              };
            };
          };
        };
      };
    };
  };
}

function buildTree(): TreeData {
  const tree = { strategies: {} };

  audiences.forEach(audience => {
    const strategy = audience.strategy || 'Unknown';
    const targetingType = audience.targeting_type || 'Unknown';
    const audienceKey = audience.key;

    // Initialize nested structure
    if (!tree.strategies[strategy]) {
      tree.strategies[strategy] = {
        name: strategy,
        targetingTypes: {}
      };
    }

    if (!tree.strategies[strategy].targetingTypes[targetingType]) {
      tree.strategies[strategy].targetingTypes[targetingType] = {
        name: targetingType,
        audiences: {}
      };
    }

    if (!tree.strategies[strategy].targetingTypes[targetingType].audiences[audienceKey]) {
      tree.strategies[strategy].targetingTypes[targetingType].audiences[audienceKey] = {
        data: audience,
        topics: {}
      };
    }

    // Add topics with messages
    topics.forEach(topic => {
      const cellMessages = getMessages(topic.key, audienceKey);
      if (cellMessages.length > 0) {
        tree.strategies[strategy].targetingTypes[targetingType]
          .audiences[audienceKey].topics[topic.key] = {
            data: topic,
            messages: cellMessages
          };
      }
    });
  });

  return tree;
}
```

**Layout Algorithm**:

```typescript
// Constants
const startX = 400;
const startY = 50;
const strategyY = 150;
const targetingY = 280;
const audienceY = 410;
const topicY = 540;
const messageY = 680;

const strategySpacing = 300;
const targetingSpacing = 200;
const audienceSpacing = 180;
const topicSpacing = 150;
const messageSpacing = 130;

// Dynamic width calculation
let currentStrategyX = startX;

Object.entries(strategies).forEach(([name, data]) => {
  const strategyX = currentStrategyX;

  // Center children under parent
  const targetingTypes = Object.entries(data.targetingTypes);
  let currentTargetingX = targetingX - ((targetingTypes.length - 1) * targetingSpacing) / 2;

  targetingTypes.forEach(([ttName, ttData]) => {
    const targetingX = currentTargetingX;

    // Repeat for audiences, topics, messages...

    currentTargetingX += targetingSpacing;
  });

  // Calculate branch width for next strategy
  const branchWidth = /* sum of child widths */;
  currentStrategyX += Math.max(strategySpacing, branchWidth + 100);
});
```

**Node Components**:

```typescript
// Decision Node (non-leaf)
function DecisionNode({
  label: string,
  value: string,
  x: number,
  y: number,
  nodeType: string,
  nodeData: any,
  color: string,
  bgColor: string
}): JSX.Element {
  const pos = getNodePosition(nodeType, nodeData, x, y);

  return (
    <g
      onMouseDown={(e) => handleMouseDown(e, nodeType, nodeData, x, y)}
      style={{ cursor: 'move' }}
    >
      <rect
        x={pos.x - 70}
        y={pos.y - 20}
        width={140}
        height={40}
        rx={5}
        fill={bgColor}
        stroke={color}
        strokeWidth={2}
      />
      <text x={pos.x} y={pos.y - 5} className="label">{label}</text>
      <text x={pos.x} y={pos.y + 10} className="value">{value}</text>
    </g>
  );
}

// Message Card (leaf node)
function MessageCard({
  message: Message,
  x: number,
  y: number
}): JSX.Element {
  const pos = getNodePosition('message', message, x, y);
  const statusColor = getStatusColor(message.status);

  return (
    <g onMouseDown={(e) => handleMouseDown(e, 'message', message, x, y)}>
      <rect
        x={pos.x - 60}
        y={pos.y - 35}
        width={120}
        height={70}
        rx={8}
        fill="#ffffff"
        stroke={statusColor}
        strokeWidth={3}
      />
      <text x={pos.x} y={pos.y - 15}>
        {message.number}{message.variant}
      </text>
      <text x={pos.x} y={pos.y + 5}>
        {message.headline?.substring(0, 15)}...
      </text>
      <text x={pos.x} y={pos.y + 20}>
        {message.status}
      </text>
    </g>
  );
}

// Connector (elbow line)
function Connector({
  x1: number, y1: number,
  x2: number, y2: number,
  label?: string
}): JSX.Element {
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <line x1={x1} y1={y1} x2={x1} y2={midY} stroke="#94a3b8" strokeWidth={2} />
      <line x1={x1} y1={midY} x2={x2} y2={midY} stroke="#94a3b8" strokeWidth={2} />
      <line x1={x2} y1={midY} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth={2} />
      {label && <text x={(x1+x2)/2} y={midY-5}>{label}</text>}
    </g>
  );
}
```

**Drag-and-Drop Implementation**:

```typescript
// Mouse event handlers
function handleMouseDown(e, nodeType, nodeData, defaultX, defaultY): void {
  e.preventDefault();
  e.stopPropagation();

  const svg = svgRef.current;
  const rect = svg.getBoundingClientRect();
  const startX = e.clientX - rect.left;
  const startY = e.clientY - rect.top;

  const currentPos = getNodePosition(nodeType, nodeData, defaultX, defaultY);

  setDragging({
    type: nodeType,
    data: nodeData,
    offsetX: startX - currentPos.x,
    offsetY: startY - currentPos.y
  });
}

function handleMouseMove(e): void {
  if (!dragging) return;

  const svg = svgRef.current;
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left - dragging.offsetX;
  const y = e.clientY - rect.top - dragging.offsetY;

  const nodeKey = `${dragging.type}-${dragging.data.id || dragging.data.key || dragging.data}`;
  setNodePositions(prev => ({
    ...prev,
    [nodeKey]: { x, y }
  }));
}

function handleMouseUp(): void {
  setDragging(null);
}

// Position lookup with fallback
function getNodePosition(nodeType, nodeData, defaultX, defaultY): {x: number, y: number} {
  const nodeKey = `${nodeType}-${nodeData.id || nodeData.key || nodeData}`;
  return nodePositions[nodeKey] || { x: defaultX, y: defaultY };
}

// Reset all custom positions
function resetPositions(): void {
  setNodePositions({});
}
```

**Color Scheme**:

```typescript
const colors = {
  root: { fill: '#7c3aed', stroke: '#6d28d9' },
  strategy: { fill: '#fee2e2', stroke: '#dc2626' },
  targetingType: { fill: '#ffedd5', stroke: '#ea580c' },
  audience: { fill: '#dbeafe', stroke: '#2563eb' },
  topic: { fill: '#d1fae5', stroke: '#059669' },

  status: {
    live: '#10b981',
    running: '#10b981',
    paused: '#f59e0b',
    planned: '#3b82f6',
    draft: '#6b7280'
  }
};
```

### 3.3 useMatrix Hook

**Purpose**: Centralized data management, CRUD operations, state synchronization.

**Interface**:
```typescript
interface UseMatrixReturn {
  // State
  audiences: Audience[];
  topics: Topic[];
  messages: Message[];
  messagesByCell: Record<string, Message[]>;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSync: Date | null;

  // Operations
  load: () => Promise<void>;
  save: () => Promise<void>;

  addAudience: (nameOrObject: string | Audience) => void;
  updateAudience: (id: number, updates: Partial<Audience>) => void;
  deleteAudience: (id: number) => void;

  addTopic: (nameOrObject: string | Topic) => void;
  updateTopic: (id: number, updates: Partial<Topic>) => void;
  deleteTopic: (id: number) => void;

  addMessage: (topic: string, audience: string) => void;
  updateMessage: (id: number, updates: Partial<Message>) => void;
  deleteMessage: (id: number) => void;
  moveMessage: (id: number, newAudience: string) => void;
  copyMessage: (id: number, newAudience: string) => void;

  getMessages: (topic: string, audience: string) => Message[];
  getUrl: () => string;
  getSpreadsheetId: () => string;
}
```

**Implementation**:

```typescript
export const useMatrix = (): UseMatrixReturn => {
  // State
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesByCell, setMessagesByCell] = useState<Record<string, Message[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Rebuild lookup index on messages change
  useEffect(() => {
    const lookup: Record<string, Message[]> = {};
    messages
      .filter(m => m.status !== 'deleted')
      .forEach(m => {
        const cellKey = `${m.topic}-${m.audience}`;
        if (!lookup[cellKey]) {
          lookup[cellKey] = [];
        }
        lookup[cellKey].push(m);
      });
    setMessagesByCell(lookup);
  }, [messages]);

  // Load data from sheets
  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await sheets.loadAll();
      setAudiences(data.audiences);
      setTopics(data.topics);
      setMessages(data.messages);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data to sheets
  const save = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      await sheets.saveAll(audiences, topics, messages);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [audiences, topics, messages]);

  // Add message with smart numbering
  const addMessage = useCallback((topic: string, audience: string) => {
    // Get existing messages in cell
    const cellMessages = messages.filter(m =>
      m.topic === topic &&
      m.audience === audience &&
      m.status !== 'deleted'
    );

    let number: number;
    let variant: string;

    if (cellMessages.length > 0) {
      // Cell occupied - use same number, increment variant
      number = cellMessages[0].number;

      const variants = cellMessages.map(m => m.variant || 'a');
      const maxVariant = variants.sort().pop();
      variant = String.fromCharCode(maxVariant.charCodeAt(0) + 1);
    } else {
      // Cell empty - use global next number
      const allMessages = messages.filter(m => m.status !== 'deleted');
      const maxNumber = allMessages.length > 0
        ? Math.max(...allMessages.map(m => m.number || 0))
        : 0;

      number = maxNumber + 1;
      variant = 'a';
    }

    const version = 1;
    const pmmid = `a_${audience}-t_${topic}-m_${number}-v_${variant}-n_${version}`;

    // Generate new ID
    const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
    const newId = maxId + 1;

    setMessages(prev => [...prev, {
      id: newId,
      name: '',
      number,
      variant,
      audience,
      topic,
      version,
      pmmid,
      status: 'PLANNED',
      start_date: '',
      end_date: '',
      template: '',
      template_variant_classes: '',
      headline: '',
      copy1: '',
      copy2: '',
      image1: '',
      image2: '',
      image3: '',
      image4: '',
      image5: '',
      image6: '',
      flash: '',
      cta: '',
      landingUrl: '',
      comment: ''
    }]);
  }, [messages]);

  // Update message
  const updateMessage = useCallback((id: number, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, ...updates } : m
    ));
  }, []);

  // Delete message (soft)
  const deleteMessage = useCallback((id: number) => {
    setMessages(prev => prev.map(m =>
      m.id === id ? { ...m, status: 'deleted' } : m
    ));
  }, []);

  // Move message to new audience
  const moveMessage = useCallback((id: number, newAudience: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id) {
        const newPmmid = `a_${newAudience}-t_${m.topic}-m_${m.number}-v_${m.variant}-n_${m.version}`;
        return {
          ...m,
          audience: newAudience,
          pmmid: newPmmid
        };
      }
      return m;
    }));
  }, []);

  // Copy message to new audience
  const copyMessage = useCallback((id: number, newAudience: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    const maxId = Math.max(0, ...messages.map(m => parseInt(m.id) || 0));
    const newId = maxId + 1;

    const newPmmid = `a_${newAudience}-t_${msg.topic}-m_${msg.number}-v_${msg.variant}-n_${msg.version}`;

    setMessages(prev => [...prev, {
      ...msg,
      id: newId,
      pmmid: newPmmid,
      audience: newAudience
    }]);
  }, [messages]);

  // O(1) message lookup
  const getMessages = useCallback((topic: string, audience: string) => {
    const cellKey = `${topic}-${audience}`;
    return messagesByCell[cellKey] || [];
  }, [messagesByCell]);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  return {
    audiences,
    topics,
    messages,
    messagesByCell,
    isLoading,
    isSaving,
    error,
    lastSync,
    load,
    save,
    addAudience,
    updateAudience,
    deleteAudience,
    addTopic,
    updateTopic,
    deleteTopic,
    addMessage,
    updateMessage,
    deleteMessage,
    moveMessage,
    copyMessage,
    getMessages,
    getUrl: () => sheets.getUrl(),
    getSpreadsheetId: () => sheets.spreadsheetId
  };
};
```

**Performance Optimizations**:
- `messagesByCell` lookup: O(1) instead of O(n) filtering
- `useCallback` to prevent unnecessary re-renders
- `useEffect` with dependencies for computed state
- Batch updates in single setState call

---

## 4. Services

### 4.1 sheets.js - Google Sheets Service

**Purpose**: Bidirectional sync with Google Sheets API, localStorage persistence.

**Configuration**:
```typescript
interface SheetsConfig {
  baseUrl: string;               // 'https://sheets.googleapis.com/v4/spreadsheets'
  storageKey: string;            // 'messagingmatrix_data'
  spreadsheetId: string;         // From settings
  serviceAccountKey: string;     // JSON key from settings
  accessToken: string | null;    // Cached OAuth token
  tokenExpiry: number | null;    // Token expiration timestamp
}
```

**Authentication Flow**:

```typescript
async function getAccessToken(): Promise<string> {
  // Return cached token if valid
  if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
    return this.accessToken;
  }

  // Parse service account key
  const serviceAccount = JSON.parse(this.serviceAccountKey);

  // Import private key
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(serviceAccount.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Create JWT
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .sign(privateKey);

  // Exchange JWT for access token
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await response.json();
  this.accessToken = data.access_token;
  this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

  return this.accessToken;
}
```

**Read Operation**:

```typescript
async function read(sheetName: string): Promise<any[][]> {
  // Try localStorage first
  const storageKey = `${this.storageKey}_${sheetName}`;
  const stored = localStorage.getItem(storageKey);
  if (stored) {
    console.log(`Loaded ${sheetName} from localStorage`);
    return JSON.parse(stored);
  }

  // Fallback to Google Sheets
  if (!this.serviceAccountKey || !this.spreadsheetId) {
    console.warn('Google Sheets not configured');
    return [];
  }

  try {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sheets API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const values = data.values || [];

    // Cache to localStorage
    localStorage.setItem(storageKey, JSON.stringify(values));
    console.log(`Loaded ${sheetName} from Google Sheets`);

    return values;
  } catch (error) {
    console.error(`Failed to read ${sheetName}:`, error);
    return [];
  }
}
```

**Write Operation**:

```typescript
async function write(sheetName: string, values: any[][]): Promise<{success: boolean}> {
  // Always save to localStorage
  const storageKey = `${this.storageKey}_${sheetName}`;
  localStorage.setItem(storageKey, JSON.stringify(values));

  // Try to write to Google Sheets
  if (!this.serviceAccountKey || !this.spreadsheetId) {
    return { success: true };
  }

  try {
    const token = await this.getAccessToken();

    // Step 1: Clear sheet
    const clearUrl = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}:clear`;
    const clearResponse = await fetch(clearUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!clearResponse.ok) {
      throw new Error('Failed to clear sheet');
    }

    // Step 2: Write data
    const url = `${this.baseUrl}/${this.spreadsheetId}/values/${sheetName}?valueInputOption=RAW`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        range: sheetName,
        values: values
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Sheets API error: ${JSON.stringify(error)}`);
    }

    console.log(`Successfully wrote ${sheetName} to Google Sheets`);
    return { success: true };
  } catch (error) {
    console.error(`Error writing ${sheetName}:`, error);
    throw error;
  }
}
```

**Batch Operations**:

```typescript
async function loadAll(): Promise<{
  audiences: Audience[],
  topics: Topic[],
  messages: Message[]
}> {
  const [audiencesRaw, topicsRaw, messagesRaw] = await Promise.all([
    this.read('Audiences'),
    this.read('Topics'),
    this.read('Messages')
  ]);

  return {
    audiences: this.parseAudiences(audiencesRaw),
    topics: this.parseTopics(topicsRaw),
    messages: this.parseMessages(messagesRaw)
  };
}

async function saveAll(
  audiences: Audience[],
  topics: Topic[],
  messages: Message[]
): Promise<void> {
  const audienceRows = [
    ['ID', 'Name', 'Order', 'Status', 'Strategy', /* ... */],
    ...audiences.map(a => [a.id, a.name, a.order, /* ... */])
  ];

  const topicRows = [
    ['ID', 'Name', 'Key', 'Order', 'Status', /* ... */],
    ...topics.map(t => [t.id, t.name, t.key, /* ... */])
  ];

  const messageRows = [
    ['ID', 'Name', 'Number', 'Variant', 'Audience_Key', /* ... */],
    ...messages
      .filter(m => m.status !== 'deleted')
      .map(m => [m.id, m.name, m.number, /* ... */])
  ];

  await Promise.all([
    this.write('Audiences', audienceRows),
    this.write('Topics', topicRows),
    this.write('Messages', messageRows)
  ]);
}
```

**Parsers**:

```typescript
function parseAudiences(rows: any[][]): Audience[] {
  if (!rows || rows.length < 2) return [];

  return rows.slice(1).map((row, idx) => ({
    id: parseInt(row[0]) || idx + 1,
    name: row[1] || '',
    order: parseInt(row[2]) || idx + 1,
    status: row[3] || '',
    strategy: row[4] || '',
    buying_platform: row[5] || '',
    data_source: row[6] || '',
    targeting_type: row[7] || '',
    device: row[8] || '',
    tag: row[9] || '',
    key: row[10] || `aud${idx + 1}`,
    comment: row[11] || '',
    campaign_name: row[12] || '',
    campaign_id: row[13] || '',
    lineitem_name: row[14] || '',
    lineitem_id: row[15] || ''
  }));
}

function parseTopics(rows: any[][]): Topic[] {
  if (!rows || rows.length < 2) return [];

  return rows.slice(1).map((row, idx) => ({
    id: parseInt(row[0]) || idx + 1,
    name: row[1] || '',
    key: row[2] || `top${idx + 1}`,
    order: parseInt(row[3]) || idx + 1,
    status: row[4] || '',
    tag1: row[5] || '',
    tag2: row[6] || '',
    tag3: row[7] || '',
    tag4: row[8] || '',
    created: row[9] || '',
    comment: row[10] || ''
  }));
}

function parseMessages(rows: any[][]): Message[] {
  if (!rows || rows.length < 2) return [];

  return rows.slice(1)
    .filter(row => {
      const hasId = row[0] || row[1];
      const hasAudience = row[4];
      const hasTopic = row[5];
      return hasId && hasAudience && hasTopic;
    })
    .map(row => ({
      id: parseInt(row[0]) || null,
      name: row[1] || '',
      number: parseInt(row[2]) || 1,
      variant: row[3] || 'a',
      audience: row[4],
      topic: row[5],
      version: parseInt(row[6]) || 1,
      pmmid: row[7] || '',
      status: row[8] || '',
      start_date: row[9] || '',
      end_date: row[10] || '',
      template: row[11] || '',
      template_variant_classes: row[12] || '',
      headline: row[13] || '',
      copy1: row[14] || '',
      copy2: row[15] || '',
      image1: row[16] || '',
      image2: row[17] || '',
      image3: row[18] || '',
      image4: row[19] || '',
      image5: row[20] || '',
      image6: row[21] || '',
      flash: row[22] || '',
      cta: row[23] || '',
      landingUrl: row[24] || '',
      comment: row[25] || ''
    }));
}
```

### 4.2 settings.js - Settings Service

**Purpose**: Persistent settings storage in localStorage.

**Storage Key**: `messagingmatrix_settings`

**Schema**:
```typescript
interface Settings {
  spreadsheetId: string;
  serviceAccountKey: string;
  imageBaseUrls: {
    image1: string;
    image2: string;
    image3: string;
    image4: string;
    image5: string;
    image6: string;
  };
  lastUpdated: string;  // ISO 8601
}
```

**Implementation**:

```typescript
class SettingsService {
  constructor() {
    this.storageKey = 'messagingmatrix_settings';
    this.settings = this.load();
  }

  load(): Settings {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }

    // Default settings
    return {
      spreadsheetId: import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || '',
      serviceAccountKey: import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '',
      imageBaseUrls: {
        image1: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/',
        image2: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/',
        image3: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/',
        image4: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/',
        image5: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/background/',
        image6: 'https://s3.eu-central-1.amazonaws.com/pomscloud-storage/assets/43/hu-HU/sticker/'
      },
      lastUpdated: null
    };
  }

  save(settings: Settings): boolean {
    try {
      this.settings = {
        ...settings,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  get(key: string): any {
    return this.settings[key];
  }

  set(key: string, value: any): void {
    this.settings[key] = value;
    this.save(this.settings);
  }

  getSpreadsheetId(): string {
    return this.settings.spreadsheetId || import.meta.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID || '';
  }

  getServiceAccountKey(): string {
    return this.settings.serviceAccountKey || import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_KEY || '';
  }

  getImageBaseUrls(): Record<string, string> {
    return this.settings.imageBaseUrls || { /* defaults */ };
  }

  setImageBaseUrls(urls: Record<string, string>): void {
    this.set('imageBaseUrls', urls);
  }

  reset(): void {
    localStorage.removeItem(this.storageKey);
    this.settings = this.load();
  }

  getAll(): Settings {
    return { ...this.settings };
  }
}

export default new SettingsService();
```

---

## 5. API Integration

### 5.1 Claude API Proxy (server.js)

**Purpose**: Proxy Claude API requests to avoid CORS and protect API key.

**Endpoint**: `POST /api/claude/stream`

**Request**:
```typescript
interface ClaudeRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  system?: string;
  max_tokens?: number;
  temperature?: number;
}
```

**Response**: Server-Sent Events (SSE) stream

**Implementation**:

```javascript
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

app.post('/api/claude/stream', async (req, res) => {
  try {
    const { messages, system, max_tokens = 4096, temperature = 1.0 } = req.body;

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream response
    const stream = await anthropic.messages.stream({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens,
      temperature,
      system,
      messages
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        res.write(`data: ${JSON.stringify({
          type: 'content',
          content: chunk.delta.text
        })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Claude proxy server running on port ${PORT}`);
});
```

### 5.2 ClaudeChat Component

**Purpose**: AI-powered message creation and editing interface.

**Props**:
```typescript
interface ClaudeChatProps {
  audiences: Audience[];
  topics: Topic[];
  onCreateMessage: (topic: string, audience: string) => void;
  selectedCell?: { topic: string, audience: string };
  currentMessage?: Message;
}
```

**State**:
```typescript
interface ClaudeChatState {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  input: string;
  isStreaming: boolean;
  error: string | null;
}
```

**Key Functions**:

```typescript
async function sendMessage(userMessage: string): Promise<void> {
  // Add user message
  const newMessages = [
    ...messages,
    { role: 'user', content: userMessage }
  ];
  setMessages(newMessages);
  setInput('');
  setIsStreaming(true);

  try {
    // Build system prompt with context
    const systemPrompt = buildSystemPrompt({
      audiences,
      topics,
      selectedCell,
      currentMessage
    });

    // Call proxy endpoint
    const response = await fetch('http://localhost:3001/api/claude/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: newMessages,
        system: systemPrompt,
        max_tokens: 4096,
        temperature: 1.0
      })
    });

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let assistantMessage = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content') {
              assistantMessage += parsed.content;

              // Update UI in real-time
              setMessages([
                ...newMessages,
                { role: 'assistant', content: assistantMessage }
              ]);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (error) {
    setError(error.message);
  } finally {
    setIsStreaming(false);
  }
}

function buildSystemPrompt(context): string {
  let prompt = `You are a helpful assistant for creating marketing messages.

Available audiences:
${context.audiences.map(a => `- ${a.key}: ${a.name} (${a.strategy}, ${a.targeting_type})`).join('\n')}

Available topics:
${context.topics.map(t => `- ${t.key}: ${t.name}`).join('\n')}
`;

  if (context.selectedCell) {
    prompt += `\nCurrently focused on: ${context.selectedCell.audience} × ${context.selectedCell.topic}`;
  }

  if (context.currentMessage) {
    prompt += `\nCurrent message:
Headline: ${context.currentMessage.headline}
Copy: ${context.currentMessage.copy1}
Status: ${context.currentMessage.status}`;
  }

  return prompt;
}
```

**Quick Actions**:

```typescript
const quickActions = [
  {
    label: 'Create New Message',
    action: () => sendMessage('Create a new message for the selected cell')
  },
  {
    label: 'Improve Headline',
    action: () => sendMessage('Suggest improvements for the current headline')
  },
  {
    label: 'Generate Variants',
    action: () => sendMessage('Create 3 variants of this message')
  },
  {
    label: 'Optimize for CTR',
    action: () => sendMessage('Optimize this message for click-through rate')
  }
];
```

---

## 6. UI/UX Specifications

### 6.1 Color Palette

**Primary Colors**:
```css
--purple-600: #7c3aed;  /* Root node */
--purple-700: #6d28d9;  /* Root border */
--red-600: #dc2626;     /* Strategy nodes */
--red-100: #fee2e2;     /* Strategy background */
--orange-600: #ea580c;  /* Targeting type nodes */
--orange-100: #ffedd5;  /* Targeting type background */
--blue-600: #2563eb;    /* Audience nodes */
--blue-100: #dbeafe;    /* Audience background */
--green-600: #059669;   /* Topic nodes */
--green-100: #d1fae5;   /* Topic background */
```

**Status Colors**:
```css
--green-500: #10b981;   /* LIVE, RUNNING */
--orange-500: #f59e0b;  /* PAUSED */
--blue-500: #3b82f6;    /* PLANNED */
--gray-500: #6b7280;    /* DRAFT */
```

**Neutral Colors**:
```css
--gray-50: #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

### 6.2 Typography

**Font Family**:
```css
font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
```

**Font Sizes**:
```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
```

**Font Weights**:
```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 6.3 Spacing

**Scale**:
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;    /* 48px */
```

### 6.4 Layout Dimensions

**Matrix View**:
```css
--cell-width: 200px;
--cell-height: 120px;
--header-height: 60px;
--sidebar-width: 400px;
```

**Tree View**:
```css
--node-width: 140px;
--node-height: 40px;
--message-card-width: 120px;
--message-card-height: 70px;
--connector-stroke: 2px;
```

### 6.5 Interaction States

**Buttons**:
```css
/* Default */
.button {
  background: var(--gray-200);
  color: var(--gray-700);
  transition: all 0.2s;
}

/* Hover */
.button:hover {
  background: var(--gray-300);
}

/* Active */
.button:active {
  background: var(--gray-400);
}

/* Disabled */
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Input Fields**:
```css
.input {
  border: 1px solid var(--gray-300);
  padding: 0.5rem;
  border-radius: 0.375rem;
}

.input:focus {
  outline: none;
  border-color: var(--blue-500);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}
```

### 6.6 Animations

**Transitions**:
```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--transition-slow: 300ms ease;
```

**Hover Effects**:
```css
.hover-lift {
  transition: transform var(--transition-base);
}

.hover-lift:hover {
  transform: translateY(-2px);
}
```

**Loading Spinner**:
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

---

## 7. Testing Specifications

### 7.1 Unit Tests

**Test Framework**: Vitest (recommended) or Jest

**Coverage Targets**:
- useMatrix hook: 80%+
- sheets.js service: 70%+
- settings.js service: 90%+

**Example Tests**:

```typescript
describe('useMatrix', () => {
  test('should add message with correct numbering', () => {
    const { result } = renderHook(() => useMatrix());

    act(() => {
      result.current.addMessage('top1', 'aud1');
    });

    const messages = result.current.getMessages('top1', 'aud1');
    expect(messages).toHaveLength(1);
    expect(messages[0].number).toBe(1);
    expect(messages[0].variant).toBe('a');
  });

  test('should increment variant in occupied cell', () => {
    const { result } = renderHook(() => useMatrix());

    // Add first message
    act(() => {
      result.current.addMessage('top1', 'aud1');
    });

    // Add second message in same cell
    act(() => {
      result.current.addMessage('top1', 'aud1');
    });

    const messages = result.current.getMessages('top1', 'aud1');
    expect(messages).toHaveLength(2);
    expect(messages[0].variant).toBe('a');
    expect(messages[1].variant).toBe('b');
    expect(messages[0].number).toBe(messages[1].number);
  });

  test('should soft delete messages', () => {
    const { result } = renderHook(() => useMatrix());

    act(() => {
      result.current.addMessage('top1', 'aud1');
    });

    const message = result.current.getMessages('top1', 'aud1')[0];

    act(() => {
      result.current.deleteMessage(message.id);
    });

    // Should not appear in getMessages
    expect(result.current.getMessages('top1', 'aud1')).toHaveLength(0);

    // Should still exist in messages array
    expect(result.current.messages.find(m => m.id === message.id)).toBeTruthy();
  });
});

describe('sheets service', () => {
  test('should parse audiences correctly', () => {
    const rows = [
      ['ID', 'Name', 'Order', 'Status', 'Strategy', /* ... */],
      [1, 'Test Audience', 1, 'ACTIVE', 'Prospecting', /* ... */]
    ];

    const audiences = sheets.parseAudiences(rows);
    expect(audiences).toHaveLength(1);
    expect(audiences[0].name).toBe('Test Audience');
    expect(audiences[0].strategy).toBe('Prospecting');
  });

  test('should handle localStorage fallback', async () => {
    localStorage.setItem('messagingmatrix_data_Audiences', JSON.stringify([
      ['ID', 'Name'],
      [1, 'Cached Audience']
    ]));

    const data = await sheets.read('Audiences');
    expect(data[1][1]).toBe('Cached Audience');
  });
});
```

### 7.2 Integration Tests

**Test Scenarios**:
1. Complete message lifecycle (create → edit → move → delete)
2. Google Sheets sync (mock API)
3. Tree view rendering with real data
4. Filter application across views

### 7.3 E2E Tests

**Test Framework**: Playwright or Cypress

**Critical Paths**:
1. User creates new message in matrix
2. User edits message inline
3. User duplicates message to another audience
4. User switches to tree view
5. User drags nodes in tree view
6. User saves data to Google Sheets

---

## 8. Deployment Specifications

### 8.1 Build Configuration

**Vite Config** (`vite.config.js`):
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'icons': ['lucide-react']
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

### 8.2 Environment Variables

**Development** (`.env.development`):
```
VITE_GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
VITE_GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
ANTHROPIC_API_KEY=sk-ant-...
```

**Production** (`.env.production`):
```
VITE_GOOGLE_SHEETS_SPREADSHEET_ID=production_spreadsheet_id
VITE_GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
ANTHROPIC_API_KEY=sk-ant-...
```

### 8.3 Production Build

**Commands**:
```bash
# Build frontend
npm run build

# Start proxy server
npm run server

# Or run both with concurrently
npm run dev:all
```

**Output**:
```
dist/
  ├── index.html
  ├── assets/
  │   ├── index-[hash].js
  │   ├── index-[hash].css
  │   └── [vendor chunks]
  └── [static assets]
```

### 8.4 Hosting Recommendations

**Frontend**:
- Vercel (recommended)
- Netlify
- AWS S3 + CloudFront
- GitHub Pages

**Backend (Claude Proxy)**:
- Vercel Serverless Functions
- AWS Lambda
- Heroku
- Railway

### 8.5 Performance Targets

**Load Time**:
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.0s
- Lighthouse Score: > 90

**Bundle Size**:
- Main bundle: < 500KB (gzipped)
- Vendor chunks: < 200KB each

**Runtime**:
- Matrix render: < 100ms (100 messages)
- Tree render: < 200ms (100 nodes)
- Save operation: < 2s

---

## 9. Security Specifications

### 9.1 API Key Protection

**Backend Only**:
- ANTHROPIC_API_KEY stored on server
- Never exposed to frontend
- Proxy all Claude requests

**Service Account**:
- Private key encrypted in transit
- Stored in localStorage (encrypted browser storage)
- Never logged to console in production

### 9.2 Input Validation

**Messages**:
- Sanitize HTML in user inputs
- Limit string lengths (headline: 100 chars, copy: 500 chars)
- Validate URLs before storage

**Google Sheets**:
- Validate spreadsheet ID format
- Verify service account JSON structure
- Handle malformed data gracefully

### 9.3 CORS Configuration

**Server** (`server.js`):
```javascript
const cors = require('cors');

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}));
```

### 9.4 Content Security Policy

**Headers**:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https://s3.eu-central-1.amazonaws.com data:;
  connect-src 'self' https://sheets.googleapis.com https://oauth2.googleapis.com http://localhost:3001;
```

---

## 10. Maintenance & Operations

### 10.1 Monitoring

**Metrics**:
- API response times
- Error rates (frontend/backend)
- Google Sheets sync failures
- localStorage usage

**Logging**:
```javascript
// Development: verbose
console.log('Loaded from localStorage');

// Production: errors only
if (import.meta.env.PROD) {
  console.error('Failed to sync:', error);
}
```

### 10.2 Backup Strategy

**localStorage**:
- Export function: `sheets.saveAll()`
- Manual download as JSON
- Periodic auto-backup to Google Sheets

**Google Sheets**:
- Native Google Drive version history
- Manual spreadsheet duplication

### 10.3 Error Handling

**User-Facing Errors**:
```typescript
interface ErrorState {
  type: 'sync' | 'api' | 'validation';
  message: string;
  recoverable: boolean;
  action?: () => void;
}

// Example
setError({
  type: 'sync',
  message: 'Failed to sync with Google Sheets. Changes saved locally.',
  recoverable: true,
  action: () => retry()
});
```

**Error Boundaries**:
```typescript
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

### 10.4 Version Migration

**Schema Migrations**:
```typescript
function migrateData(version: number, data: any): any {
  if (version < 2) {
    // Add new fields
    data.messages = data.messages.map(m => ({
      ...m,
      template_variant_classes: ''
    }));
  }

  if (version < 3) {
    // Rename fields
    data.audiences = data.audiences.map(a => ({
      ...a,
      targeting_type: a.targetingType
    }));
  }

  return data;
}
```

---

## 11. Future Enhancements

### 11.1 Roadmap

**Phase 2**:
- Real-time collaboration (WebSocket)
- Undo/redo functionality
- Keyboard shortcuts
- Export to CSV/JSON
- Import from external sources

**Phase 3**:
- Template library
- A/B test tracking
- Analytics dashboard
- Mobile responsive UI
- Offline mode with sync

**Phase 4**:
- Multi-language support
- Permission system (read/write roles)
- Audit log
- Advanced filtering/search
- Custom fields

### 11.2 Extensibility

**Plugin System** (Conceptual):
```typescript
interface Plugin {
  name: string;
  version: string;
  onMessageCreate?: (message: Message) => void;
  onMessageUpdate?: (message: Message, updates: Partial<Message>) => void;
  customFields?: Field[];
  customViews?: React.Component[];
}

// Example plugin
const analyticsPlugin: Plugin = {
  name: 'analytics',
  version: '1.0.0',
  onMessageCreate: (message) => {
    trackEvent('message_created', { id: message.id });
  }
};
```

### 11.3 API Development

**REST API** (Future):
```
GET    /api/audiences
POST   /api/audiences
PUT    /api/audiences/:id
DELETE /api/audiences/:id

GET    /api/topics
POST   /api/topics
PUT    /api/topics/:id
DELETE /api/topics/:id

GET    /api/messages
GET    /api/messages?audience=aud1&topic=top1
POST   /api/messages
PUT    /api/messages/:id
DELETE /api/messages/:id
```

---

## Appendices

### A. Glossary

- **Audience**: Target segment for messaging
- **Topic**: Message theme or category
- **Message**: Marketing content unit
- **Cell**: Intersection of audience (row) and topic (column)
- **Variant**: Alternative version of same message (a, b, c...)
- **Version**: Iteration of message/variant (1, 2, 3...)
- **PMMID**: Platform Message Master ID (composite key)
- **Soft Delete**: Marking deleted without removing from database

### B. References

- React Documentation: https://react.dev
- Google Sheets API: https://developers.google.com/sheets/api
- Anthropic Claude API: https://docs.anthropic.com/
- Tailwind CSS: https://tailwindcss.com
- Lucide Icons: https://lucide.dev

### C. Change Log

**v1.0.0** (2025-10-10):
- Initial implementation
- Matrix and Tree views
- Google Sheets sync
- Claude AI integration
- localStorage persistence

---

**Document End**
