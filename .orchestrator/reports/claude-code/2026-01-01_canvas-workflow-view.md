# Canvas-Based Workflow View & Task Numbering
**Date:** 2026-01-01
**Branch:** `redesign`

---

## Summary

1. Added task numbering system (TC1, TC2, TC3...)
2. Rebuilt TasksWorkflowView as SVG canvas-based n8n-style editor
3. Added bezier curve arrows connecting nodes
4. Implemented expand/collapse and click-to-edit interactivity

---

## 1. Task Numbering System

### Database Changes

**Field Added:** `task_number INTEGER`

| File | Changes |
|------|---------|
| `db/schema.js` | Added `task_number` field to tasks table |
| `db/index.js` | Added column to CREATE TABLE + migration ALTER |
| `server.js` | Generate task_number on task creation |

### Task Number Generation

```javascript
// server.js - POST /api/tasks/create
const maxResult = sqlite.prepare('SELECT MAX(task_number) as maxNum FROM tasks').get();
const taskNumber = (maxResult?.maxNum || 0) + 1;
```

### Display Format

- Tasks display as: `TC1`, `TC2`, `TC3`, etc.
- "TC" = Task Code

### Migration Script

**File:** `scripts/migrateTaskNumbers.js`

```
Migration Results:
  TC1: SZK napszakos kreatívok...
  TC2: Erste Félreteszek kampány...
  ...
  TC15: Q1 longterm kampányok...

  15 tasks assigned task numbers.
```

---

## 2. Canvas-Based TasksWorkflowView

### Architecture

- **Technology:** SVG-based (not HTML5 Canvas)
- **Layout:** Horizontal flow with vertical dead bucket branch
- **Styling:** n8n-inspired visual design

### Visual Structure

```
[INCOMING]──►[NAMING]──►[CONTENT]──►[PREVIEW]──►[APPROVED]──►[DELIVERED]
     │
     └──►[DEAD]
```

### Node Layout (n8n style)

```
┌──────────────────────┐
│ ● INCOMING        3  │  ← Colored header with status dot + count
├──────────────────────┤
│ TC1 Task title...    │  ← Task number + truncated title
│ TC3 Another task...  │
│ TC7 Third task...    │
│     +3 more          │  ← Overflow indicator
└──────────────────────┘
        ○              ← Connection ports
```

### Key Dimensions

```javascript
const NODE_WIDTH = 200;
const NODE_HEADER_HEIGHT = 50;
const NODE_TASK_HEIGHT = 28;
const NODE_GAP_X = 100;
const NODE_GAP_Y = 80;
```

---

## 3. Bezier Curve Connections

### Implementation

```javascript
const generateBezierPath = (from, to, isVertical = false) => {
  if (isVertical) {
    // Vertical connection (for dead bucket)
    return `M ${startX} ${startY} C ${startX} ${startY + offset},
            ${endX} ${endY - offset}, ${endX} ${endY}`;
  } else {
    // Horizontal connection
    return `M ${startX} ${startY} C ${startX + offset} ${startY},
            ${endX - offset} ${endY}, ${endX} ${endY}`;
  }
};
```

### Arrow Markers

```xml
<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
  <polygon points="0 0, 10 3.5, 0 7" fill="var(--white-40)" />
</marker>
```

---

## 4. Interactivity

### Node Expand/Collapse

- Click header to toggle task list visibility
- State tracked in `expandedNodes` useState
- Dynamic height recalculation

### Click Task to Edit

```jsx
onClick={(e) => {
  e.stopPropagation();
  onTaskClick?.(task);
}}
```

### Canvas Panning

- Drag background to pan
- State: `pan { x, y }`, `isPanning`
- Cursor changes: `grab` ↔ `grabbing`

```javascript
const handleMouseMove = (e) => {
  if (isPanning) {
    setPan({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y
    });
  }
};
```

---

## 5. Visual Features

### Node Styling

- Rounded rectangles (12px radius)
- Drop shadow (4px offset)
- Colored header from Settings statusColors
- Border matches header color

### Connection Ports

- Small circles (6px radius) on node edges
- Matching border color
- Right side for outgoing, left for incoming
- Top port for dead bucket

### Background Grid

```jsx
<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
  <path d="M 20 0 L 0 0 0 20" stroke="var(--white-05)" strokeWidth="0.5" />
</pattern>
```

### Colors from Settings

```javascript
const colorMap = {
  incoming: statusColors.INCOMING || '#8B5CF6',
  naming: statusColors.NAMING || '#EAB308',
  content: statusColors.CONTENT || '#F97316',
  preview: statusColors.PREVIEW || '#3B82F6',
  approved: statusColors.APPROVED || '#22C55E',
  delivered: statusColors.ACTIVE || '#15803D',
  dead: statusColors.INACTIVE || '#9CA3AF'
};
```

---

## Files Changed

| File | Changes |
|------|---------|
| `db/schema.js` | Added task_number field |
| `db/index.js` | Added task_number column + migration |
| `server.js` | Task number generation on create + save |
| `src/components/TasksWorkflowView.jsx` | Complete rewrite - SVG canvas-based |
| `scripts/migrateTaskNumbers.js` | **NEW** - Migration script for existing tasks |

---

## Testing Checklist

### Task Numbering
- [ ] New tasks get auto-incremented task_number
- [ ] Task numbers display as TC1, TC2, etc.
- [ ] Existing tasks have task_numbers after migration

### Workflow View
- [ ] All buckets render as nodes
- [ ] Bezier arrows connect nodes correctly
- [ ] Dead bucket branches below with vertical arrow
- [ ] Task counts accurate in badges

### Interactivity
- [ ] Click header expands/collapses task list
- [ ] Click task opens TaskEditorDialog
- [ ] Drag background pans canvas
- [ ] Cursor changes during pan

### Visual
- [ ] Grid background visible
- [ ] Node shadows render
- [ ] Colors match Settings
- [ ] Connection ports visible
- [ ] Legend displays at bottom
