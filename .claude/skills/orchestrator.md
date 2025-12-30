# Orchestrator Integration Skill

## Purpose
This skill enables Claude Code to work within an orchestrated workflow, receiving tasks from and reporting to the Orchestrator (Claude.ai Chat).

## Reading Tasks

Before starting work, check for tasks:

```bash
cat .orchestrator/tasks/current-task.md
```

## Writing Reports

After completing a task, write a report:

**Location**: `.orchestrator/reports/claude-code/YYYY-MM-DD_task-name.md`

**Report Template**:
```markdown
# Task Report

**Date**: YYYY-MM-DD HH:MM
**Task**: [Brief description]

## What Was Done
- 

## Files Changed
- 

## Testing Done
- 

## Issues/Notes
- 

## Status
[ ] Complete
[ ] Needs Review
[ ] Blocked
```

## Workflow Commands

```bash
# Check current task
cat .orchestrator/tasks/current-task.md

# List previous reports
ls -la .orchestrator/reports/claude-code/

# Create new report
touch .orchestrator/reports/claude-code/$(date +%Y-%m-%d)_task-name.md
```

## Communication Protocol

1. **Read** the task from `current-task.md`
2. **Execute** the steps described
3. **Write** a report to `reports/claude-code/`
4. **Notify** the user that the task is complete

## Important Notes

- Keep reports concise but complete
- Always list files changed
- Note any unexpected issues
- Suggest next steps if applicable
