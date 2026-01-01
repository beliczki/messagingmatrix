# AI-Assisted MC Matching - Implementation Report
**Date:** 2024-12-30
**Branch:** `workflow-update`

---

## Summary

Enhanced email → task conversion to:
1. Detect if task is "creation" (new MC) or "modification" (update existing)
2. Extract searchable keywords from email
3. Auto-search for matching MCs when modification detected
4. Display suggested MCs in TaskEditorDialog with one-click linking

---

## Changes

### 1. Enhanced Claude Prompt
**File:** `server.js:1578-1649`

Added new fields to extraction:

```json
{
  "taskType": "creation|modification",
  "keywords": ["keyword1", "keyword2", ...]
}
```

**Detection rules:**
- `creation` = New creative content request
- `modification` = Update/change/fix existing content
- Looks for keywords: "update", "change", "modify", "fix", "új", "módosítás", "javítás"

### 2. Message Search Endpoint
**File:** `server.js:1539-1630`

**Endpoint:** `GET /api/messages/search?q=keywords&limit=5`

**Search fields (weighted):**
- `name`, `pmmid` (weight: 3)
- `audienceName`, `topicName` (weight: 2)
- `copy1`, `comment` (weight: 1)

**Response:**
```json
{
  "messages": [
    {
      "id": "45",
      "pmmid": "MC_045",
      "name": "Személyi kölcsön",
      "audience": "PRO 25-35",
      "topic": "Loan Products",
      "status": "ACTIVE",
      "matchScore": 0.85,
      "matchedFields": ["name", "audienceName"]
    }
  ]
}
```

### 3. Task Enhancement
**File:** `server.js:1787-1879`

After Claude returns tasks:
1. For `modification` tasks with keywords:
2. Search all messages against keywords
3. Score and rank matches
4. Add top 5 as `suggestedMCs`
5. Auto-set `workflowType: 'creative'`

### 4. TaskEditorDialog UI
**File:** `TaskEditorDialog.jsx:429-512`

**New sections:**
- **Suggested MCs box** (purple) showing AI-matched MCs
- **Task Type badge** (green=creation, orange=modification)
- **Keywords display** showing extracted terms
- **Link button** to add MC to relatedContent

---

## Data Flow

```
Email
  ↓
POST /api/emails/convert-to-tasks
  ↓
Claude analyzes:
  - Extracts taskType (creation/modification)
  - Extracts keywords (product, campaign, topic)
  ↓
If modification:
  - Search messages with keywords
  - Score matches
  - Return top 5 as suggestedMCs
  ↓
Task saved with:
  - taskType
  - keywords[]
  - suggestedMCs[]
  - workflowType: 'creative'
  ↓
TaskEditorDialog displays:
  - Suggested MCs (click to link)
  - Task Type badge
  - Keywords list
```

---

## Example Response

```json
{
  "tasks": [{
    "id": "task-1735567200000-0",
    "title": "Személyi kölcsön banner frissítése",
    "description": "A meglévő személyi kölcsön banner kamatláb módosítása szükséges.",
    "taskType": "modification",
    "keywords": ["személyi kölcsön", "kamatláb", "banner"],
    "workflowType": "creative",
    "suggestedMCs": [
      {
        "id": "45",
        "pmmid": "MC_045",
        "name": "Személyi kölcsön PRO",
        "audience": "PRO 25-35",
        "topic": "Loan Products",
        "matchScore": 0.85,
        "matchedFields": ["name", "topicName"]
      }
    ]
  }]
}
```

---

## UI Preview

```
┌─────────────────────────────────────────────────────┐
│ 🔮 AI Suggested MCs (3)      [Modification Request] │
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ MC_045  [85% match]                    [+ Link] │ │
│ │ Személyi kölcsön PRO                            │ │
│ │ PRO 25-35 / Loan Products                       │ │
│ └─────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────┐ │
│ │ MC_046  [72% match]                    [+ Link] │ │
│ │ Személyi kölcsön REM                            │ │
│ │ REM 35-45 / Loan Products                       │ │
│ └─────────────────────────────────────────────────┘ │
│─────────────────────────────────────────────────────│
│ Keywords: személyi kölcsön, kamatláb, banner        │
└─────────────────────────────────────────────────────┘

Task Type: [Modification]  (orange badge)
```

---

## Testing

1. Send test email mentioning existing product/topic
2. Fetch emails → Convert to tasks
3. Open task in editor
4. Verify:
   - `taskType` is `creation` or `modification`
   - `keywords` extracted correctly
   - `suggestedMCs` populated for modifications
   - Click "Link" adds to relatedContent
   - Task Type badge displays correctly
