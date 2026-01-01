# Task Workflow Type Implementation Report
**Date:** 2024-12-30
**Branch:** `workflow-update`
**Author:** Claude Code

---

## Summary

Added `workflow_type` field to tasks to distinguish between general tasks and creative workflow requests. This enables the upcoming Workflow Dashboard to show only creative workflow tasks while keeping the Tasks module focused on general tasks.

---

## 1. Database Schema

### File: `db/schema.js`

Added new column to tasks table:

```javascript
workflow_type: text('workflow_type').default('general'), // 'general', 'creative'
```

**Location:** Line 170

**Migration Note:** SQLite will auto-add the column with default value 'general' for existing rows when the app restarts. No manual migration required.

---

## 2. Server API Updates

### File: `server.js`

#### GET /api/tasks (Lines 1736-1786)
- Added optional query parameter: `?workflow_type=general|creative|all`
- Default behavior (no param or `all`): returns all tasks
- Response includes `workflowType` field for each task

```javascript
// Example API calls:
GET /api/tasks                     // All tasks
GET /api/tasks?workflow_type=general    // General tasks only
GET /api/tasks?workflow_type=creative   // Creative workflow tasks only
```

#### POST /api/tasks (Bulk Replace - Lines 1788-1847)
- Added `workflow_type` to INSERT statement
- Maps `task.workflowType` → `workflow_type` column
- Default: 'general'

#### POST /api/tasks/create (Single Task - Lines 1853-1895)
- Added `workflow_type` to INSERT statement
- Accepts `workflowType` in request body
- Default: 'general'

#### PUT /api/tasks/:id (Update Task - Lines 1900-1965)
- Added support for updating `workflowType` field
- Maps to `workflow_type` column in database

---

## 3. Frontend Changes

### File: `src/components/Tasks.jsx`

#### State Addition (Line 18)
```javascript
const [workflowTypeFilter, setWorkflowTypeFilter] = useState('all');
```

#### Filter Logic (Lines 221-226)
```javascript
// Filter by workflow type first
if (workflowTypeFilter !== 'all') {
  const taskType = task.workflowType || 'general';
  if (taskType !== workflowTypeFilter) return false;
}
```

#### UI Filter Dropdown (Lines 291-310)
- Added dropdown selector at top of content area
- Options: "All Tasks", "General", "Creative Workflow"
- Shows count of filtered tasks when filter active

### File: `src/components/TaskEditorDialog.jsx`

#### Workflow Type Selector (Lines 346-359)
- Added to Summary tab in 3-column grid with Priority and Bucket
- Dropdown with options: "General", "Creative Workflow"
- Uses Palette icon for visual distinction

---

## 4. Files Changed

| File | Lines Changed | Description |
|------|--------------|-------------|
| `db/schema.js` | +1 | Added `workflow_type` column |
| `server.js` | +25 | Updated all task APIs |
| `src/components/Tasks.jsx` | +25 | Added filter state, logic, and UI |
| `src/components/TaskEditorDialog.jsx` | +15 | Added workflow type selector |

**Total Lines Added:** ~66

---

## 5. Usage

### Creating a Creative Workflow Task

**Via API:**
```javascript
POST /api/tasks/create
{
  "title": "New banner design request",
  "description": "Need 300x250 and 728x90 variants",
  "workflowType": "creative",
  "priority": "High"
}
```

**Via UI:**
1. Open task editor dialog
2. Set "Workflow Type" dropdown to "Creative Workflow"
3. Save task

### Filtering Tasks

**Via API:**
```javascript
GET /api/tasks?workflow_type=creative
```

**Via UI:**
1. Use "Type" dropdown at top of Tasks view
2. Select "Creative Workflow" to see only creative tasks

---

## 6. Future Integration Points

The Workflow Dashboard can use:
```javascript
// Fetch only creative workflow tasks
const response = await apiGet('/api/tasks?workflow_type=creative');
const creativeTasks = response.tasks;
```

Tasks marked as `creative` can be:
- Displayed in the Workflow Dashboard
- Converted to messages with status workflow
- Tracked through creative production stages

---

## 7. Testing Checklist

- [ ] Create new task - verify workflowType defaults to 'general'
- [ ] Edit task - change workflowType to 'creative'
- [ ] Filter by 'general' - verify creative tasks hidden
- [ ] Filter by 'creative' - verify general tasks hidden
- [ ] Filter by 'all' - verify all tasks shown
- [ ] API: GET /api/tasks?workflow_type=creative returns correct subset
- [ ] Server restart - verify existing tasks get 'general' as default

---

## 8. Known Limitations

1. **No Migration Script**: Relies on SQLite's ALTER TABLE auto-behavior
2. **No Validation**: API accepts any workflow_type string (should be enum)
3. **No Workflow Dashboard Yet**: This is prep work for Part 2

---

## Next Steps (Part 2)

1. Create WorkflowDashboard.jsx component
2. Display creative tasks in Kanban board
3. Add task-to-message conversion
4. Integrate with message status workflow
