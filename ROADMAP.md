# Roadmap

Living document. The place to look for "what's being worked on, what's next, what's parked."

- **Shipped work** → [CHANGELOG.md](./CHANGELOG.md) (by version).
- **Versioning & bump rules** → see `## Versioning` in [CLAUDE.md](./CLAUDE.md).
- **Active handoff for the demo instance infra** → [TODO-DEMO-INFRA.md](./TODO-DEMO-INFRA.md).

Item tags:
- **Size**: S (hours) · M (days) · L (weeks)
- **Status**: `[ ]` not started · `[~]` in progress · `[x]` done → moved to CHANGELOG

---

## Current milestone — Demo instance (ReBank brand)

Target URL: `demo.messagingmatrix.ai` · Port 3006 · Path `/var/www/messagingmatrix-demo`.

Purpose: client-agnostic pitch tool + LinkedIn/beliczki.hu portfolio piece. Fourth sibling alongside erste / telekom / proficio.

### Infrastructure (authoritative checklist: [TODO-DEMO-INFRA.md](./TODO-DEMO-INFRA.md))

- [ ] `feat/demo-instance` branch with server-side directory, `.env`, PM2 entry, Nginx config **— S**
- [ ] `docs/DEMO_INSTANCE_SETUP.md` notes file with exact commands for user to run **— S**
- [ ] Repo-side triplet→quartet updates (README, DEPLOYMENT_HETZNER, scripts) **— S**
- [ ] `TODO-DEMO-CONTENT.md` checklist file for manual steps **— S**
- [ ] Draft PR on branch, not merged **— S**

### Human-only (not executable by agents)

- [ ] DNS A record `demo.messagingmatrix.ai` → `46.224.60.159`
- [ ] Google Sheet created, shared with service account
- [ ] `GOOGLE_SHEET_ID` set in `/var/www/messagingmatrix-demo/.env`
- [ ] `ln -s` Nginx site, `nginx -t`, `systemctl reload nginx`, certbot
- [ ] `pm2 start mm-server-demo`, `pm2 save`

### Content (ReBank brand — confirmed 2026-04-18)

Source: brain note `ce9ab350-87a7-4e22-9cef-17f8d0e07871`. Invented European full-service FS brand. Frame: "same offer, many framings per audience×context cell."

- [ ] Audiences.csv — 10 rows (7 private + 3 corporate, lifecycle/behavioral/data-defined) **— M**
- [ ] Topics.csv — 15 rows (contexts/moments/channels, not products) **— M**
- [ ] Messages.csv — ~45 rows covering 7 core offers × audience×context cells **— M**
- [ ] Assets.csv + Creatives.csv — brand-name swap on existing scaffold **— S**
- [ ] TRANSLATION_GUIDE.md — FS-appropriate HU/EN/DE snippets **— S**
- [ ] DEMO_TALK_TRACK.md — pitch: "addressable-context-content machine" **— S**
- [ ] LinkedIn paragraph — repositioned **— S**

---

## Active backlog

### Matrix UX — multi-select + batch drag

Migrated from the old `MATRIX_FINETUNING_LIST.md` (now archived). Target files: `src/components/Matrix.jsx`, `src/components/MatrixGridView.jsx`.

- [ ] Long-press → enter multi-select mode; ESC or outside-click to exit **— M**
- [ ] Batch drag&drop selected cards (same-topic constraint); count badge on drag preview **— M**
- [ ] Valid/invalid drop-zone highlight (green/red) **— S**
- [ ] Hide "Add Message" buttons during drag (match space+pan behavior) **— S**
- [ ] Shift+Click range select, select-all-in-cell/row/column **— S, low**
- [ ] Bulk edit / bulk delete for selected messages **— M, low**

### AI-assisted Matrix operations

- [ ] AI assist: add Audience (context-aware suggestion flow) **— M**
- [ ] AI assist: add Topic **— M**
- [ ] AI assist: add Message **— M**

### General

- [ ] Monitoring & analytics dashboard **— L**
- [ ] User management UI polish **— M**
- [ ] Bulk import/export **— M**
- [ ] Version history & rollback (for matrix data) **— L**

---

## Parking lot (intentionally deferred)

Good ideas without a current owner or concrete milestone. Pulled from brain notes, TODO.md, and README.md's old roadmap.

- **Decouple the two Adform paths that share `src/templates/html/index.html`** — the template is the source of truth for both (a) dynamic Adform ads (raw template uploaded to Adform, `DynAdsHelper.getVars` drives content from the feed) and (b) static ads downloaded from the share ZIP (server bakes content via `populateTemplate`, ZIP uploaded as a regular HTML5 banner). Today the `<!-- UNCOMMENT THESE FOR ADFORM UPLOAD -->` block is the only real point of divergence — our server uncomments it for the share path, but anyone publishing the dynamic variant must do it manually, which is a foot-gun. Option A: build-step to produce two output artifacts (one with Adform libs live, one with `onerror`-suppressed loads for our local `/share/` iframe). Option B: keep one template but detect local-preview via `?local=1` or origin check and skip the Adform libs in that case. Option C: split into two templates once the dynamic and static paths drift further. Not urgent — current state works after the livepreview click-handler fix (4.5.0). **— M**
- server.js dispatcher-split refactor (monolithic 4,300 LOC) — referenced in brain note `07116d9c-...` as the same refactor Bizi's `api/chat/route.ts` just completed
- Test framework (no tests currently — documented in CLAUDE.md)
- Collaborative editing / real-time sync across multiple users
- Advanced reporting & insights
- API for external integrations
- Webhook support for automation
- Performance analytics (beyond the existing Drive proxy cache)
- Multi-language support
- Permission system beyond admin/user/demo (granular read/write)
- Audit log

---

## Shipped

See [CHANGELOG.md](./CHANGELOG.md) for the full shipped history, organized by version.
