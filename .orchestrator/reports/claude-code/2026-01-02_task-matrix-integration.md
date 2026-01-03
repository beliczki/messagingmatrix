# Task-Matrix Bi-directional Integration
**Date:** 2026-01-02
**Branch:** `redesign`

---

## Summary

Implemented bi-directional integration between Tasks and Matrix modules:
1. **Task → Matrix:** "Create MC" button creates message and opens editor
2. **Matrix → Task:** New "Task" tab in MC Editor shows related tasks

---

## Feature 1: Create MC from Task

### TaskEditorDialog Changes

#### Labels Added
| Location | Label |
|----------|-------|
| Line 1941 | "Audience" above dropdown |
| Line 1981 | "Topic" above dropdown |

#### Auto Pre-selection (lines 132-157)
When Task Type = "Create" and Product is selected:
- Finds audience containing "INCOMING" in name/key
- Finds topic containing "WIP" in name/key
- Only sets if values not already populated

```javascript
useEffect(() => {
  if (editingTask?.taskType === 'creation' && editingTask.product) {
    const incomingAudience = productAudiences.find(a =>
      a.name?.toUpperCase().includes('INCOMING')
    );
    const wipTopic = productTopics.find(t =>
      t.name?.toUpperCase().includes('WIP')
    );
    // Set defaults...
  }
}, [editingTask?.taskType, editingTask?.product, audiences, topics]);
```

---

## Feature 2: Matrix URL Action Handler

### URL Format
```
/matrix?action=add_message&audience=KEY&topic=KEY&product=PRODUCT
```

### Implementation (Matrix.jsx lines 246-291)

#### Step 1: Parse URL Parameters
```javascript
const params = new URLSearchParams(location.search);
const action = params.get('action');
const audienceKey = params.get('audience');
const topicKey = params.get('topic');
const product = params.get('product');
```

#### Step 2: Set Filters
```javascript
// Product filter
if (product) {
  setProductFilters([product]);
}

// Status filter (so new INCOMING message is visible)
if (!statusFilters.includes('INCOMING')) {
  setStatusFilters([...statusFilters, 'INCOMING']);
}
```

#### Step 3: Create Message
```javascript
pendingOpenMessageIdRef.current = maxId + 1;
addMessage(topicKey, audienceKey);
navigate('/matrix', { replace: true });
```

#### Step 4: Open Editor (separate useEffect)
```javascript
useEffect(() => {
  if (pendingOpenMessageIdRef.current && matrixData?.messages) {
    const newMessage = matrixData.messages.find(m =>
      parseInt(m.id) === pendingOpenMessageIdRef.current
    );
    if (newMessage) {
      pendingOpenMessageIdRef.current = null;
      setEditingMessage(newMessage);
    }
  }
}, [matrixData?.messages]);
```

---

## Feature 3: Task Tab in Message Editor

### New Tab Configuration (line 1092)
```javascript
{ id: 'task', label: 'Task', icon: ClipboardList, color: 'cyan' }
```

### New Icons Added (line 3)
```javascript
import { ..., ClipboardList, Calendar, ExternalLink } from 'lucide-react';
```

### Tasks Fetch Logic (lines 64-98)
```javascript
useEffect(() => {
  const fetchRelatedTasks = async () => {
    const response = await apiGet('/api/tasks');
    const allTasks = data.tasks || [];

    // Find tasks referencing this message
    const related = allTasks.filter(task => {
      const inRelated = (task.relatedContent || [])
        .some(item => item.messageId === messageId);
      const inOutput = (task.outputContent || [])
        .some(item => item.messageId === messageId);
      return inRelated || inOutput;
    });

    setRelatedTasks(related);
  };
  fetchRelatedTasks();
}, [editingMessage?.id]);
```

### Tab Content (lines 2438-2548)

#### Empty State
- ClipboardList icon (48px, 50% opacity)
- "No tasks linked to this message"

#### Task Card
| Element | Display |
|---------|---------|
| ID | "Task #{id}" (12px, white-40) |
| Title | Bold 16px white |
| Description | 13px, truncated 200 chars |
| Open Link | ExternalLink icon → `/tasks?task={id}` |

#### Meta Row
| Badge | Condition |
|-------|-----------|
| Status dot | Color based on bucket |
| Due date | If task.dueDate set |
| Link type | "Source MC" or "Output MC" |

### Status Colors
| Bucket | Color |
|--------|-------|
| done | #22c55e (green) |
| in_progress | #3b82f6 (blue) |
| blocked | #ef4444 (red) |
| other | #9ca3af (gray) |

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        TASK EDITOR                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Task Type: [Create ▼]                                       ││
│  │ Product:   [LTP ▼]                                          ││
│  │                                                             ││
│  │ ─── Create New Messages ───                                 ││
│  │ Audience: [LTP_INCOMING ▼]  ← Auto-selected                 ││
│  │ Topic:    [LTP____wip ▼]    ← Auto-selected                 ││
│  │                                                             ││
│  │ [Create MC] ─────────────────────────────────────────┐      ││
│  └─────────────────────────────────────────────────────│──────┘│
└───────────────────────────────────────────────────────│────────┘
                                                        │
                                                        ▼
                    /matrix?action=add_message
                    &audience=LTP_INCOMING
                    &topic=LTP____wip
                    &product=LTP
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                          MATRIX                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Products: [LTP]  Status: [INCOMING ✓]                     │  │
│  │                                                           │  │
│  │         INCOMING    Undefined                             │  │
│  │   WIP   [286a] ←── New message created                    │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 MESSAGE EDITOR                             │  │
│  │  [Naming] [Content] [Generate] [Styles] [Traffic] [Task]  │  │
│  │                                                    ↑       │  │
│  │                                              NEW TAB       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | Lines | Changes |
|------|-------|---------|
| `src/components/TaskEditorDialog.jsx` | 1941, 1981, 132-157 | Labels, auto-select |
| `src/components/Matrix.jsx` | 246-291 | URL action handler |
| `src/components/MessageEditorDialog.jsx` | 3, 64-98, 1092, 2438-2548 | Task tab |

---

## Testing Checklist

### Create MC from Task
- [ ] Task Type "Create" enables Create New Messages section
- [ ] Selecting product auto-fills Audience (INCOMING)
- [ ] Selecting product auto-fills Topic (WIP)
- [ ] Click "Create MC" opens Matrix in new tab
- [ ] Matrix shows correct product filter
- [ ] New message appears in correct cell
- [ ] Message Editor opens automatically

### Task Tab in Message Editor
- [ ] Task tab appears in tab bar
- [ ] Tab shows empty state when no tasks linked
- [ ] Related tasks display correctly
- [ ] Task ID, title, description shown
- [ ] Status dot color matches bucket
- [ ] Due date displays if set
- [ ] "Source MC" / "Output MC" badge correct
- [ ] "Open" link navigates to task

---

## Dependencies

- Tasks API: `GET /api/tasks` returns all tasks
- Task structure: `relatedContent[]` and `outputContent[]` arrays with `messageId` field
- Matrix: `addMessage(topic, audience)` function
- Matrix view state: `productFilters`, `statusFilters`
