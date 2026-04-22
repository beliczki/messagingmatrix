# TODO-DEMO-INFRA.md — demo.messagingmatrix.ai infra scaffold

**Marker:** TODO-DEMO-INFRA-v1
**Written:** 2026-04-19 (late night, overnight handoff to Claude Code)
**Target:** Claude Code running unattended overnight
**Repo:** `~/messagingmatrix` (clone of `beliczki/messagingmatrix`)
**Server:** Hetzner, `46.224.60.159` (same host as `brain.beliczki.hu` — key at `~/.ssh/id_ed25519_hetzner`)

---

## Read first — context you need

- `./CLAUDE.md` — critical rule about Google Sheets as source of truth
- `./docs/DEPLOYMENT_HETZNER.md` — the deployment pattern you're replicating
- `./docs/REACT_PERFORMANCE_REMOUNT_FIX.md` and `./docs/QUICK_FIX_REMOUNT.md` — DO NOT trigger these bugs
- Brain thought `07116d9c-7e13-4028-b4d8-9bf006d0467d` (title: "Messaging Matrix architektúra") — triplet architecture description + demo instance stub
- Brain thought `11e3aa53-f685-4c29-8d13-c1b8fcdd5e2f` — example of a good handoff doc (same shape as this one)

Do NOT read the entire codebase. Do NOT start exploring for improvements. Execute the scoped plan below.

---

## Hard boundaries — READ TWICE

### Scope: INFRA ONLY

- You are creating a FOURTH sibling instance alongside erste / telekom / proficio, called **demo**.
- Port **3006**, path **`/var/www/messagingmatrix-demo`**, PM2 name **`mm-server-demo`**, URL target **`demo.messagingmatrix.ai`**.
- Reuse the existing `server.js` (4,300-line monolith) AS-IS. Do not refactor it.
- Reuse the existing React app AS-IS. Do not touch `src/`.

### Non-goals — EXPLICIT

The following are OUT OF SCOPE. If you find yourself doing any of these, STOP and leave a note:

- ❌ **No content creation.** Do NOT invent audiences, topics, messages, keywords, sample creatives, share galleries, or any demo content. That's a human-driven sprint tomorrow.
- ❌ **No React component changes.** `src/` is immutable for this task. The remount bug has eaten 3+ hours × 3 times already.
- ❌ **No `server.js` refactoring.** Even if you see the 4,300-line monolith. Even if you see duplication. Even if you see obvious wins. Not this task.
- ❌ **No `useMatrix.js` changes.** The Sheets-as-source-of-truth rule in CLAUDE.md is non-negotiable. Any code path that moves matrix data to SQLite breaks everything.
- ❌ **No Chroma DB / vector DB / new storage engine.** There was user confusion about "new chroma db" — ignore. Demo instance uses SQLite + Sheets per the existing triplet pattern.
- ❌ **No DNS creation.** You can't do it anyway. Document as a human TODO.
- ❌ **No Google Sheet creation.** You can't do it from SSH. Document as a human TODO with the exact sheet structure required.
- ❌ **No merging to `main`.** All work on `feat/demo-instance` branch. User reviews in the morning.
- ❌ **No `pm2 start` on the new instance yet.** The Sheet ID won't exist yet, so starting would crash. Config goes in; start is user's call after they create the Sheet.
- ❌ **No Nginx reload / site enable.** Write the config file; DO NOT symlink into `sites-enabled`. User enables after DNS propagates.

---

## Stop conditions

**Immediately stop, commit work-so-far to the feature branch, and leave a `HANDOFF_NOTE.md` in the repo root** if any of these happen:

1. You need a decision about Chroma / vector DB / architecture
2. The React remount bug surfaces (even if you're not in React, some code path may trigger it)
3. `server.js` needs any change to support the demo instance — this should NOT happen; if it does, the task is miscoped
4. Port 3006 is already in use on the Hetzner server
5. A pre-existing `/var/www/messagingmatrix-demo` directory exists
6. `feat/demo-instance` branch already exists with commits you didn't make
7. The SSH deploy sequence (pm2 stop + fuser -k) is needed — it shouldn't be for this task; if it is, something's wrong
8. You've been running for >90 minutes with no acceptance criterion green — you're probably stuck; write what you found and stop

---

## Prereqs to verify BEFORE starting work

Run these first; do not start work until all pass:

```bash
# 1. Repo clean
cd ~/messagingmatrix && git status --short
# Expect: empty output or only this TODO-DEMO-INFRA.md untracked

# 2. On main, up to date
git branch --show-current && git pull --ff-only

# 3. SSH to Hetzner works
ssh -i ~/.ssh/id_ed25519_hetzner -o ConnectTimeout=10 root@46.224.60.159 'hostname && ls /var/www/'
# Expect: messagingmatrix, messagingmatrix-telekom, messagingmatrix-proficio (and others)

# 4. Port 3006 free on Hetzner
ssh -i ~/.ssh/id_ed25519_hetzner root@46.224.60.159 'ss -ltn | grep :3006 || echo FREE'
# Expect: FREE

# 5. No existing demo instance
ssh -i ~/.ssh/id_ed25519_hetzner root@46.224.60.159 'ls /var/www/messagingmatrix-demo 2>&1'
# Expect: No such file or directory
```

If ANY prereq fails, stop and write a `HANDOFF_NOTE.md` describing which one.

---

## Acceptance criteria (execute in order, commit after each)

Work on branch `feat/demo-instance`. One commit per numbered item. Commit messages follow the repo style (check `git log --oneline -5` for tone).

### 1. Branch + baseline
- [ ] Create `feat/demo-instance` off `main`
- [ ] This TODO-DEMO-INFRA.md file committed to the branch at repo root (user can remove before merge if they want)
- [ ] Commit: "chore: add demo-instance infra handoff"

### 2. Server-side directory
- [ ] On Hetzner: copy `/var/www/messagingmatrix-proficio` → `/var/www/messagingmatrix-demo` (preserving structure, NOT copying `node_modules` — re-install fresh)
  - `rsync -a --exclude node_modules --exclude db/messaging-matrix.db --exclude logs --exclude '.env*' /var/www/messagingmatrix-proficio/ /var/www/messagingmatrix-demo/`
- [ ] `cd /var/www/messagingmatrix-demo && npm install --omit=dev`
- [ ] Empty `db/` directory created (Drizzle migrations will populate fresh DB on first run — do not copy Proficio's data)
- [ ] `logs/` directory created
- [ ] No commit — this is server-side infra; document what you did in the commit message of item 4

### 3. Server-side `.env`
- [ ] Copy `/var/www/messagingmatrix-proficio/.env` → `/var/www/messagingmatrix-demo/.env` (use `cp` on Hetzner — do NOT pull .env into the git repo or into this chat)
- [ ] Edit `.env` on Hetzner, changing ONLY:
  - `PORT=3006`
  - `CORS_ORIGIN=https://demo.messagingmatrix.ai` (check actual var name in the file — may be CORS_ORIGINS or similar)
  - `GOOGLE_SHEET_ID=TBD-USER-WILL-FILL` (check actual var name)
  - Anything else that's client-specific (DB path, instance name) — review each line
- [ ] `chmod 600` the file
- [ ] No commit — server-side only

### 4. PM2 ecosystem entry
- [ ] On Hetzner, find how the triplet is currently registered in pm2 (likely one of: `/var/www/messagingmatrix/ecosystem.config.cjs`, a shared ecosystem, or ad-hoc `pm2 start` lines in `/root/.pm2/dump.pm2`). Document what you found.
- [ ] Add `mm-server-demo` entry matching the proficio pattern, port 3006, cwd `/var/www/messagingmatrix-demo`
- [ ] DO NOT `pm2 start` it yet. DO `pm2 save` if you add to the dump only after starting — so don't save either.
- [ ] Commit on the feature branch: a notes file `docs/DEMO_INSTANCE_SETUP.md` with what you changed + exact commands to run when user is ready to start

### 5. Nginx site config
- [ ] On Hetzner, copy `/etc/nginx/sites-available/proficio.messagingmatrix.ai` (or equivalent — look at how the existing sites are named) → `/etc/nginx/sites-available/demo.messagingmatrix.ai`
- [ ] Edit to point to port 3006 and `server_name demo.messagingmatrix.ai;`
- [ ] DO NOT symlink into `sites-enabled/`. DO NOT `nginx -t` or reload.
- [ ] In the notes file from item 4, document the file path + the three commands user runs later (ln -s, nginx -t, systemctl reload nginx) + the certbot command for the SSL cert (look at how erste/proficio got their certs)

### 6. Repo-side changes on `feat/demo-instance`
- [ ] Add `demo` to any client list in the repo (grep for `erste`, `telekom`, `proficio` in non-`src/` files — typical spots: README.md, docs/DEPLOYMENT_HETZNER.md, ecosystem.config.cjs if it's in-repo, any scripts under `scripts/`). If you find a triplet list, make it a quartet.
- [ ] If instance config lives in `instances/` folder — create an `instances/demo/` mirroring `instances/proficio/` structure with client-agnostic defaults
- [ ] Update `docs/DEPLOYMENT_HETZNER.md` to document the four-instance setup
- [ ] Commit per file OR one commit for the triplet→quartet transition — your call based on cohesion

### 7. Content handoff stub
- [ ] Create `TODO-DEMO-CONTENT.md` in repo root listing EVERYTHING the user needs to fill in:
  - [ ] Google Sheet creation — exact tab structure required (Audiences, Topics, Messages, Assets, etc.) — pull the structure from `docs/SPECIFICATION.md` or `docs/DATA_STORAGE_ARCHITECTURE.md`
  - [ ] Sheet sharing with the service account — email address, role
  - [ ] `GOOGLE_SHEET_ID` in `/var/www/messagingmatrix-demo/.env`
  - [ ] DNS A record: `demo.messagingmatrix.ai` → `46.224.60.159`
  - [ ] After DNS propagates: `ln -s` the nginx site, `nginx -t`, `systemctl reload nginx`, certbot cert
  - [ ] `pm2 start` the demo instance
  - [ ] Audiences content (list format, tone, target industries — flag these as decisions)
  - [ ] Topics content
  - [ ] Messages content
  - [ ] Sample creatives / share gallery — if any
- [ ] Commit: "docs: add TODO-DEMO-CONTENT checklist for user"

### 8. Summary commit
- [ ] Add a `## Review` section to the bottom of this file describing:
  - What worked out of the box (proficio clone pattern)
  - What needed adjustment
  - Anything surprising
  - Hours elapsed
- [ ] Commit: "docs: TODO-DEMO-INFRA review section"

### 9. Push to origin but DO NOT merge
- [ ] `git push origin feat/demo-instance`
- [ ] Create a PR draft via `gh pr create --draft` with title "demo.messagingmatrix.ai — infra scaffold (NOT ready to merge)" and body pointing to both this file and the content handoff

---

## Review (fill in at end)

### Prereq results
_What you found when running the verification commands._

### What worked
_Which acceptance items went smoothly._

### What needed adjustment
_Which items required tweaks beyond the plan._

### Surprises / flags for user
_Anything the user should know before continuing._

### Hours elapsed
_Wall-clock time from start to stop._

### Stop condition triggered?
_If yes, which one and at what step._
