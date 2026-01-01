# Email Integration & Task-MC Linking Analysis
**Date:** 2024-12-30
**Branch:** `workflow-update`

---

## 1. Email Integration - FULLY IMPLEMENTED

### Email Fetching
**Location:** `services/emailService.js`

```javascript
// Fetches emails via IMAP (Gmail, etc.)
fetchEmails(limit, unseenOnly, emailConfig)

// Returns:
{
  uid,           // Email UID (unique identifier)
  from,          // Sender email
  fromName,      // Sender name
  to,            // Recipients
  subject,       // Subject line
  date,          // Date received
  messageId,     // Message ID
  body,          // Extracted text body
  seen           // Read status
}
```

### Email → Task Conversion
**Location:** `server.js:1557-1693`

**Endpoint:** `POST /api/emails/convert-to-tasks`

**Flow:**
1. Frontend sends array of emails
2. Claude AI analyzes emails, extracts tasks
3. Returns structured tasks with:
   - `title` - Brief task title
   - `description` - 2-3 sentence summary
   - `context` - Full conversation thread (markdown)
   - `priority` - High/Medium/Low
   - `dueDate` - Extracted deadline
   - `source` - Email subject
   - `from` - Sender
   - `emailUid` - Original email UID
   - `emailBody` - Full email body (preserved)
   - `emailSubject` - Original subject
   - `emailDate` - Original date

### Frontend Usage
**Location:** `src/components/Tasks.jsx:79-122`

```javascript
// Fetch emails button triggers:
handleFetchAndConvert()
  → apiGet('/api/emails')
  → claudeChatRef.current.processEmailsToTasks(emails, callback)
  → setTasks(prev => [...newTasks, ...prev])
  → markEmailsAsProcessed(emailUids)
```

### Processed Emails Tracking
**Location:** `server.js:1994-2010`, `db/schema.js:206-212`

```javascript
// Tracks which emails have been converted to avoid duplicates
processedEmails table: { uid, email_from, subject, processed_at, tasks_created }
```

---

## 2. Task-to-MC Relationship - PARTIALLY IMPLEMENTED

### relatedContent Field
**Location:** `db/schema.js:176`, `TaskEditorDialog.jsx:452-514`

**Current Implementation:**
- Tasks have `relatedContent` field (JSON array)
- TaskEditorDialog has "Related Content" tab
- User can manually type "MC number" or "filename"
- Stores as simple references: `{ id, reference, type: 'creative' }`

**Limitations:**
- NO actual lookup against messages/creatives
- NO autocomplete/search against real data
- NO bidirectional link (MC doesn't know about task)
- Just stores text reference, no validation

### Can a Task Link to a Message?
**Current:** NO real linking
- User types "MC1a" but system doesn't validate
- No foreign key relationship
- No API to resolve reference to actual message

### Can We Create MC from Task?
**Current:** NO
- No "Convert to MC" button
- No API endpoint for task → message conversion
- No automatic creation flow

---

## 3. What's Missing

### Phase 1: Task → MC Creation
| Missing | Description |
|---------|-------------|
| "Create MC" button | In TaskEditorDialog, convert task to message |
| Message creation API | Take task data, create message in matrix |
| Field mapping | Map task.title → MC.name, task.description → MC.copy1 |
| Audience/Topic selection | UI to pick where to create MC |
| Link back | Store task.id in message or message.id in task |

### Phase 2: Bidirectional Linking
| Missing | Description |
|---------|-------------|
| Message lookup | Search messages when adding relatedContent |
| Autocomplete | Show matching MCs as user types |
| Validation | Verify MC exists before linking |
| Reverse lookup | Show which tasks reference a message |
| Visual indicator | Badge on MC card showing linked tasks |

### Phase 3: Workflow Integration
| Missing | Description |
|---------|-------------|
| Task workflowType | ✅ DONE - Added 'creative' type |
| Creative tasks view | Filter tasks by workflowType='creative' |
| Status sync | When MC status changes, update linked task |
| Kanban for tasks | Show creative tasks in Kanban by bucket |

---

## 4. Recommended Next Steps

### Quick Win (1 hour)
Add "Create MC from Task" button:
1. Button in TaskEditorDialog footer
2. Opens dialog to select Audience + Topic
3. Creates message with task data pre-filled
4. Links task to new message via relatedContent

### Medium Effort (2-3 hours)
Real MC search in relatedContent:
1. API endpoint: `GET /api/messages/search?q=MC1`
2. Autocomplete dropdown in TaskEditorDialog
3. Store actual message.id not just text reference

### Full Integration (4-6 hours)
1. Reverse lookup: show tasks on message card
2. Status sync between task and MC
3. Dedicated "Creative Workflow" view showing linked task+MC pairs

---

## 5. Data Flow Summary

```
Current Flow:
Email (IMAP) → Claude AI → Task (SQLite) → Manual text reference → Nothing

Desired Flow:
Email (IMAP) → Claude AI → Task (SQLite) → Create MC button → Message (Sheets)
                                        ↓
                              relatedContent[{messageId}]
                                        ↓
                              MC shows linked task badge
```

---

## Files Reference

| File | Purpose |
|------|---------|
| `services/emailService.js` | IMAP email fetching |
| `server.js:1540-1693` | Email API endpoints |
| `server.js:1736-1970` | Task CRUD APIs |
| `db/schema.js:160-181` | Task table schema |
| `src/components/Tasks.jsx` | Task list UI |
| `src/components/TaskEditorDialog.jsx` | Task editor with relatedContent |
