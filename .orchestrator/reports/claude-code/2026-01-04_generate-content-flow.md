# Generate Content Button - End-to-End Flow Analysis

**Date:** 2026-01-04
**Author:** Claude Code
**Component:** MessageEditorDialog / AIAssistant

---

## Executive Summary

The "Generate Content" feature allows users to auto-generate marketing copy (headline, copy1, copy2, flash, CTA) using Claude AI. The flow spans three components: MessageEditorDialog (UI), Matrix (orchestration), and AIAssistant (AI integration).

---

## 1. Trigger Point

### Location
- **File:** `src/components/MessageEditorDialog.jsx:2372`
- **Tab:** Generate tab in MC Editor dialog

### Code
```jsx
<button onClick={handleGenerateContent} disabled={isGeneratingContent}>
  <Sparkles size={16} /> Generate Content
</button>
```

### Component Hierarchy
```
Matrix.jsx
├── defines handleGenerateContent()
├── owns claudeChatRef (ref to AIAssistant)
└── passes handleGenerateContent as prop
    ↓
MessageEditorDialog.jsx
├── receives handleGenerateContent prop
└── renders Generate button that calls it
    ↓
AIAssistant.jsx
├── exposes generateMessageContent via useImperativeHandle
└── handles API communication with Claude
```

---

## 2. Context Gathering

### Data Structure Passed to AI

**Location:** `Matrix.jsx:1361-1388`

```javascript
const contextData = {
  audience: {
    name: string,           // "Young Professionals"
    comment: string,        // Audience notes
    strategy: string,       // "Retargeting"
    buying_platform: string,// "DV360"
    data_source: string,    // "1st Party"
    targeting_type: string, // "Interest-based"
    device: string,         // "Mobile"
    tag: string             // Custom tag
  },
  topic: {
    name: string,           // "Summer Sale"
    comment: string,        // Topic notes
    tag1: string,           // Category tags
    tag2: string,
    tag3: string,
    tag4: string
  },
  currentMessage: {
    name: string,           // Message name
    headline: string,       // Current headline (if any)
    copy1: string,          // Current copy1
    copy2: string,          // Current copy2
    flash: string,          // Current flash text
    cta: string             // Current CTA
  }
};
```

### What's Included

| Data Type | Included | Notes |
|-----------|----------|-------|
| Audience metadata | ✅ | Full audience object fields |
| Topic metadata | ✅ | Full topic object fields |
| Current message text | ✅ | All 5 text fields |
| Example messages | ✅ | Up to 5 from matrix (fetched in AIAssistant) |
| Images/Assets | ❌ | Not passed |
| Template info | ❌ | Not passed |
| Creative library | ❌ | Not passed |

### Example Messages for Style Reference

**Location:** `AIAssistant.jsx:322-348`

```javascript
const exampleMessages = matrixMessages
  .filter(m => m.status !== 'deleted' && (m.headline || m.copy1 || m.cta))
  .slice(0, 5)
  .map(m => ({
    headline: m.headline || '',
    copy1: m.copy1 || '',
    copy2: m.copy2 || '',
    flash: m.flash || '',
    cta: m.cta || ''
  }));
```

---

## 3. AIAssistant Integration

### Communication Method

Uses React `useRef` with `useImperativeHandle` pattern.

**Matrix.jsx:**
```javascript
const claudeChatRef = useRef(null);

// In JSX
<AIAssistant ref={claudeChatRef} matrixState={matrixState} ... />

// Call via ref
claudeChatRef.current.generateMessageContent(contextData, callback);
```

**AIAssistant.jsx:**
```javascript
useImperativeHandle(ref, () => ({
  generateMessageContent: async (contextData, callback) => { ... },
  processEmailsToTasks: async (emails, onTasksCreated) => { ... },
  getIsGenerating: () => isGenerating
}));
```

### Method Signature

```typescript
generateMessageContent(
  contextData: {
    audience: AudienceContext,
    topic: TopicContext,
    currentMessage: MessageContext
  },
  callback: (content: GeneratedContent) => void
): Promise<void>
```

---

## 4. Prompt Construction

### Location
- **File:** `AIAssistant.jsx:351-398`
- **Type:** Hardcoded template (NOT in prompt files)

### Prompt Template

```markdown
Generate marketing message content for the following context:

**Audience:**
- Name: ${contextData.audience.name}
- Strategy: ${contextData.audience.strategy || 'N/A'}
- Device: ${contextData.audience.device || 'N/A'}
- Targeting: ${contextData.audience.targeting_type || 'N/A'}
- Comment: ${contextData.audience.comment || 'N/A'}

**Topic:**
- Name: ${contextData.topic.name}
- Tags: ${[tag1, tag2, tag3, tag4].filter(Boolean).join(', ') || 'N/A'}
- Comment: ${contextData.topic.comment || 'N/A'}

**Current Message Content (if any):**
- Name: ${currentMessage.name || 'N/A'}
- Headline: ${currentMessage.headline || 'N/A'}
- Copy 1: ${currentMessage.copy1 || 'N/A'}
- Copy 2: ${currentMessage.copy2 || 'N/A'}
- Flash: ${currentMessage.flash || 'N/A'}
- CTA: ${currentMessage.cta || 'N/A'}

${examplesSection}

**IMPORTANT INSTRUCTIONS:**
- Study the examples above carefully to match the writing style, tone, and text length
- Use similar language patterns and vocabulary
- Match the level of formality/informality
- Keep text lengths similar to the examples
- Maintain consistency with the brand voice shown in examples
- Use placeholders like {{placeholder}} for dynamic content if you see this pattern in examples

Please generate compelling marketing message content. Respond ONLY with a JSON object in this exact format:

```json
{
  "headline": "Your generated headline here",
  "copy1": "Your generated first copy text here",
  "copy2": "Your generated second copy text here",
  "flash": "Your generated flash text here",
  "cta": "Your generated call-to-action here"
}
```

Make sure the content is:
- Relevant to the audience and topic
- Matching the style, tone, and length of the examples provided
- Engaging and action-oriented
- Appropriate for the specified device and platform
- Using placeholders where the examples use them
```

### Key Observations

1. **No prompt file** - Unlike other AI features, content generation uses hardcoded prompt
2. **Style learning** - Uses up to 5 example messages to learn brand voice
3. **Placeholder awareness** - Instructs to use `{{placeholder}}` patterns if seen in examples
4. **JSON-only response** - Strict output format for reliable parsing

---

## 5. API Call

### Request Chain

```
AIAssistant.jsx
    ↓ callClaudeAPI()
src/api/claude-proxy.js
    ↓ authenticatedFetch()
server.js /api/claude
    ↓ fetch()
https://api.anthropic.com/v1/messages
```

### API Call Details

**Location:** `AIAssistant.jsx:411`

```javascript
const data = await callClaudeAPI(
  apiKey,                        // From env or localStorage
  [userMessage],                 // Single message with full prompt
  'claude-3-5-sonnet-20241022',  // Model
  2048                           // Max tokens
);
```

### Request Payload

```javascript
{
  messages: [
    {
      role: 'user',
      content: generationPrompt  // Full prompt string
    }
  ],
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 2048
}
```

### Server Endpoint

**Location:** `server.js:803-840`

```javascript
app.post('/api/claude', verifyToken, async (req, res) => {
  const { messages, model, max_tokens } = req.body;
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({ model, max_tokens, messages })
  });

  const data = await response.json();
  res.json(data);
});
```

---

## 6. Response Handling

### JSON Extraction

**Location:** `AIAssistant.jsx:421-433`

Multiple parsing strategies for robustness:

```javascript
// Strategy 1: Standard markdown code block
let jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);

// Strategy 2: Code block without newlines
if (!jsonMatch) {
  jsonMatch = responseText.match(/```json([\s\S]*?)```/);
}

// Strategy 3: Raw JSON object
if (!jsonMatch) {
  jsonMatch = responseText.match(/\{[\s\S]*?"headline"[\s\S]*?\}/);
}
```

### Callback Flow

```javascript
// AIAssistant.jsx:450
callback(generatedContent);

// Matrix.jsx:1391-1393
claudeChatRef.current.generateMessageContent(contextData, (content) => {
  setGeneratedContent(content);
});
```

### Apply to Form

**Location:** `Matrix.jsx:978-994`

```javascript
useEffect(() => {
  if (generatedContent && editingMessage) {
    setEditingMessage({
      ...editingMessage,
      headline: generatedContent.headline || editingMessage.headline,
      copy1: generatedContent.copy1 || editingMessage.copy1,
      copy2: generatedContent.copy2 || editingMessage.copy2,
      flash: generatedContent.flash || editingMessage.flash,
      cta: generatedContent.cta || editingMessage.cta
    });
    setGeneratedContent(null);
    setIsGeneratingContent(false);
  }
}, [generatedContent]);
```

**Merge behavior:** Generated values only replace if present; existing values preserved if Claude returns empty.

---

## 7. Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER CLICKS "GENERATE CONTENT"                   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MessageEditorDialog.jsx                                             │
│  onClick={handleGenerateContent}                                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Matrix.jsx - handleGenerateContent()                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Find audience & topic by key                             │    │
│  │ 2. Build contextData object                                 │    │
│  │ 3. Set isGeneratingContent = true                           │    │
│  │ 4. Call claudeChatRef.current.generateMessageContent()      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AIAssistant.jsx - generateMessageContent()                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Get 5 example messages from matrixState                  │    │
│  │ 2. Build examplesSection string                             │    │
│  │ 3. Construct generationPrompt                               │    │
│  │ 4. Create userMessage { role: 'user', content: prompt }     │    │
│  │ 5. Add to chat messages                                     │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  callClaudeAPI(apiKey, [userMessage], model, maxTokens)              │
│  → src/api/claude-proxy.js                                           │
│  → POST /api/claude                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  server.js /api/claude                                               │
│  → fetch('https://api.anthropic.com/v1/messages')                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ANTHROPIC API RESPONSE                                              │
│  { content: [{ text: "```json\n{...}\n```" }] }                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  AIAssistant.jsx - Parse Response                                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Extract JSON from response (3 regex strategies)          │    │
│  │ 2. Parse JSON to object                                     │    │
│  │ 3. Validate has content                                     │    │
│  │ 4. callback(generatedContent)                               │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Matrix.jsx - Callback Handler                                       │
│  setGeneratedContent(content)                                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Matrix.jsx - useEffect [generatedContent]                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 1. Merge generated fields into editingMessage               │    │
│  │ 2. setEditingMessage({...merged})                           │    │
│  │ 3. setGeneratedContent(null)                                │    │
│  │ 4. setIsGeneratingContent(false)                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MessageEditorDialog form fields update with generated content       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Key Files Reference

| File | Line | Purpose |
|------|------|---------|
| `MessageEditorDialog.jsx` | 2372 | Generate button UI |
| `MessageEditorDialog.jsx` | 26 | handleGenerateContent prop |
| `Matrix.jsx` | 1345-1394 | handleGenerateContent function |
| `Matrix.jsx` | 978-994 | Apply generated content effect |
| `AIAssistant.jsx` | 310-485 | generateMessageContent implementation |
| `AIAssistant.jsx` | 351-398 | Prompt template |
| `src/api/claude-proxy.js` | 4-32 | callClaudeAPI function |
| `server.js` | 803-840 | /api/claude endpoint |

---

## 9. Limitations & Improvement Opportunities

### Current Limitations

1. **No image context** - Cannot reference visual assets when generating copy
2. **Hardcoded prompt** - Not customizable via AI prompts system
3. **Single model** - Always uses claude-3-5-sonnet, no model selection
4. **No streaming** - Waits for full response before displaying
5. **No regenerate** - Must click button again to get alternatives
6. **No field selection** - Generates all 5 fields, can't choose subset

### Potential Improvements

1. **Add to prompt files** - Create `AIGenerateContentInstructions.txt`
2. **Multi-model support** - Allow provider/model selection
3. **Image context** - Pass current image assets for context-aware copy
4. **Streaming UI** - Show content as it generates
5. **Field toggles** - Let user choose which fields to generate
6. **Regenerate button** - Quick regeneration without full reset
7. **Temperature control** - Let user adjust creativity level

---

*Report generated by Claude Code for Orchestrator*
