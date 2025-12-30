# Workflow Analysis: Tasks System Review

**Date**: 2024-12-30
**Purpose**: Evaluate Tasks system for Creative Workflow extension

---

## Current Task Schema

| Field | Type | Notes |
|-------|------|-------|
| id | TEXT | Primary key |
| title | TEXT | Required |
| description | TEXT | Optional |
| priority | TEXT | High/Medium/Low |
| status | TEXT | pending/completed |
| bucket | TEXT | Kanban stage |
| labels | TEXT | JSON array (BUG: not in schema) |
| dueDate | TEXT | ISO date |
| from | TEXT | Creator/assignee |
| source | TEXT | Origin |
| context | TEXT | AI-extracted (readonly) |
| userNotes | TEXT | Editable notes |
| relatedContent | TEXT | JSON array of linked items |
| email_* | TEXT | Email integration fields |
| created_at | TEXT | Timestamp |

---

## Current Buckets

| ID | Name | Purpose |
|----|------|---------|
| backlog | Backlog | Ideas/requests |
| planning | Planning | Scoping/briefing |
| production | In Production | Active work |
| review | Review | Under review |
| dead | Dead | Discontinued |

---

## Current UI

- **Kanban board** (default) - 5 columns, drag-drop between buckets
- **List view** - Grouped by status, checkboxes
- **Editor modal** - 3 tabs: Summary, Context, Related Content
- **Related Content** - Can link to creatives (id, reference, type)

---

## API Endpoints

| Method | Endpoint | Function |
|--------|----------|----------|
| GET | /api/tasks | Fetch all |
| POST | /api/tasks | Bulk replace (destructive!) |
| POST | /api/tasks/create | Create single |
| PUT | /api/tasks/:id | Update single |
| DELETE | /api/tasks/:id | Delete single |

---

## Proposed Workflow Stages

```
Incoming → Naming → Content → Preview → Approve → Deliver
```

vs Current:
```
Backlog → Planning → Production → Review → Dead
```

---

## Recommendation

### Option A: Extend Tasks System (RECOMMENDED)

**Pros:**
- Existing Kanban UI with drag-drop
- relatedContent already links to creatives
- Labels system for categorization
- Email integration for incoming requests

**Required Changes:**
1. Add `workflow_type` field to distinguish:
   - `general` (current tasks)
   - `creative` (new workflow)
2. Different bucket sets per workflow_type
3. Add creative-specific fields or use relatedContent
4. Filter UI by workflow_type

**New Buckets for Creative Workflow:**
| ID | Name |
|----|------|
| incoming | Incoming Request |
| naming | Naming |
| content | Content Creation |
| preview | Preview |
| approve | Approval |
| deliver | Deliver |

### Option B: Separate Workflow Component

**Pros:**
- Clean separation
- Custom UI for creative preview
- No risk to existing Tasks

**Cons:**
- Duplicate code (Kanban, drag-drop, API)
- More maintenance
- relatedContent linking already solved in Tasks

---

## Key Questions for User

1. Should creative workflow tasks appear in main Tasks view or separate?
2. Need inline creative preview in workflow cards?
3. Who assigns tasks at each stage (manual vs auto)?
4. Integration with existing Creative Library selection?

---

## Linking to Creatives/Messages

**Already Exists:**
```javascript
relatedContent: [
  { id: "123", reference: "MC_171_a", type: "creative" }
]
```

**Enhancement Needed:**
- Add message linking: `type: "message"`
- Auto-populate from Creative Library selection
- Show thumbnails in workflow cards

---

## Status
[x] Analysis Complete
[ ] Awaiting Decision
