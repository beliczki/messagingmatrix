# Claude for Chrome - Orchestrator Integration

## Purpose
Use Claude for Chrome to capture screenshots and console logs for debugging and reporting.

## Screenshot Workflow

### Taking Screenshots
1. Navigate to the page you need to capture
2. Use Chrome DevTools or Claude for Chrome to take screenshot
3. Save to: `.orchestrator/reports/chrome/`

### Naming Convention
`YYYY-MM-DD_HH-MM_description.png`

Examples:
- `2025-01-15_14-30_login-page-error.png`
- `2025-01-15_14-32_console-network-tab.png`
- `2025-01-15_14-35_ui-after-fix.png`

## Console Log Capture

### Saving Console Logs
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Right-click → Save as... 
4. Save to: `.orchestrator/reports/chrome/YYYY-MM-DD_console-log.txt`

### Network Tab Capture
1. Open DevTools → Network tab
2. Reproduce the issue
3. Right-click → Save all as HAR
4. Save to: `.orchestrator/reports/chrome/YYYY-MM-DD_network.har`

## Report Template

Create a markdown file alongside screenshots:

**File**: `.orchestrator/reports/chrome/YYYY-MM-DD_report.md`

```markdown
# Chrome Report

**Date**: YYYY-MM-DD HH:MM
**Page**: [URL]

## Screenshots
- screenshot1.png - Description
- screenshot2.png - Description

## Console Errors
[Paste any relevant errors]

## Notes
[What you observed]
```

## Quick Commands for Claude for Chrome

When instructed by the Orchestrator, you can tell Claude for Chrome:

- "Take a screenshot of this page and save it"
- "Show me the console errors"
- "Capture the network requests"
- "What errors do you see on this page?"
