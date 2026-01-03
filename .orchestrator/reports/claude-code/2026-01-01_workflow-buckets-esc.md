# Workflow Buckets & ESC Key Implementation
**Date:** 2026-01-01
**Branch:** `workflow-update`

---

## Summary

Renamed task buckets to match workflow stages and added ESC key handling to all dialogs.

---

## 1. Task Buckets Renamed

### Old → New Mapping

| Old ID | New ID | Name | Color | Description |
|--------|--------|------|-------|-------------|
| backlog | incoming | INCOMING | #8B5CF6 (Purple) | New requests from email |
| planning | naming | NAMING | #EAB308 (Yellow) | Assigning topic & audience |
| production | content | CONTENT | #F97316 (Orange) | Creating content (AI/Human) |
| review | preview | PREVIEW | #3B82F6 (Blue) | Ready for client review |
| *(new)* | approved | APPROVED | #22C55E (Green) | Approved, ready to deliver |
| *(new)* | delivered | DELIVERED | #15803D (Dark Green) | Live/deployed |
| dead | dead | DEAD | #9CA3AF (Gray) | Discontinued tasks |

### Files Updated

| File | Changes |
|------|---------|
| `src/components/Tasks.jsx` | Updated buckets array, getBucketHeaderStyle uses Settings colors |
| `src/components/TaskEditorDialog.jsx` | Default bucket → 'incoming' |
| `src/components/PreviewView.jsx` | Default bucket → 'incoming' |
| `server.js` | Default bucket → 'incoming' (2 places) |

### Dynamic Colors from Settings

Bucket header colors now pull from `lookAndFeel.statusColors`:

```javascript
const getBucketHeaderStyle = (bucketId) => {
  const statusColors = lookAndFeel?.statusColors || {};
  const colorMap = {
    incoming: statusColors.INCOMING || '#8B5CF6',
    naming: statusColors.NAMING || '#EAB308',
    content: statusColors.CONTENT || '#F97316',
    preview: statusColors.PREVIEW || '#3B82F6',
    approved: statusColors.APPROVED || '#22C55E',
    delivered: statusColors.ACTIVE || '#15803D',
    dead: statusColors.INACTIVE || '#9CA3AF'
  };
  return { backgroundColor: colorMap[bucketId] };
};
```

---

## 2. Database Migration

### Script Created
`scripts/migrateBuckets.js`

### Migration Results
```
Before migration:
  backlog: 3 tasks
  planning: 1 tasks
  production: 1 tasks
  review: 10 tasks

After migration:
  incoming: 3 tasks
  naming: 1 tasks
  content: 1 tasks
  preview: 10 tasks

✅ 15 tasks migrated
```

---

## 3. ESC Key Closes All Dialogs

Added `useEffect` with keydown listener to all dialog components:

```javascript
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && isOpen) {
      onClose();
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [isOpen, onClose]);
```

### Dialogs Updated

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
| CreativeLibraryUploadDialogs | `setShowUploadDialog(false)` / `handleCancelUploads()` |
| KeywordEditor | `onClose()` |

---

## 4. Files Changed Summary

| File | Changes |
|------|---------|
| `src/components/Tasks.jsx` | Buckets array, dynamic colors |
| `src/components/TaskEditorDialog.jsx` | Default bucket, ESC handler |
| `src/components/MessageEditorDialog.jsx` | ESC handler |
| `src/components/AudienceEditorDialog.jsx` | ESC handler, useEffect import |
| `src/components/TopicEditorDialog.jsx` | ESC handler |
| `src/components/OrphanedMessagesDialog.jsx` | ESC handler, useEffect import |
| `src/components/StateManagementDialog.jsx` | ESC handler, useEffect import |
| `src/components/MatrixStatePanel.jsx` | ESC handler |
| `src/components/CreativePreview.jsx` | ESC handler |
| `src/components/CreativeShare.jsx` | ESC handler, useEffect import |
| `src/components/CreativeLibraryUploadDialogs.jsx` | ESC handler, useEffect import |
| `src/components/KeywordEditor.jsx` | ESC handler |
| `src/components/PreviewView.jsx` | Default bucket |
| `server.js` | Default bucket (2 places) |
| `scripts/migrateBuckets.js` | New migration script |

---

## Testing Checklist

### Buckets
- [ ] Tasks appear in correct buckets after migration
- [ ] New tasks default to INCOMING bucket
- [ ] Bucket colors match Settings status colors
- [ ] All 7 buckets visible and scrollable

### ESC Key
- [ ] TaskEditorDialog closes on ESC
- [ ] MessageEditorDialog closes on ESC
- [ ] AudienceEditorDialog closes on ESC
- [ ] TopicEditorDialog closes on ESC
- [ ] MatrixStatePanel closes on ESC
- [ ] CreativePreview closes on ESC
- [ ] CreativeShare closes on ESC
- [ ] Upload dialogs close on ESC
- [ ] KeywordEditor closes on ESC
