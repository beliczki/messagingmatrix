# Orchestrator Configuration

## Agents

| Agent | Role | Location |
|-------|------|----------|
| Claude.ai Chat | Orchestrator - planning, coordination | Browser chat |
| Claude Code | Coding agent - file ops, code changes | Terminal |
| Claude for Chrome | Browser agent - screenshots, console | Chrome extension |

## File Locations

- **Tasks**: `.orchestrator/tasks/current-task.md`
- **Claude Code Reports**: `.orchestrator/reports/claude-code/`
- **Chrome Screenshots**: `.orchestrator/reports/chrome/`

## Workflow

1. Orchestrator writes task to `current-task.md`
2. User copies task to appropriate agent
3. Agent executes and writes report
4. User shares report back with Orchestrator
5. Orchestrator reviews and plans next steps

## Naming Conventions

### Screenshots
`YYYY-MM-DD_HH-MM_description.png`
Example: `2025-01-15_14-30_login-error.png`

### Reports
`YYYY-MM-DD_task-name.md`
Example: `2025-01-15_fix-sync-bug.md`
