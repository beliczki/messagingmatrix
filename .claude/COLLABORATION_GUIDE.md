# Collaboration Guide - Claude & User Working Agreement

**Created:** 2025-01-20
**Purpose:** Document our agreed-upon collaboration patterns to work more effectively together

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

### Example Session Starter
```markdown
**Goal:** Deploy messaging matrix to production subdomain
**Current State:** App works on HTTP, HTTPS fails with SSL errors
**Environment:** Hetzner Ubuntu 22.04, Node 18.19.1, nginx 1.24, PM2
**Context:** DNS configured yesterday, pointed to 46.224.60.159
**Constraints:** Need to finish in 1 hour, want to understand SSL process
**First Issue:**
- What: Certbot SSL setup failing
- Why: DNS not resolving (NXDOMAIN error)
- How: [screenshot + error text]
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

## 📝 Past Successes (Reference Examples)

### Hetzner Deployment (2025-01-20)
**What worked well:**
- User provided consistent screenshots
- Stayed patient through 6+ iterations on crypto issue
- Shared both server terminal and browser console
- Executed commands precisely

**What we improved:**
- Started without full context
- Could have asked "why" more often
- Text error messages would have helped

**Lesson:** Complex issues (crypto/jose) need patience and iteration

---

## 🔄 Review & Update

**Review this guide:**
- When starting complex projects
- After frustrating sessions (what went wrong?)
- When collaboration feels off
- Monthly check-in

**Update when:**
- We discover new patterns that work
- Something consistently causes friction
- Tools or processes change

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
**Next Review:** When starting next complex project

_This is a living document. Update it as we learn what works!_
