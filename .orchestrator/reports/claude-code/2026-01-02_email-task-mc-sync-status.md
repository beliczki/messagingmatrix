# Status Report: Email → Task Processing and Task ↔ MC Sync
**Date:** 2026-01-02
**Branch:** `redesign`

---

## 1. EMAIL → TASK: SPLIT BY PRODUCT

### Current Status: ✅ IMPLEMENTED

### Location
- `server.js` lines 1673-1678 (prompt)

### Implementation
```javascript
// From Claude prompt:
"## CRITICAL: SPLIT BY PRODUCT
If an email mentions MULTIPLE PRODUCTS, create a SEPARATE TASK for each product.

Example: "Update rates for SZK and HK campaigns"
→ Creates 2 tasks: one for SZK, one for HK"
```

### Product Codes Defined
| Code | Meaning |
|------|---------|
| HK | Lakáshitel (Home Loan) |
| SZK | Személyi Kölcsön (Personal Loan) |
| SZA | Számlavezetés (Account Management) |
| HITEL | General Loans |
| MARKET | Marketplace/General |
| BIZTOS | Biztosítás (Insurance) |
| MEGTAKARITAS | Savings Products |
| KARTYA | Cards |
| GENERAL | If product unclear |

### What's Working
- ✅ Claude prompt instructs to split by product
- ✅ Product codes are defined in prompt
- ✅ Each task gets a `product` field

### What's Missing
- ⚠️ No verification that Claude actually splits (relies on AI behavior)
- ⚠️ No post-processing to validate/enforce product split

---

## 2. EMAIL → TASK: DETECT MODIFY VS CREATE

### Current Status: ✅ IMPLEMENTED

### Location
- `server.js` lines 1690-1692 (prompt)
- `server.js` lines 1705, 1742 (field definition)

### Implementation
```javascript
// From Claude prompt:
"## TASK TYPE DETECTION:
- "creation" = NEW creative (keywords: új, new, create, készíts, kampány indítás)
- "modification" = UPDATE existing (keywords: módosítás, update, change, fix, javítás, rate change, copy change)"

// JSON field:
"taskType": "creation|modification"
```

### What's Working
- ✅ Claude prompt defines detection keywords (Hungarian + English)
- ✅ `taskType` field is returned: `"creation"` or `"modification"`
- ✅ `workflowType` set to `"creative"` when taskType is creation/modification (line 1811)
- ✅ UI displays task type in TaskEditorDialog

### What's Missing
- ⚠️ No fallback if AI returns neither value
- ⚠️ TaskEditorDialog doesn't enforce taskType validation

---

## 3. EMAIL → TASK: SUGGEST RELATED MC

### Current Status: ✅ IMPLEMENTED

### Location
- `server.js` lines 1707-1714 (prompt)
- `server.js` lines 1821-1892 (MC search logic)
- `TaskEditorDialog.jsx` lines 990-1086 (UI display)

### Implementation

#### A. AI Extraction (Prompt)
```javascript
"**suggestedRelatedMC** (for modification tasks only):
- Extract any MC name, PMMID, or creative reference mentioned
- Examples: "MC123", "PMMID-456", "Lakáshitel_REMAlt_2024"
- If none mentioned, set to null"
```

#### B. Server-Side MC Search (lines 1821-1892)
```javascript
if (task.taskType === 'modification' && matrixData && enhancedTask.keywords.length > 0) {
  // Score each message against keywords
  const searchableFields = {
    name, pmmid, copy1, comment,
    audienceName, topicName
  };

  // Weight scoring: name/pmmid=3, audience/topic=2, other=1
  // Return top 5 matches with matchScore (0-1)
  enhancedTask.suggestedMCs = results.map(r => ({
    id, pmmid, name, audience, topic, status,
    matchScore, matchedFields
  }));
}
```

#### C. UI Display (TaskEditorDialog)
- Orange box shows `suggestedRelatedMC` (AI-extracted text)
- "Search" button prefills search with suggested MC name
- Card list shows `suggestedMCs` with match scores
- "Link" button adds MC to `relatedContent`

### What's Working
- ✅ AI extracts MC references from email text
- ✅ Server searches Matrix data for keyword matches
- ✅ Top 5 MCs returned with relevance scores
- ✅ UI displays suggestions with "Link" action
- ✅ Linking adds to task's `relatedContent`

### What's Missing
- ⚠️ Search only runs for `modification` tasks (not creation)
- ⚠️ No fuzzy matching for MC names
- ⚠️ No product filtering (could suggest MCs from wrong product)

---

## 4. TASK ↔ MC STATUS SYNC

### Current Status: ❌ NOT IMPLEMENTED

### Location
- `Tasks.jsx` line 138 (`moveTaskToBucket`)
- `MessageEditorDialog.jsx` (no task sync)

### Current Behavior

#### Task Bucket Change
```javascript
// Tasks.jsx line 138
const moveTaskToBucket = (taskId, newBucket) => {
  setTasks(prev =>
    prev.map(task =>
      task.id === taskId
        ? { ...task, bucket: newBucket }
        : task
    )
  );
};
// NO sync to linked MCs!
```

#### MC Status Change
```javascript
// MessageEditorDialog - status changes only update the message
// NO sync to linked tasks!
```

### What's Working
- ✅ Tasks have `bucket` field (incoming, naming, content, preview, approved, delivered, dead)
- ✅ MCs have `status` field (INCOMING, NAMING, CONTENT, PREVIEW, APPROVED, ACTIVE, etc.)
- ✅ Task-MC links stored in `relatedContent` and `outputContent`

### What's Missing
- ❌ **No sync from Task → MC**: Moving task to new bucket doesn't update linked MC status
- ❌ **No sync from MC → Task**: Changing MC status doesn't update linked task bucket
- ❌ **No mapping defined**: Bucket names ≠ MC status names (need mapping table)
- ❌ **No API endpoint** for sync operations

### Proposed Mapping
| Task Bucket | MC Status |
|-------------|-----------|
| incoming | INCOMING |
| naming | NAMING |
| content | CONTENT |
| preview | PREVIEW |
| approved | APPROVED |
| delivered | ACTIVE |
| dead | INACTIVE |

---

## Summary Table

| Feature | Status | Location | Missing |
|---------|--------|----------|---------|
| Split by Product | ✅ Implemented | server.js:1673 | Validation |
| Detect Modify/Create | ✅ Implemented | server.js:1690 | Fallback handling |
| Suggest Related MC | ✅ Implemented | server.js:1821 | Product filtering |
| Task → MC Sync | ❌ Missing | - | Full implementation |
| MC → Task Sync | ❌ Missing | - | Full implementation |

---

## Priority Recommendations

### High Priority
1. **Implement Task ↔ MC Status Sync**
   - Define bucket-to-status mapping
   - Add sync logic in `moveTaskToBucket`
   - Add sync logic in MC status update
   - Consider bidirectional vs. one-way sync

### Medium Priority
2. **Add Product Filter to MC Suggestions**
   - Filter `suggestedMCs` by task's product
   - Boost score for same-product matches

3. **Validate Task Type**
   - Add fallback if AI returns invalid taskType
   - Default to "creation" if unclear

### Low Priority
4. **Add MC Suggestion for Creation Tasks**
   - Search for similar MCs to use as templates
   - Show as "Reference MCs" instead of "Modify"
