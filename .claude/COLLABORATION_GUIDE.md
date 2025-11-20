# Collaboration Guide - Claude & User Working Agreement

**Created:** 2025-01-20
**Purpose:** Document our agreed-upon collaboration patterns to work more effectively together
**Scope:** Applies to all projects we work on together

> 📝 **Note:** This is a universal guide. Copy it to any project's `.claude/` directory, or keep one master copy for reference. Project-specific examples are in the "Project History" section at the bottom.

---

## 🤝 Our Working Agreement

### User Commitments
1. **Start with context** - Use the session starter template
2. **Narrate observations** - Explain what you see in screenshots
3. **Ask "why"** - Question solutions to understand reasoning
4. **Share attempts** - Mention what you've already tried
5. **Confirm understanding** - Paraphrase before executing commands
6. **Question suggestions** - Challenge me if something doesn't make sense
7. **Celebrate progress** - Acknowledge wins along the way
8. **Share constraints** - Time limits, access, learning preferences

### Claude Commitments
1. **Explain WHY, not just WHAT** - Provide reasoning behind solutions
2. **Check understanding** - Ask "Does this make sense?"
3. **Admit uncertainty** - Say "I think..." vs acting certain when unsure
4. **Celebrate progress** - Acknowledge wins along the way
5. **Provide context** - Explain what problems solutions solve
6. **Be patient** - Complex issues may need multiple iterations

---

## 📋 Session Starter Template

Copy this at the start of complex tasks:

```markdown
**Goal:** [What I'm trying to achieve]
**Current State:** [What's working / what's broken]
**Environment:** [Local/Hetzner/Plesk, OS, relevant versions]
**Context:** [What we did last time / what I've tried already]
**Constraints:** [Time limits, access restrictions, learning preferences]
**First Issue:** [Describe using What/Why/How pattern]
```

### Example Session Starters

**Example 1: Deployment Issue**
```markdown
**Goal:** Deploy application to production with SSL
**Current State:** App works on HTTP, HTTPS fails with SSL errors
**Environment:** Ubuntu 22.04, Node 18.x, nginx 1.24, PM2
**Context:** DNS configured yesterday, pointed to server IP
**Constraints:** Need to finish in 1 hour, want to understand SSL process
**First Issue:**
- What: SSL certificate setup failing
- Why: DNS not resolving (NXDOMAIN error)
- How: [screenshot + error text]
```

**Example 2: Bug Fix**
```markdown
**Goal:** Fix data loading issue in dashboard
**Current State:** Dashboard shows loading spinner indefinitely
**Environment:** React 18, TypeScript, running locally
**Context:** Worked yesterday, broke after updating API endpoint
**Constraints:** 30 minutes, need quick fix for demo
**First Issue:**
- What: API calls returning 404
- Why: Endpoint URL changed but frontend not updated
- How: Browser console shows "GET /api/old-endpoint 404"
```

**Example 3: New Feature**
```markdown
**Goal:** Add user authentication with JWT
**Current State:** App has no auth, all routes public
**Environment:** Node/Express backend, React frontend
**Context:** New project, no auth implemented yet
**Constraints:** 2 hours available, want to understand JWT concepts
**First Issue:**
- What: Need to plan authentication flow
- Why: Currently anyone can access sensitive data
- How: [diagram or description of current architecture]
```

---

## 💬 Communication Patterns

### When Sharing Errors
- ✅ **Screenshot + paste error text** - Visual context + searchable text
- ✅ **"Here's what I see..."** - Narrate observations
- ✅ **"I already tried X and Y"** - Share previous attempts
- ❌ Screenshot only - Missing searchable text
- ❌ "It's broken" - Too vague

### When Executing Commands
- ✅ **"So this will [what it does]?"** - Confirm understanding
- ✅ **"Why does this fix it?"** - Ask for reasoning
- ✅ **Share results immediately** - Show success or failure
- ❌ Running commands without confirming
- ❌ Not sharing output

### During Debugging
- ✅ **"Progress: X is working now!"** - Celebrate wins
- ✅ **"Stuck on: Y is still failing"** - Share blockers
- ✅ **"Question: Why not try Z?"** - Suggest alternatives
- ❌ Silent execution without feedback
- ❌ Getting frustrated without asking for help

---

## 🎯 What/Why/How Pattern for Issues

Use this structure to describe problems:

**What:** The observable symptom
**Why:** The underlying cause (if known)
**How:** Evidence (logs, errors, screenshots)

### Example
```markdown
**What:** Google Sheets data loading without authentication
**Why:** /api/sheets/* endpoints have no auth middleware
**How:**
- Incognito browser can access data
- Network tab shows 200 OK responses
- [screenshot of DevTools Network tab]
```

---

## 📊 Information Hierarchy

### Always Include (Priority 1)
- Goal/objective
- Current environment
- Error messages (text + screenshot)
- What you've tried

### Include When Relevant (Priority 2)
- Time constraints
- Learning preferences
- Previous context
- System constraints

### Optional (Priority 3)
- Background information
- Alternative approaches considered
- Long-term plans

---

## 🚀 Session Types & Approaches

### Quick Fix Sessions
- **Goal:** Fix specific bug/issue fast
- **Approach:** Jump to solution, minimal explanation
- **Communication:** Show error, get fix, confirm working

### Learning Sessions
- **Goal:** Understand concepts while solving
- **Approach:** Explain reasoning, theory, alternatives
- **Communication:** Ask "why" frequently, request clarification

### Complex Deployments
- **Goal:** Multi-step implementation
- **Approach:** Plan → Execute → Verify in stages
- **Communication:** Use TodoWrite, celebrate milestones

---

## ✅ Accountability Checkpoints

### Every Session Start
- [ ] User provides context using template
- [ ] Claude acknowledges and confirms understanding
- [ ] Both parties clarify constraints

### During Work
- [ ] Claude explains "why" for each solution
- [ ] User confirms understanding before executing
- [ ] Both celebrate small wins
- [ ] User questions unclear suggestions

### Session End
- [ ] Verify solution works
- [ ] Document what was learned
- [ ] Note any follow-up tasks
- [ ] Update todos if applicable

---

## 📝 Project History (Reference Examples)

> Add notable sessions from any project to track patterns and lessons learned.

### Project: Messaging Matrix

#### Hetzner Deployment (2025-01-20)
**Task:** Deploy React/Node app to Hetzner with SSL and Google Sheets integration

**What worked well:**
- User provided consistent screenshots
- Stayed patient through 6+ iterations on crypto issue
- Shared both server terminal and browser console
- Executed commands precisely

**What we improved:**
- Started without full context
- Could have asked "why" more often
- Text error messages would have helped

**Lesson:** Complex issues (crypto/jose library compatibility) need patience and iteration. Environmental differences (browser vs Node.js) can be subtle.

---

### Project: [Future Project Name]

#### [Session Name] (Date)
**Task:** [Brief description]

**What worked well:**
- [Success patterns]

**What we improved:**
- [Areas that needed work]

**Lesson:** [Key takeaway]

---

_Add new project entries above this line_

---

## 🔄 Review & Update

**Review this guide:**
- When starting complex projects
- After frustrating sessions (what went wrong?)
- When collaboration feels off
- **Weekly feedback round** (see below)

**Update when:**
- We discover new patterns that work
- Something consistently causes friction
- Tools or processes change
- Insights from weekly feedback

---

## 📅 Weekly Feedback Round

**Schedule:** Every weekend (Saturday or Sunday)
**Purpose:** Close out the previous week, plan for the next
**Duration:** 10-15 minutes
**Format:** Quick retrospective

### Feedback Template

**Week of:** [Date range]

#### What Worked Well ✅
- [Example: Started sessions with context template]
- [Example: Caught errors early by asking "why"]
- [What did we do that felt smooth/effective?]

#### What Needs Improvement 🔄
- [Example: Forgot to share what I'd already tried]
- [Example: Rushed without confirming understanding]
- [What caused friction or confusion?]

#### Action Items for Next Week 🎯
- [ ] [Example: User will paste error text, not just screenshots]
- [ ] [Example: Claude will explain theory when requested]
- [ ] [What will we specifically do differently?]

#### Wins to Celebrate 🎉
- [Example: Successfully deployed to Hetzner with SSL]
- [What did we accomplish together?]

### Questions to Ask Each Other

**For User to Ask Claude:**
- Did I provide enough context this week?
- Was I asking good questions?
- Did I interrupt your flow with unclear requests?
- What could I do better?

**For Claude to Ask User:**
- Did I explain things clearly?
- Was I too verbose or too brief?
- Did I check your understanding enough?
- What would help you learn better?

### Commitment Check
- [ ] User followed session starter template: ___% of time
- [ ] User asked "why" when curious: ___% of time
- [ ] Claude explained reasoning: ___% of time
- [ ] Claude checked understanding: ___% of time
- [ ] Both celebrated wins: ___% of time

---

## 🎓 Key Principles

1. **Context is king** - Always start with the full picture
2. **Question everything** - No suggestion is too obvious to ask about
3. **Celebrate progress** - Complex work needs encouragement
4. **Be honest** - "I don't know" or "I don't understand" are valid
5. **Iterate together** - Solutions may take multiple attempts
6. **Learn, don't just execute** - Understand the "why"

---

**Last Updated:** 2025-01-20
**Scope:** Universal - applies to all projects
**Weekly Feedback Schedule:** Every weekend (Saturday or Sunday)
**Next Feedback Round:** Weekend of 2025-01-25/26
**Next Major Review:** When starting next complex project

---

## 🔄 Using This Guide Across Projects

**Option 1: Master Copy**
- Keep one master copy (like this one)
- Reference it from any project
- Update with lessons from all projects

**Option 2: Per-Project Copy**
- Copy to each project's `.claude/` directory
- Customize per-project if needed
- Merge learnings back to master

**Recommended:** Keep master copy + add project-specific notes in "Project History" section

---

_This is a living document. Update it as we learn what works across all our projects!_
