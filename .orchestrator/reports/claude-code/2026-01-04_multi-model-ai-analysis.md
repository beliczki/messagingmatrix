# Multi-Model AI Integration Planning - Analysis Report

**Date:** 2026-01-04
**Author:** Claude Code

---

## 1. Current AI State in Messaging Matrix

### 1.1 AI Features in MessageEditorDialog

**Generate Tab** (`MessageEditorDialog.jsx:2361-2384`)
- Simple "Generate Content" button that triggers `handleGenerateContent`
- Generates headlines, copy, and CTAs based on topic/audience context
- Uses `AIAssistant.generateMessageContent()` via ref
- Visual: Sparkles icon, centered layout with description

**Content Tab**
- No direct AI features - purely form-based content editing
- Asset autocomplete for images/videos (recently added)
- Textarea inputs for headline, copy1, copy2, flash, CTA

### 1.2 Claude Integration Architecture

**Frontend → Backend Flow:**
```
AIAssistant.jsx
    ↓ (callClaudeAPI)
src/api/claude-proxy.js
    ↓ (authenticatedFetch)
server.js /api/claude (line 803)
    ↓ (fetch)
https://api.anthropic.com/v1/messages
```

**API Endpoint** (`server.js:803-840`):
```javascript
app.post('/api/claude', verifyToken, async (req, res) => {
  const { messages, model = 'claude-3-5-sonnet-20241022', max_tokens = 4096 } = req.body;
  // Uses VITE_ANTHROPIC_API_KEY from .env
  // Direct fetch to Anthropic API
});
```

### 1.3 Prompt Structure

**Prompts Location:** `AI/` directory with text files

| Module | File |
|--------|------|
| client-context | `AiClientContext.txt` |
| matrix | `AIMatrixInstructions.txt` |
| creative-library | `AICreativeLibraryInstructions.txt` |
| assets | `AIAssetsInstructions.txt` |
| monitoring | `AIMonitoringInstructions.txt` |
| templates | `AITemplatesInstructions.txt` |
| users | `AIUsersInstructions.txt` |
| tasks | `AITasksInstructions.txt` |
| settings | `AISettingsInstructions.txt` |
| email-to-task | `AIEmailToTaskInstructions.txt` |

**API Endpoints for Prompts:**
- `GET /api/ai-prompts` - Get all prompts
- `GET /api/ai-prompts/:module` - Get specific module prompt
- `POST /api/ai-prompts/:module` - Save/update prompt
- `GET /api/ai-data-structure` - Get data structure docs

### 1.4 Generated Results Display

- **AIAssistant Chat Panel**: Full conversation display with message bubbles
- **MessageEditorDialog**: Generated content auto-fills form fields (headline, copy1, copy2, flash, cta)
- Results parsed from JSON in Claude response

### 1.5 Models Currently Used

| Feature | Model |
|---------|-------|
| Email-to-Task | `claude-sonnet-4-5-20250929` (16384 tokens) |
| Generate Content | `claude-3-5-sonnet-20241022` (2048 tokens) |
| General Chat | `claude-3-5-sonnet-20241022` (4096 tokens) |

---

## 2. ConfAI Multi-Model Implementation Analysis

**Location:** `C:\Users\belic\Claude\ConfAI\ConfAI\`

### 2.1 Supported Providers

From `llm_service.py`:

| Provider | API Key Env Var | Default Model |
|----------|-----------------|---------------|
| Claude (Anthropic) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5-20250929` |
| Gemini (Google) | `GEMINI_API_KEY` | `gemini-2.5-flash-lite` |
| Grok (xAI) | `GROK_API_KEY` | `grok-4-fast-reasoning` |
| Perplexity | `PERPLEXITY_API_KEY` | `sonar` |

### 2.2 API Abstraction Layer

**LLMService Class** (`app/services/llm_service.py`):

```python
class LLMService:
    def __init__(self):
        self.anthropic_key = os.getenv('ANTHROPIC_API_KEY')
        self.gemini_key = os.getenv('GEMINI_API_KEY')
        self.grok_key = os.getenv('GROK_API_KEY')
        self.perplexity_key = os.getenv('PERPLEXITY_API_KEY')

    def generate_response(self, messages, context, stream, provider=None):
        # Routes to appropriate provider
        if provider == 'claude':
            return self._generate_claude(...)
        elif provider == 'gemini':
            return self._generate_gemini(...)
        # etc.
```

### 2.3 Vendor Switching

- **Database Settings**: Provider stored in Settings table
- **Getter**: `_get_provider()` reads from `Settings.get('llm_provider', ...)`
- **Model Names**: Each provider has configurable model via `Settings.get(f'{provider}_model', ...)`
- **Runtime Override**: `provider` parameter can override default

### 2.4 Provider-Specific Handling

| Provider | Library | Specifics |
|----------|---------|-----------|
| **Claude** | `anthropic` SDK | Prompt caching with `cache_control: ephemeral`, system blocks format |
| **Gemini** | `google-generativeai` | `genai.GenerativeModel`, alternating user/model messages |
| **Grok** | `httpx` (OpenAI-compatible) | xAI endpoint `api.x.ai/v1/chat/completions`, UTF-8 encoding handling |
| **Perplexity** | `httpx` (OpenAI-compatible) | Requires strict message alternation, system prompt merged into first user message |

### 2.5 Dependencies

From `requirements.txt`:
```
anthropic>=0.40.0
httpx>=0.25.2
google-generativeai>=0.3.0
chromadb>=0.4.22  # Vector embeddings
```

### 2.6 Key Design Patterns

1. **Unified Interface**: Single `generate_response()` method, provider-agnostic
2. **Streaming Support**: All providers support streaming via iterators
3. **Usage Tracking**: Captures token counts for billing/analytics
4. **Fallback Estimation**: Estimates tokens from character count if API doesn't return usage
5. **Error Handling**: Provider-specific error messages with fallback to other providers
6. **Singleton Pattern**: `llm_service = LLMService()` for app-wide access

---

## 3. Banana/Image Generation Analysis

### 3.1 Current Status

**NOT INTEGRATED** - Only referenced in `TODO.md`:
```
- [ ] AI nodes: Claude for copy, Banana for images
```

### 3.2 Banana API Overview

Banana is an ML infrastructure platform for deploying and running models. Key points:
- REST API for image generation
- Supports Stable Diffusion, FLUX, custom models
- Pay-per-second billing
- API Key authentication

### 3.3 Integration Points for MessageEditorDialog

Image generation could fit into:

1. **New "Generate Image" Tab** in MessageEditorDialog
   - Input: Text prompt from headline/copy context
   - Output: Generated image uploaded to assets

2. **Content Tab Enhancement**
   - "Generate" button next to image input fields
   - Uses message context to generate appropriate visuals

3. **Asset Library Integration**
   - Standalone image generation tool in Assets module
   - AI-generated assets tagged for easy filtering

### 3.4 Suggested API Structure

```javascript
// Frontend
const generateImage = async (prompt, style, size) => {
  const response = await fetch('/api/banana/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, style, size })
  });
  return response.json(); // { imageUrl, thumbnailUrl }
};

// Backend endpoint
app.post('/api/banana/generate', async (req, res) => {
  const { prompt, style, size } = req.body;
  // Call Banana API
  // Upload result to Google Drive
  // Return asset metadata
});
```

---

## 4. Integration Recommendations

### 4.1 Adopt ConfAI LLMService Pattern

The ConfAI implementation provides a solid foundation:

```javascript
// Create llm-service.js in Messaging Matrix
class LLMService {
  constructor() {
    this.providers = {
      claude: new ClaudeProvider(),
      gemini: new GeminiProvider(),
      grok: new GrokProvider(),
      openai: new OpenAIProvider()
    };
  }

  async generateResponse(messages, options = {}) {
    const provider = options.provider || this.getDefaultProvider();
    return this.providers[provider].generate(messages, options);
  }
}
```

### 4.2 Configuration UI

Add to Settings:
- LLM Provider selector (dropdown)
- Model selector per provider
- API key inputs (encrypted storage)
- Test connection button

### 4.3 MessageEditorDialog Enhancements

1. **Generate Tab Updates**:
   - Add provider selector dropdown
   - Model quality selector (fast/balanced/quality)
   - Temperature slider
   - "Regenerate" button

2. **Image Generation**:
   - Add "Generate Image" section
   - Preview before accepting
   - Style presets (photorealistic, illustration, abstract)

### 4.4 Incremental Implementation

| Phase | Feature | Effort |
|-------|---------|--------|
| 1 | Abstract LLMService in Messaging Matrix | Medium |
| 2 | Add Gemini as second provider | Low |
| 3 | Settings UI for provider selection | Medium |
| 4 | Banana image generation POC | Medium |
| 5 | Full image generation in Content tab | High |

---

## 5. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Messaging Matrix                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌─────────────────────────────────┐   │
│  │ AIAssistant  │────▶│     LLMService (New)            │   │
│  └──────────────┘     │                                 │   │
│         ▲             │  ┌─────────┐  ┌─────────┐       │   │
│         │             │  │ Claude  │  │ Gemini  │       │   │
│  ┌──────┴───────┐     │  └────┬────┘  └────┬────┘       │   │
│  │MessageEditor │     │       │            │            │   │
│  │   Dialog     │────▶│  ┌────┴────┐  ┌────┴────┐       │   │
│  │              │     │  │  Grok   │  │ OpenAI  │       │   │
│  └──────────────┘     │  └─────────┘  └─────────┘       │   │
│                       │                                 │   │
│                       │  ┌─────────────────────────┐    │   │
│                       │  │  ImageService (Banana)  │    │   │
│                       │  └─────────────────────────┘    │   │
│                       └─────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Files Referenced

### Messaging Matrix
- `src/components/AIAssistant.jsx` - Main AI chat component
- `src/components/MessageEditorDialog.jsx` - MC editor with Generate tab
- `src/api/claude-proxy.js` - Frontend API wrapper
- `server.js:803-980` - Backend AI endpoints
- `AI/*.txt` - Prompt files

### ConfAI
- `app/services/llm_service.py` - Multi-provider LLM service
- `requirements.txt` - Python dependencies

---

*Report generated by Claude Code*
