# AI Assistant Model Selector - Phase 1 Implementation

**Date:** 2026-01-04
**Branch:** `assistant-upgrade`
**Author:** Claude Code

---

## Summary

Added a model selector dropdown to AIAssistant that allows users to switch between different AI providers and models. Currently only Claude is functional; Gemini and Grok are shown as "Coming Soon".

---

## Changes Made

### 1. Provider Configuration

**Location:** `src/components/AIAssistant.jsx:8-43`

Added `AI_PROVIDERS` constant with provider definitions:

```javascript
const AI_PROVIDERS = {
  claude: {
    id: 'claude',
    name: 'Claude',
    icon: '🟣',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude 4.5 Sonnet', isDefault: true },
      { id: 'claude-opus-4-5-20251101', name: 'Claude 4.5 Opus' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' }
    ],
    available: true
  },
  gemini: {
    id: 'gemini',
    name: 'Gemini',
    icon: '🔵',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', isDefault: true },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
    ],
    available: false,
    comingSoon: true
  },
  grok: {
    id: 'grok',
    name: 'Grok',
    icon: '⚫',
    models: [
      { id: 'grok-3', name: 'Grok 3', isDefault: true },
      { id: 'grok-3-mini', name: 'Grok 3 Mini' }
    ],
    available: false,
    comingSoon: true
  }
};
```

### 2. State Management

**Location:** `src/components/AIAssistant.jsx:67-82`

Added state for model selection with localStorage persistence:

```javascript
const [showModelDropdown, setShowModelDropdown] = useState(false);
const [selectedProvider, setSelectedProvider] = useState(() => {
  return localStorage.getItem('ai_assistant_provider') || 'claude';
});
const [selectedModel, setSelectedModel] = useState(() => {
  const saved = localStorage.getItem('ai_assistant_model');
  if (saved) return saved;
  // Default to first model of default provider
  const provider = AI_PROVIDERS[localStorage.getItem('ai_assistant_provider') || 'claude'];
  const defaultModel = provider?.models.find(m => m.isDefault) || provider?.models[0];
  return defaultModel?.id || 'claude-sonnet-4-5-20250929';
});
```

### 3. Handler Functions

**Location:** `src/components/AIAssistant.jsx:575-611`

Added handlers for model selection and dropdown management:

- `handleSelectModel(providerId, modelId)` - Handles model selection, saves to localStorage
- `getCurrentProviderInfo()` - Returns current provider and model info for display
- Click-outside effect to close dropdown

### 4. Model Selector UI

**Location:** `src/components/AIAssistant.jsx:1299-1417`

Added dropdown in dialog header with:

- Current model display button with provider icon
- Dropdown menu with provider sections
- "Coming Soon" badges for unavailable providers
- Visual feedback for selected model (checkmark)
- Hover effects for available options
- Disabled state for unavailable providers

### 5. API Call Updates

Updated all three `callClaudeAPI` calls to use `selectedModel`:

| Location | Feature | Previous Model | Now |
|----------|---------|----------------|-----|
| Line 262 | Email-to-Task | `claude-sonnet-4-5-20250929` | `selectedModel` |
| Line 462 | Generate Content | `claude-3-5-sonnet-20241022` | `selectedModel` |
| Line 885 | General Chat | `claude-3-5-sonnet-20241022` | `selectedModel` |

---

## localStorage Keys

| Key | Purpose | Default |
|-----|---------|---------|
| `ai_assistant_provider` | Selected provider ID | `'claude'` |
| `ai_assistant_model` | Selected model ID | `'claude-sonnet-4-5-20250929'` |

---

## UI Design

The model selector follows Messaging Matrix styling patterns:

- **Trigger Button:** Rounded, semi-transparent background, provider icon + model name
- **Dropdown:** Dark background, grouped by provider with headers
- **Provider Headers:** Uppercase labels with icons and "Coming Soon" badges
- **Model Items:** Indented under provider, with checkmark for selected
- **Hover States:** Subtle background highlight on available items
- **Disabled State:** Reduced opacity, not-allowed cursor

---

## What's NOT Changed (Phase 2)

The following are prepared but not yet functional:

1. **Backend multi-provider support** - Server still only routes to Anthropic API
2. **Gemini/Grok API integration** - Marked as "Coming Soon"
3. **Provider-specific error handling** - All errors assume Claude format
4. **Model-specific token limits** - Using hardcoded limits per feature

---

## Next Steps (Phase 2)

1. Create unified LLM service in backend (`/api/llm`)
2. Add provider-specific API handlers (similar to ConfAI pattern)
3. Add API key configuration per provider in Settings
4. Enable Gemini and Grok providers
5. Add provider-specific error handling

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/AIAssistant.jsx` | Added provider config, state, handlers, UI, updated API calls |

---

## Testing Checklist

- [ ] Model selector button shows in dialog header
- [ ] Dropdown opens on click
- [ ] Claude models are selectable
- [ ] Gemini/Grok show "Coming Soon" and are disabled
- [ ] Selection persists on page reload (localStorage)
- [ ] Selected model is used in API calls
- [ ] Dropdown closes on click outside
- [ ] Dropdown closes after selection

---

*Report generated by Claude Code*
