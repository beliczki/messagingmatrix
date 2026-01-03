# Workflow State Machine Viewer
**Date:** 2026-01-01
**Branch:** `redesign`

---

## Summary

Rebuilt TasksWorkflowView as an exact state machine visualization matching the specification.

---

## Node Types

### Action Nodes (Gray #6B7280)
- Automated processing steps
- No task chips shown

### Decision Nodes (Diamond #374151)
- Branching points in workflow
- Two output paths

### Bucket Nodes (Colored)
- Where tasks live
- Shows [TC#] chips for tasks
- Click chip → open TaskEditorDialog

---

## Complete Node List

| # | ID | Type | Label | Color | Connects To |
|---|-----|------|-------|-------|-------------|
| 1 | fetch_emails | action | Fetch Emails | Gray | ai_parse |
| 2 | ai_parse | action | AI Parse | Gray | branch_type |
| 3 | branch_type | decision | Type? | Dark Gray | new_task, modify_task |
| 4a | new_task | action | New MC | Light Blue | incoming |
| 4b | modify_task | action | Modify MC | Light Blue | incoming |
| 5 | incoming | bucket | INCOMING | Purple | naming, dead |
| 6 | naming | bucket | NAMING | Yellow | branch_template |
| 7 | branch_template | decision | Template? | Dark Gray | dynamic_content, static_content |
| 8a | dynamic_content | action | AI Generate | Light Orange | content |
| 8b | static_content | action | Human Create | Light Orange | content |
| 9 | content | bucket | CONTENT | Orange | preview |
| 10 | preview | bucket | PREVIEW | Blue | branch_approval |
| 11 | branch_approval | decision | Feedback? | Dark Gray | comments, ok |
| 11a | comments | action | Comments | Red | content (loopback) |
| 11b | ok | action | OK | Green | approved |
| 12 | approved | bucket | APPROVED | Green | delivered |
| 13 | delivered | bucket | DELIVERED | Dark Green | (end) |
| 14 | dead | bucket | DEAD | Gray | (end) |

---

## Visual Layout

```
Y=40:   [FETCH_EMAILS]
             │
Y=140:  [AI_PARSE]
             │
Y=240:  ◇BRANCH_TYPE◇
           /   \
         NEW   MODIFY
Y=350: [NEW_MC] [MODIFY_MC]
           \   /
Y=440:  [INCOMING] ────→ [DEAD]
             │
Y=520:  [NAMING]
             │
Y=600:  ◇BRANCH_TEMPLATE◇
           /   \
      DYNAMIC  STATIC
Y=690: [AI GEN] [HUMAN]
           \   /
Y=780:  [CONTENT] ←─────┐
             │          │
Y=860:  [PREVIEW]       │
             │          │
Y=940:  ◇BRANCH_APPROVAL◇
           /   \        │
      COMMENTS  OK      │
Y=1020: [COMMENTS]──────┘ [OK]
                           │
Y=1110:              [APPROVED]
                           │
Y=1190:              [DELIVERED]
```

---

## Connections

| From | To | Style | Label |
|------|----|-------|-------|
| fetch_emails | ai_parse | solid | - |
| ai_parse | branch_type | solid | - |
| branch_type | new_task | solid | NEW |
| branch_type | modify_task | solid | MODIFY |
| new_task | incoming | solid | - |
| modify_task | incoming | solid | - |
| incoming | dead | dashed | - |
| incoming | naming | solid | - |
| naming | branch_template | solid | - |
| branch_template | dynamic_content | solid | DYNAMIC |
| branch_template | static_content | solid | STATIC |
| dynamic_content | content | solid | - |
| static_content | content | solid | - |
| content | preview | solid | - |
| preview | branch_approval | solid | - |
| branch_approval | comments | solid | COMMENTS |
| branch_approval | ok | solid | OK |
| comments | content | dashed | (loopback) |
| ok | approved | solid | - |
| approved | delivered | solid | - |

---

## Bucket Colors

| Bucket | Color | Hex |
|--------|-------|-----|
| INCOMING | Purple | #8B5CF6 |
| NAMING | Yellow | #EAB308 |
| CONTENT | Orange | #F97316 |
| PREVIEW | Blue | #3B82F6 |
| APPROVED | Green | #22C55E |
| DELIVERED | Dark Green | #15803D |
| DEAD | Gray | #9CA3AF |

---

## Task Chips

- Format: `[TC1]` `[TC2]` `[TC3]`
- 2 chips per row in bucket nodes
- Click chip → opens TaskEditorDialog
- Semi-transparent white background

---

## Interactivity

- **Pan:** Drag background to pan canvas
- **Click Task:** Opens TaskEditorDialog
- **No drag-to-reposition:** Static node positions

---

## Files Changed

| File | Changes |
|------|---------|
| `src/components/TasksWorkflowView.jsx` | Complete rewrite - state machine visualization |
| `src/components/Tasks.jsx` | Reverted buckets to naming/content |
| `src/components/TaskEditorDialog.jsx` | Reverted bucket colors |
| `scripts/migrateBucketsRevert.js` | **NEW** - Revert migration |

---

## Testing Checklist

### Nodes
- [ ] All 14 nodes render correctly
- [ ] Action nodes (gray rectangles)
- [ ] Decision nodes (diamonds)
- [ ] Bucket nodes (colored with chips)

### Connections
- [ ] Bezier arrows between all nodes
- [ ] Dashed line INCOMING → DEAD
- [ ] Loopback from COMMENTS → CONTENT
- [ ] Branch labels (NEW, MODIFY, etc.)

### Task Chips
- [ ] Tasks appear in correct bucket nodes
- [ ] Click chip opens TaskEditorDialog
- [ ] Task numbers display as TC#

### Interactivity
- [ ] Pan canvas by dragging
- [ ] Cursor changes during pan
