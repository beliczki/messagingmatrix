# Create MC from Task - Implementation Report
**Date:** 2024-12-30
**Branch:** `workflow-update`

---

## Summary

Added "Create MC" button to TaskEditorDialog that allows converting creative workflow tasks into Matrix messages (MCs).

---

## Files Changed

### 1. `src/components/Tasks.jsx`

**Changes:**
- Added `matrixData` prop to component signature
- Passed `matrixData` to TaskEditorDialog

```jsx
// Before
const Tasks = ({ onMenuToggle, currentModuleName, lookAndFeel }) => {

// After
const Tasks = ({ onMenuToggle, currentModuleName, lookAndFeel, matrixData }) => {
```

### 2. `src/components/TaskEditorDialog.jsx`

**New Props:**
- `matrixData` - Contains audiences, topics, messages, addMessage function

**New State:**
```jsx
const [showCreateMcModal, setShowCreateMcModal] = useState(false);
const [selectedProduct, setSelectedProduct] = useState('');
const [selectedAudience, setSelectedAudience] = useState('');
const [selectedTopic, setSelectedTopic] = useState('');
const [createMcStatus, setCreateMcStatus] = useState(null);
const [createdMcInfo, setCreatedMcInfo] = useState(null);
```

**New Features:**
1. **Create MC Button** (footer) - Only visible when:
   - `workflowType === 'creative'`
   - `addMessage` function available

2. **Create MC Modal** with:
   - Product dropdown (if multiple products)
   - Audience dropdown (filtered by product)
   - Topic dropdown (filtered by product)
   - Info box showing what will be created
   - Success state with green checkmark

3. **handleCreateMc Function**:
   - Calculates next message ID
   - Calls `addMessage(topicKey, audienceKey)`
   - Updates task.relatedContent with link to new MC
   - Shows success message with PMMID

---

## UI Flow

```
1. User opens task with workflowType='creative'
2. Sees "Create MC" button (purple) in footer
3. Clicks → Opens modal
4. Selects Audience + Topic (filtered by product)
5. Clicks "Create MC"
6. Success screen shows "MC Created: MC{number}"
7. Modal auto-closes after 2 seconds
8. Task now has relatedContent entry linking to MC
```

---

## Button Visibility

| workflowType | matrixData | Button Visible |
|--------------|------------|----------------|
| 'creative'   | Available  | ✅ Yes |
| 'creative'   | Missing    | ❌ No |
| 'general'    | Available  | ❌ No |
| 'general'    | Missing    | ❌ No |

---

## relatedContent Entry Created

```javascript
{
  id: Date.now(),
  reference: 'MC{number}',
  type: 'message',
  messageId: '{number}'
}
```

---

## Limitations

1. **No pre-fill of message fields** - The addMessage function creates default values; we'd need updateMessage to set Name, Copy1 from task data
2. **No task status update** - Task stays in current status after MC creation
3. **Single product assumption** - If no products, all audiences/topics shown

---

## Future Enhancements

1. Pre-fill message Name with task.title
2. Pre-fill message Copy1 with task.description
3. Pre-fill message Comment with task.from
4. Auto-complete task when MC created
5. Navigate to Matrix after creation (optional)

---

## Testing

1. Create task with `workflowType: 'creative'`
2. Open task editor
3. Verify "Create MC" button visible
4. Click → Select audience/topic
5. Click "Create MC"
6. Verify success message
7. Verify relatedContent updated
8. Check Matrix for new message
