# Messaging Matrix - Context Index

Quick reference guide to all context files and where to find specific information.

## Quick Navigation

| Need to... | Check this file |
|------------|----------------|
| Get started quickly | `context-quickstart.md` |
| Understand data flow | `context-architecture.md` → Data Model |
| Find a component | `context-components.md` → Component Hierarchy |
| Debug sync issues | `skills/debug-sync.md` |
| Understand API endpoints | `context-api.md` |
| Learn common workflows | `context-workflows.md` |
| Debug PMMID generation | `skills/analyze-pattern.md` |
| Optimize performance | `skills/optimize-performance.md` |
| Upload assets | `context-workflows.md` → Asset Upload |
| Create shares | `skills/create-share.md` |
| Find configuration | `context-architecture.md` → Configuration System |

---

## By Topic

### Architecture & Setup
- **System Overview**: `context-architecture.md` → Project Overview
- **Directory Structure**: `context-architecture.md` → Key Directory Structure
- **Data Model**: `context-architecture.md` → Data Model
- **Storage Strategy**: `context-architecture.md` → Data Model → Data Storage Strategy
- **Authentication**: `context-architecture.md` → Authentication Systems
- **Configuration**: `context-architecture.md` → Configuration System
- **Environment Setup**: `context-quickstart.md` → Development Setup

### Components
- **Component List**: `context-components.md` → Component Hierarchy
- **Matrix Component**: `context-components.md` → Matrix.jsx
- **Message Editor**: `context-components.md` → MessageEditorDialog.jsx
- **Tree View**: `context-components.md` → TreeView.jsx
- **Asset Management**: `context-components.md` → Assets.jsx
- **Creative Library**: `context-components.md` → CreativeLibrary.jsx
- **AI Integration**: `context-components.md` → ClaudeChat.jsx
- **useMatrix Hook**: `context-components.md` → useMatrix.js

### Workflows
- **Message Creation**: `context-workflows.md` → Message Creation Workflow
- **Data Sync**: `context-workflows.md` → Data Sync Workflow
- **Asset Upload**: `context-workflows.md` → Asset Upload Workflow
- **AI Content**: `context-workflows.md` → AI Content Generation Workflow
- **Template Management**: `context-workflows.md` → Template Management Workflow
- **Share Gallery**: `context-workflows.md` → Share Gallery Workflow

### API & Backend
- **API Overview**: `context-api.md`
- **Google Sheets**: `context-api.md` → Google Sheets Integration
- **Authentication**: `context-api.md` → Authentication
- **Configuration**: `context-api.md` → Configuration Management
- **Assets**: `context-api.md` → Asset Management
- **Shares**: `context-api.md` → Share Gallery
- **Templates**: `context-api.md` → Templates

### Patterns & Utils
- **Pattern Evaluation**: `context-workflows.md` → Pattern 2: Pattern Evaluation
- **Message Lookup**: `context-workflows.md` → Pattern 1: Message Lookup
- **Google Sheets Ops**: `context-workflows.md` → Pattern 3: Google Sheets Operations
- **Asset Registry**: `context-workflows.md` → Pattern 4: Asset Registry Management
- **State Management**: `context-workflows.md` → Pattern 5: State Management

### Debugging
- **Sync Issues**: `skills/debug-sync.md`
- **Pattern Issues**: `skills/analyze-pattern.md`
- **Asset Upload**: `skills/test-asset-upload.md`
- **Performance**: `skills/optimize-performance.md`
- **General Debugging**: `context-workflows.md` → Debugging Tips

---

## By File Location

### React Components (`src/components/`)
- Matrix.jsx (1,530 lines) → `context-components.md` → Matrix.jsx
- MessageEditorDialog.jsx (1,320 lines) → `context-components.md` → MessageEditorDialog.jsx
- TreeView.jsx (902 lines) → `context-components.md` → TreeView.jsx
- PreviewView.jsx (1,440 lines) → `context-components.md` → PreviewView.jsx
- CreativeLibrary.jsx (930 lines) → `context-components.md` → CreativeLibrary.jsx
- Assets.jsx (1,054 lines) → `context-components.md` → Assets.jsx
- ClaudeChat.jsx (767 lines) → `context-components.md` → ClaudeChat.jsx
- Templates.jsx (1,107 lines) → `context-components.md` → Templates.jsx

### Hooks (`src/hooks/`)
- useMatrix.js (355 lines) → `context-components.md` → useMatrix.js

### Utils (`src/utils/`)
- patternEvaluator.js (240 lines) → `context-workflows.md` → Pattern Evaluation
- treeBuilder.js → `context-components.md` → TreeView.jsx
- assetUtils.js → `context-workflows.md` → Asset Upload
- templatePopulator.js → `context-workflows.md` → Template Management

### Services (`src/services/`)
- sheets.js (520 lines) → `context-architecture.md` → Data Storage Strategy
- previewService.js → `context-workflows.md` → Share Gallery Workflow

### Backend
- server.js (1,400+ lines) → `context-api.md`

### Configuration
- config.json → `context-architecture.md` → Configuration System
- .env → `context-quickstart.md` → Environment Variables
- ecosystem.config.cjs → `context-architecture.md` → PM2 Process Management

---

## Common Questions

### "How do I create a new message?"
→ `context-workflows.md` → Message Creation Workflow
→ `context-quickstart.md` → Common Tasks → Create Message

### "How does PMMID generation work?"
→ `context-workflows.md` → Pattern 2: Pattern Evaluation
→ `skills/analyze-pattern.md`

### "Where is the data stored?"
→ `context-architecture.md` → Data Model → Data Storage Strategy

### "How do I debug sync issues?"
→ `skills/debug-sync.md`
→ `context-workflows.md` → Debugging Tips

### "How do I upload an asset?"
→ `context-workflows.md` → Asset Upload Workflow
→ `skills/test-asset-upload.md`

### "How do I create a share gallery?"
→ `context-workflows.md` → Share Gallery Workflow
→ `skills/create-share.md`

### "What API endpoints are available?"
→ `context-api.md`

### "How do I add AI content generation?"
→ `context-workflows.md` → AI Content Generation Workflow
→ `context-components.md` → ClaudeChat.jsx

### "How is authentication handled?"
→ `context-architecture.md` → Authentication Systems
→ `context-api.md` → Authentication

### "How do I optimize performance?"
→ `skills/optimize-performance.md`
→ `context-architecture.md` → Performance Optimizations

---

## File Reference Format

When referencing code in context files, use this format:
- Component: `ComponentName.jsx:lineNumber`
- Function: `fileName.js:lineNumber - functionName()`
- Pattern: `context-workflows.md` → Pattern Name
- API: `context-api.md` → Endpoint Name

Example: "Check `Matrix.jsx:1530` for the main grid rendering logic"

---

## Updating This Index

When adding new context files or sections:
1. Add entry to appropriate table
2. Update "By Topic" section if new topic
3. Update "Common Questions" if addressing FAQ
4. Keep format consistent
5. Use relative links where possible

---

## Context File Dependencies

```
context-quickstart.md
  ├─ Quick reference for common tasks
  └─ Links to detailed sections in other files

context-architecture.md
  ├─ System-level overview
  ├─ Data model
  └─ Configuration

context-workflows.md
  ├─ Uses architecture concepts
  ├─ References components
  └─ Uses API endpoints

context-components.md
  ├─ Uses architecture concepts
  ├─ Uses workflows
  └─ References utils

context-api.md
  ├─ Uses architecture concepts
  └─ Complements workflows

skills/*
  ├─ Specific task guides
  ├─ Reference all context files
  └─ Actionable step-by-step instructions
```

---

## Maintenance Checklist

When updating the codebase, check if these need updates:

- [ ] Component line counts changed significantly?
     → Update `context-components.md`

- [ ] New API endpoints added?
     → Update `context-api.md`

- [ ] New workflow introduced?
     → Update `context-workflows.md` or create new skill

- [ ] Architecture changed?
     → Update `context-architecture.md`

- [ ] New common pattern emerged?
     → Add to `context-workflows.md` → Common Coding Patterns

- [ ] Configuration structure changed?
     → Update `context-architecture.md` → Configuration System

- [ ] Performance optimizations added?
     → Update `context-architecture.md` → Performance Optimizations
     → Update `skills/optimize-performance.md`

---

Last Updated: 2025-10-24
