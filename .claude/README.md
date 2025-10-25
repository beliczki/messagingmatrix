# Claude Code Context & Skills

This directory contains context files and skills to help Claude Code understand your Messaging Matrix codebase more efficiently across sessions.

## Context Files

Context files provide comprehensive documentation about the codebase architecture, patterns, and common workflows. Claude Code can reference these files to understand the system without needing to re-explore the codebase each time.

### Available Context Files

1. **context-quickstart.md** - Start here!
   - Quick overview of the project
   - Common tasks with code examples
   - Key commands and debugging tips
   - Perfect for getting oriented quickly

2. **context-architecture.md** - System architecture
   - Directory structure and organization
   - Data model and storage strategy
   - Authentication systems
   - Configuration management
   - Performance optimizations
   - Development and deployment setup

3. **context-workflows.md** - Common workflows and patterns
   - Step-by-step workflows for common tasks
   - Message creation, data sync, asset upload
   - AI content generation workflow
   - Coding patterns and best practices
   - Testing checklist and debugging tips

4. **context-components.md** - Component reference
   - Detailed breakdown of all React components
   - Component hierarchy and responsibilities
   - Key functions and state management
   - Line counts and file locations
   - Props and interfaces

5. **context-api.md** - API documentation
   - Complete API endpoint reference
   - Request/response formats
   - Authentication flows
   - Error handling
   - CORS configuration

## Skills

Skills are specialized guides for common development tasks. These are like "runbooks" for specific operations.

### Available Skills

1. **debug-sync.md** - Debug Google Sheets synchronization
   - Check localStorage sync status
   - Test authentication
   - Verify data integrity
   - Common sync issues and fixes

2. **analyze-pattern.md** - Analyze pattern evaluation
   - Debug PMMID generation
   - Test trafficking field patterns
   - Understand placeholder replacement
   - Fix pattern syntax errors

3. **test-asset-upload.md** - Test asset upload workflow
   - Verify upload process
   - Check metadata extraction
   - Test naming pattern
   - Validate registry operations

4. **create-share.md** - Create share galleries
   - Generate share IDs
   - Render HTML templates
   - Copy assets
   - Create ZIP downloads

5. **optimize-performance.md** - Performance optimization
   - Analyze performance bottlenecks
   - Check data loading efficiency
   - Optimize React components
   - Review asset management
   - Suggest improvements

## Recent Major Updates (v2.0.0)

### Code Refactoring
- **MediaLibraryBase** (674 lines) - New shared component for Assets and CreativeLibrary
  - Eliminated ~1000 lines of code duplication
  - Provides virtual scrolling, masonry layout, list view
  - Render props pattern for customization
- **Assets** - Reduced from 1,103 to 377 lines using MediaLibraryBase
- **CreativeLibrary** - Reduced from 931 to 525 lines using MediaLibraryBase

### Google Drive Integration
- Auto-sync assets and creatives from Google Drive folders
- Spreadsheet-first sync strategy (spreadsheet is source of truth)
- File metadata extraction (name, size, date, dimensions)
- Backend proxy for secure file serving (`/api/drive/proxy/{fileId}`)
- Proxy supports both file IDs and filenames

### Asset & Creative Management
- Virtual scrolling with masonry layout for high performance
- Sequential image loading for accurate height calculation
- List view with sortable columns
- Advanced filtering with AND/OR logic
- Dark-themed preview dialog with metadata panel
- Support for static (images, videos) and dynamic (HTML5) creatives

### Template System
- HTML5 banner template support
- Template configuration with placeholder bindings
- `path-messagingmatrix` for configurable asset paths
- CSS injection for proper rendering
- Live preview in Creative Library

### State Management
- StateManagementDialog showing all application state as JSON
- Includes Audiences, Topics, Messages, Assets, Creatives, Feed, Keywords tabs
- Creatives tab added for debugging creative data

## How to Use

### For Claude Code

When starting a new session, Claude Code can reference these files to:
- Understand the codebase architecture quickly
- Find the right files for specific tasks
- Follow established patterns and workflows
- Debug common issues
- Implement new features consistently

### For Developers

You can read these files to:
- Onboard new team members
- Understand system architecture
- Learn common workflows
- Debug issues
- Plan new features

## Updating Context

As the codebase evolves, update these files to reflect:
- New components or features
- Changes to API endpoints
- Updated workflows
- New patterns or conventions
- Performance improvements
- Refactored code (update line counts!)

## Quick Reference

### Need to understand the system?
→ Start with `context-quickstart.md`

### Working on a specific component?
→ Check `context-components.md`

### Debugging an API issue?
→ Check `context-api.md`

### Implementing a workflow?
→ Check `context-workflows.md`

### Understanding architecture decisions?
→ Check `context-architecture.md`

### Debugging a specific issue?
→ Check relevant skill in `skills/`

## Tips for Claude Code

To make best use of these context files:

1. **Start with quickstart** - Get oriented quickly
2. **Reference specific files** - Link to exact sections when explaining
3. **Follow established patterns** - Use patterns documented in workflows
4. **Update context** - Suggest updates when patterns change
5. **Use line numbers** - Reference specific locations (e.g., `Matrix.jsx:1530`)
6. **Check for refactoring** - Component line counts may change significantly

## Context File Structure

```
.claude/
├── README.md                      # This file
├── CONTEXT_INDEX.md               # Quick navigation index
├── settings.local.json            # Claude Code settings
├── context-quickstart.md          # Quick start guide
├── context-architecture.md        # Architecture overview
├── context-workflows.md           # Common workflows
├── context-components.md          # Component reference
├── context-api.md                 # API documentation
└── skills/                        # Specialized guides
    ├── debug-sync.md
    ├── analyze-pattern.md
    ├── test-asset-upload.md
    ├── create-share.md
    └── optimize-performance.md
```

## Maintenance

### When to Update

Update context files when:
- Adding new major features
- Changing core architecture
- Updating API endpoints
- Modifying workflows
- Discovering new patterns
- Fixing recurring issues
- **Refactoring components** (update line counts!)

### How to Update

1. Make changes to relevant context files
2. Keep examples up to date
3. Update line numbers if files change significantly
4. Add new skills for new complex workflows
5. Remove outdated information
6. **Update CONTEXT_INDEX.md** to reflect changes

### Version History

Context files should be kept in sync with the codebase. Use git to track changes:

```bash
git log .claude/
```

## Component Line Count Reference

Quick reference for current component sizes (as of v2.0.0):

| Component | Lines | Notes |
|-----------|-------|-------|
| Matrix.jsx | 1,530 | Main matrix grid |
| MessageEditorDialog.jsx | 1,320 | Message editor |
| PreviewView.jsx | 1,440 | Share gallery viewer |
| TreeView.jsx | 902 | Decision tree |
| ClaudeChat.jsx | 767 | AI integration |
| **MediaLibraryBase.jsx** | **674** | **NEW: Shared base for Assets/Creatives** |
| CreativeLibrary.jsx | 525 | Reduced from 931 |
| Assets.jsx | 377 | Reduced from 1,103 |
| Templates.jsx | 1,107 | Template management |
| useMatrix.js | 355 | Core data hook |
| server.js | 1,400+ | Backend server |
| sheets.js | 520 | Google Sheets API |
| patternEvaluator.js | 240 | Pattern evaluation |

## Benefits

✓ **Faster Development** - No need to re-explore codebase each session
✓ **Consistency** - Follow established patterns and conventions
✓ **Better Debugging** - Quick reference for common issues
✓ **Easier Onboarding** - Comprehensive documentation for new developers
✓ **Improved Communication** - Shared understanding of architecture
✓ **Reduced Errors** - Clear workflows prevent mistakes
✓ **Code Reuse** - MediaLibraryBase demonstrates effective component composition

## Feedback

If you find these context files helpful or have suggestions for improvement, please update them directly or add notes for the next session.

---

**Last Updated**: 2025-10-25
**Version**: 2.0.0
**Major Changes**: Added MediaLibraryBase, Google Drive integration, virtual scrolling, updated component line counts
