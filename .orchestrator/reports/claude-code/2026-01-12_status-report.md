# Orchestrator Status Report
**Date:** 2026-01-12
**Branch:** `main`

---

## Summary

Major updates since 2026-01-06: Multi-model AI support with streaming, template system improvements, Matrix view enhancements, and numerous bug fixes. **38 commits** plus uncommitted AI streaming work.

---

## Uncommitted Work (In Progress)

### AI Assistant Streaming & Multi-Model Support

**Files Changed:**
- `server.js` (+258 lines) - Streaming endpoints for Claude, Gemini, Grok
- `src/api/claude-proxy.js` (+86 lines) - Unified `callAIAPIStream()` with provider routing
- `src/components/AIAssistant.jsx` (+628 lines) - Complete rewrite with streaming
- `src/components/Settings.jsx` (+295 lines) - AI provider configuration UI
- `package.json` - Added streaming libraries

**Features:**
- Real-time streaming responses with blinking cursor
- Markdown toggle (Code icon) with localStorage persistence
- Model selector dropdown (10+ models across 3 providers)
- Provider auto-detection from model ID
- Context management - send filtered matrix data as system context
- Image attachment support

---

## Committed Features (2026-01-06 to 2026-01-12)

### 1. Multi-Model AI Backend
| Commit | Description |
|--------|-------------|
| `72becef` | Add multi-model AI support (Gemini and Grok) |
| `5524624` | Add Gemini 3 Pro Preview model |
| `c8c19ac` | Update Gemini models: remove 2.0/1.5, add 2.5 Flash |
| `5939013` | Update Grok to single model: grok-4.1-thinking |
| `c8f9694` | Remove Claude 3.5 Sonnet from model list |
| `fbd3f49` | Improve Grok API error messages |

### 2. Template System Improvements
| Commit | Description |
|--------|-------------|
| `e3f893f` | Derive template sizes from CSS filenames instead of template.json |
| `2ae2cef` | Fix empty.png: explicit values use Drive proxy, defaults use template folder |
| `49dd174` | Fix hardcoded empty.png in template HTML when image fields empty |
| `bbafd40` | Load empty.png from template folder via /api/templates endpoint |
| `043c320` | Fix empty.png loading through Drive proxy instead of public folder |
| `b4ef7c2` | Update NobilisTilia-html template |
| `04cc7b7` | Update NobilisTilia-html template CSS styles |
| `24d6671` | Remove 1080x510 size from NobilisTilia-html template |
| `abf9e1b` | Add template asset loading documentation to CLAUDE.md |

### 3. Matrix View & MC Editor
| Commit | Description |
|--------|-------------|
| `071e740` | Replace IMG text label with icons in Matrix view |
| `d5e30b1` | Add cross-row MC moves to empty rows and IMG badge for static templates |
| `f2bedcc` | Hide navigator from matrix view and update zoom info text |
| `12e407b` | Add matrix grid spacing and NobilisTilia template |
| `9ea46e5` | Add pipe modifiers to feed pattern evaluator |
| `986b96d` | Fix auto-save for template variant class changes |
| `860b15e` | Add reload button to MC editor preview |
| `b43321d` | Fix MC editor deep link URL persistence on reload |
| `b88627d` | Update MC editor text and add sorting to Creative Library and Assets |

### 4. Drive Sync & Creative Library
| Commit | Description |
|--------|-------------|
| `de6c883` | Fix Drive asset sync for overwritten files and Creative Library sizes |
| `c652c6d` | Fix Drive sync race condition and improve MatrixStatePanel UX |
| `c3c4d9b` | Fix Creative Library showing phantom HTML creatives and stale product filter |
| `ece5e62` | Fix creative filename parsing to be brand-agnostic |
| `1c1c4b5` | Fix template preview CSS and library filter issues |

### 5. Visualization Views (Sankey/Tree)
| Commit | Description |
|--------|-------------|
| `e9db1e3` | Improve Sankey and Tree view navigation and UI |
| `24f368c` | Fix Sankey view to sort MC numbers numerically |
| `a1ac99c` | Fix tree builder to handle Topic -> Topic transitions |

### 6. UI/UX Improvements
| Commit | Description |
|--------|-------------|
| `c2c0a52` | Redesign Topic and Audience editor dialogs with 2-panel layout |

### 7. Infrastructure & Deployment
| Commit | Description |
|--------|-------------|
| `05736d2` | Add Proficio subdomain to CORS allowed origins |
| `1aedbb5` | Add production update script |
| `5e70de2` | Add database cleanup script for fresh instance setup |
| `8c0a998` | Update DEPLOYMENT_HETZNER.md with lessons learned |

---

## Key Architecture Changes

### AI Provider Routing
```
User selects model -> callAIAPIStream() -> Auto-detect provider:
  - "gemini-*" -> /api/gemini/stream
  - "grok-*" -> /api/grok/stream
  - else -> /api/claude/stream
```

### Template Asset Resolution (Clarified)
```
empty.png handling:
  - Message has value "abc123" -> /api/drive/proxy/abc123
  - Message has value "empty.png" -> /api/drive/proxy/empty.png (actual asset)
  - Message field is "" -> Template's /api/templates/{name}/empty.png
```

### Template Size Detection
Sizes now derived from `{width}x{height}.css` filenames in template folder rather than hardcoded in template.json.

---

## Files Changed Summary

| Category | Files |
|----------|-------|
| AI/Backend | server.js, claude-proxy.js |
| AI/Frontend | AIAssistant.jsx, Settings.jsx |
| Matrix | MatrixGridView.jsx, Matrix.jsx |
| Templates | NobilisTilia-html/*, template loading logic |
| Views | Sankey, Tree, Tree2 components |
| Dialogs | TopicEditorDialog, AudienceEditorDialog |
| Documentation | CLAUDE.md, DEPLOYMENT_HETZNER.md |

---

## Testing Notes

- AI streaming tested with Claude, Gemini, and Grok
- Template empty.png resolution verified across all 3 templates
- Cross-row MC moves working in Matrix view
- Sankey/Tree numerical sorting confirmed

---

## Next Steps (Suggested)

1. Commit the AI streaming work (currently unstaged)
2. Test multi-model support in production
3. Consider adding model performance metrics/logging
