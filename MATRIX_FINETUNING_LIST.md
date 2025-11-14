# Matrix Finetuning List

## Priority Features to Implement

### 1. Multi-Select Mode with Long Press
**Status**: Pending
**Priority**: High

**Features**:
- Enter select mode with long press on a message card
- Allow selecting multiple message cards
- Visual indication of selected cards (highlight/checkmark)
- Exit select mode with ESC or clicking outside

### 2. Batch Drag & Drop for Selected Cards
**Status**: Pending
**Priority**: High

**Features**:
- Drag multiple selected cards to a new audience (same topic/row constraint)
- Show count badge on drag preview (e.g., "3 cards")
- Support both MOVE and COPY operations (CTRL modifier)
- Maintain same topic constraint during batch operations

### 3. Visual Feedback During Drag
**Status**: Pending
**Priority**: High

**Features**:
- Highlight cell area where cards will drop when hovering
- Show green highlight for valid drop zone
- Show red highlight or "no drop" cursor for invalid drop zone (different topic)
- Clear visual distinction between source and target cells

### 4. Hide UI Elements During Drag
**Status**: Pending
**Priority**: Medium

**Features**:
- Hide "Add Message" buttons during drag operation
- Similar to current behavior during space+pan mode
- Reduce visual clutter during drag
- Restore buttons after drop completes

---

## Technical Implementation Notes

### Files to Modify:
- `src/components/Matrix.jsx` - Main logic for select mode
- `src/components/MatrixGridView.jsx` - Visual feedback and drag UI

### State Management:
```javascript
// New state needed:
- selectedMessages: Set<messageId>
- isSelectMode: boolean
- longPressTimer: timeout reference
- isDraggingSelected: boolean
- dragHoverCell: { topic, audience } | null
```

### Event Handlers:
- `onMouseDown` / `onTouchStart` - Start long press timer
- `onMouseUp` / `onTouchEnd` - Clear timer or toggle selection
- `onDragStart` - Handle multi-card drag
- `onDragOver` - Update hover cell highlight
- `onDrop` - Batch move/copy operations

---

## Future Enhancements (Low Priority)

- [ ] Keyboard shortcuts (Shift+Click for range select)
- [ ] Select all in cell/row/column
- [ ] Bulk edit selected messages
- [ ] Delete multiple selected messages

---

**Last Updated**: 2025-01-14
**Assigned To**: TBD
