# Tasks Workflow View & UI Improvements
**Date:** 2026-01-01
**Branch:** `workflow-update`

---

## Summary

1. Renamed task buckets to match workflow stages
2. Migrated existing tasks to new bucket IDs
3. Added dynamic bucket colors from Settings
4. Colored bucket dropdown in TaskEditorDialog
5. Added ESC key handling to all dialogs
6. Replaced old workflow view with node-based visualization

---

## 1. Task Buckets Renamed

### Mapping

| Old ID | New ID | Name | Description |
|--------|--------|------|-------------|
| backlog | incoming | INCOMING | New requests from email |
| planning | naming | NAMING | Assigning topic & audience |
| production | content | CONTENT | Creating content (AI/Human) |
| review | preview | PREVIEW | Ready for client review |
| *(new)* | approved | APPROVED | Approved, ready to deliver |
| *(new)* | delivered | DELIVERED | Live/deployed |
| dead | dead | DEAD | Discontinued tasks |

### Files Updated
- `src/components/Tasks.jsx` - buckets array, getBucketHeaderStyle
- `src/components/TaskEditorDialog.jsx` - default bucket
- `src/components/PreviewView.jsx` - default bucket
- `server.js` - default bucket (2 places)

---

## 2. Database Migration

**Script:** `scripts/migrateBuckets.js`

```
Migration Results:
  backlog → incoming: 3 tasks
  planning → naming: 1 task
  production → content: 1 task
  review → preview: 10 tasks
  Total: 15 tasks migrated
```

---

## 3. Dynamic Bucket Colors

Bucket colors now come from `lookAndFeel.statusColors`:

```javascript
const colorMap = {
  incoming: statusColors.INCOMING || '#8B5CF6',  // Purple
  naming: statusColors.NAMING || '#EAB308',      // Yellow
  content: statusColors.CONTENT || '#F97316',    // Orange
  preview: statusColors.PREVIEW || '#3B82F6',    // Blue
  approved: statusColors.APPROVED || '#22C55E',  // Green
  delivered: statusColors.ACTIVE || '#15803D',   // Dark Green
  dead: statusColors.INACTIVE || '#9CA3AF'       // Gray
};
```

---

## 4. Colored Bucket Dropdown

**File:** `TaskEditorDialog.jsx`

- Added `lookAndFeel` prop
- Select element background matches current bucket color
- Each dropdown option has its bucket color
- Contrasting text color based on luminance

```jsx
<select
  style={{
    backgroundColor: currentBucketColor,
    borderColor: currentBucketColor,
    color: getTextColor(currentBucketColor),
    fontWeight: 600
  }}
>
  {buckets.map(bucket => (
    <option style={{
      backgroundColor: getBucketColor(bucket.id),
      color: getTextColor(bucketColor)
    }}>
      {bucket.name}
    </option>
  ))}
</select>
```

---

## 5. ESC Key Closes All Dialogs

Added `useEffect` keydown listener to 11 dialog components:

| Component | Close Action |
|-----------|--------------|
| TaskEditorDialog | `setEditingTask(null)` |
| MessageEditorDialog | `handleClose()` |
| AudienceEditorDialog | `setEditingAudience(null)` |
| TopicEditorDialog | `setEditingTopic(null)` |
| OrphanedMessagesDialog | `onClose()` |
| StateManagementDialog | `setShowStateDialog(false)` |
| MatrixStatePanel | `handleClose()` |
| CreativePreview | `onClose()` |
| CreativeShare | `onClose()` |
| CreativeLibraryUploadDialogs | `setShowUploadDialog(false)` |
| KeywordEditor | `onClose()` |

---

## 6. New Node-Based Workflow View

### Old View (Removed)
- Showed **messages** grouped by status
- Kanban-style columns
- Used WORKFLOW_STATUSES for message workflow

### New View (TasksWorkflowView.jsx)
- Shows **tasks** grouped by bucket
- Node-based flowchart (n8n style)
- Connected with arrows

### Visual Layout

```
[INCOMING] → [NAMING] → [CONTENT] → [PREVIEW] → [APPROVED] → [DELIVERED]
     ↓
  [DEAD]
```

### Node Structure
```
┌─────────────────────┐
│ BUCKET NAME    [5]  │  ← Header with count
│ Description text    │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │ Task title...   │ │  ← Mini task cards
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │ Task title...   │ │
│ └─────────────────┘ │
│     +3 more         │  ← Overflow indicator
└─────────────────────┘
```

### Features
- Click task to open editor
- Colors from Settings statusColors
- Legend showing all stages
- Scrollable task list per node
- Custom scrollbar styling

### Code Removed from Tasks.jsx
- `WORKFLOW_STATUSES` array
- `LEGACY_STATUS_MAP`
- `normalizeStatus()`, `getStatusColor()`, `getTextColor()`
- `getAudienceName()`, `getTopicName()`
- `messagesByStatus` memo
- `WorkflowMessageCard` component
- Message drag handlers (`draggedMessage`, `handleMessageDrag*`)

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/Tasks.jsx` | Buckets, import TasksWorkflowView, remove old workflow code |
| `src/components/TasksWorkflowView.jsx` | **NEW** - Node-based workflow visualization |
| `src/components/TaskEditorDialog.jsx` | lookAndFeel prop, colored bucket dropdown, ESC handler |
| `src/components/MessageEditorDialog.jsx` | ESC handler |
| `src/components/AudienceEditorDialog.jsx` | ESC handler |
| `src/components/TopicEditorDialog.jsx` | ESC handler |
| `src/components/OrphanedMessagesDialog.jsx` | ESC handler |
| `src/components/StateManagementDialog.jsx` | ESC handler |
| `src/components/MatrixStatePanel.jsx` | ESC handler |
| `src/components/CreativePreview.jsx` | ESC handler |
| `src/components/CreativeShare.jsx` | ESC handler |
| `src/components/CreativeLibraryUploadDialogs.jsx` | ESC handler |
| `src/components/KeywordEditor.jsx` | ESC handler |
| `src/components/PreviewView.jsx` | Default bucket |
| `server.js` | Default bucket |
| `scripts/migrateBuckets.js` | **NEW** - Migration script |

---

## Testing Checklist

### Buckets
- [ ] Tasks appear in correct buckets after migration
- [ ] New tasks default to INCOMING
- [ ] Bucket colors match Settings
- [ ] All 7 buckets visible in Kanban view

### Bucket Dropdown
- [ ] Dropdown shows current bucket color
- [ ] Each option has its bucket color
- [ ] Colors update when Settings change

### ESC Key
- [ ] All dialogs close on ESC press
- [ ] No interference with text input fields

### Workflow View
- [ ] Toggle between Kanban and Workflow views
- [ ] All buckets shown as connected nodes
- [ ] DEAD bucket branched below
- [ ] Task counts accurate
- [ ] Click task opens editor
- [ ] Legend displays correctly
