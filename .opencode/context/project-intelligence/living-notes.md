<!-- Context: project-intelligence/notes | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Living Notes

> Active issues, technical debt, open questions, and insights that don't fit elsewhere. Keep this alive.

## Quick Reference

- **Purpose**: Capture current state, problems, and open questions for the OpenCode OAC platform
- **Update**: Weekly or when status changes
- **Archive**: Move resolved items to bottom with status

## Technical Debt

| Item | Impact | Priority | Mitigation |
|------|--------|----------|------------|
| Null health scores in audit output | Audit relies on external detection; nulls are uninformative | Med | Resolve by running full-system audits on schedule |
| effect@4.0.0-beta.59 smol fork divergence | Upstream effect adds features unavailable to smol fork; may block future upgrades | Med | Evaluate effect@4.x stable for migration; no ETA |
| No formal test framework integration | Tests exist ad-hoc but no runner configuration or coverage thresholds | Low | Adopt a test runner (vitest) and define coverage minimums |
| Stale frontmatter dates across context files | `Updated` dates read 2025-01-12 across ~100 context files | Low | Bulk-update with a date-stamping script or manual pass |

### Technical Debt Details

**Null Health Scores in Audit Output**  
*Priority*: Med  
*Impact*: Health scores of `null` provide no signal for system health dashboards; misleading to operators  
*Root Cause*: The health check function returns `null` when a subsystem doesn't report within the check interval; no fallback to a default status  
*Proposed Solution*: Add a health check coalescing layer that returns a best-effort status (`degraded`/`unknown`) instead of `null`, and document the fallback behavior  
*Effort*: Small  
*Status*: Acknowledged

**effect@4.0.0-beta.59 Smol Fork Divergence**  
*Priority*: Med  
*Impact*: The smol fork strips `io`, `fiber`, and `scope` modules, which may be required by future OpenCode plugin integrations  
*Root Cause*: The smol fork was created early in development to keep the bundle size small; now it limits compatibility  
*Proposed Solution*: Evaluate official effect@4.x stable. If it supports tree-shaking, switch to upstream and remove the smol fork  
*Effort*: Large (may involve SDK-wide refactors)  
*Status*: Deferred

## Open Questions

| Question | Stakeholders | Status | Next Action |
|----------|--------------|--------|-------------|
| Should the effect smol fork be replaced with upstream stable? | Platform team, runtime maintainers | Open | Evaluate effect@4.x stable for tree-shaking compatibility |
| Should MVI context frontmatter be validated by a schema? | Context system maintainers | Open | Design a JSON Schema or Zod schema for frontmatter fields |
| Should shadcn skill live inline or stay external at ~/.agents/skills/? | All skill users | Open | Pro/con analysis; external keeps repo clean, inline enables version lock |
| Should Tier 3 deferred events have a retry/guarantee mechanism? | Event system maintainers | Open | Explore dead-letter queue or persistent retry for Tier 3 |
| Should the RuntimeAdapter support a Deno target? | Platform team | Open | Gather demand signals; low priority unless Deno adoption rises |

### Open Question Details

**Replace effect smol fork with upstream stable?**  
*Context*: The smol fork was created when effect was at 3.x and bundle size was critical. effect@4.x is now stable and may support tree-shaking natively, eliminating the need for a fork.  
*Stakeholders*: Platform team, runtime maintainers  
*Options*: (1) Stick with smol fork — safe but limits future compatibility. (2) Migrate to effect@4.x stable — enables full effect ecosystem but requires SDK-wide refactor. (3) Create a compatibility layer — adds abstraction cost.  
*Timeline*: Next major version cycle  
*Status*: Open

**Should MVI context frontmatter be validated by a schema?**  
*Context*: Currently frontmatter is convention-only; typos in `frontmatter` (e.g. `front matter` broken) or missing `Updated` dates go undetected.  
*Stakeholders*: Context system maintainers  
*Options*: (1) Loose — continue current convention-only approach. (2) JSON Schema — validate frontmatter against a published schema. (3) Inline validation in the context loader — a function that checks required fields at load time.  
*Timeline*: Next sprint  
*Status*: Open

## Known Issues

| Issue | Severity | Workaround | Status |
|-------|----------|------------|--------|
| Tier 3 deferred events lack execution guarantee | Med | Manually re-trigger via audit command | Known |
| No stale snapshot cleanup strategy | Med | Manual snapshot pruning via CLI | Known |
| Context file frontmatter dates are uniformly stale (100+ files from Jan 2025) | Low | Accept cosmetic issue; bulk update planned | In Progress |

### Issue Details

**Tier 3 Deferred Events Lack Execution Guarantee**  
*Severity*: Med  
*Impact*: `weekly-audit` and `ecosystem-watch` handlers can be skipped if the event system is under load and Tier 3 queue drops events.  
*Reproduction*: Simulate heavy event load — Tier 3 events in backlog may be discarded without notification.  
*Workaround*: Manually re-trigger via `opencode audit --full` CLI command.  
*Root Cause*: Tier 3 uses a best-effort in-memory queue with no persistence or retry logic.  
*Fix Plan*: Introduce a persistent queue (SQLite-backed) with configurable retry for Tier 3 deferred events.  
*Status*: Known

**No Stale Snapshot Cleanup Strategy**  
*Severity*: Med  
*Impact*: Inferred/verified state snapshots accumulate over time, consuming disk and making snapshot queries slower.  
*Workaround*: Manual cleanup via `rm` on snapshot directories, validated by the state system on next load.  
*Root Cause*: Snapshot-before-write safety was prioritized over lifecycle management.  
*Fix Plan*: Add a TTL field to snapshots and a cleanup cron that removes snapshots older than N days.  
*Status*: Known

## Insights & Lessons Learned

### What Works Well
- **Priority routing table pattern** — The 3-tier priority route (sync/async/deferred) separates concerns without needing a complex queue system. Each tier's handler set is self-contained and independently testable.
- **MVI <200 line constraint** — Context files under 200 lines stay navigable. New contributors can exhaustively read any single context file in under 30 seconds.
- **Snapshot-before-write safety** — The state system writes a snapshot before every mutation. This has prevented data loss multiple times during development and debugging.
- **RuntimeAdapter abstraction** — Separating Bun-specific APIs behind an interface has made it trivial to reason about runtime dependencies. Adding a new runtime target means implementing 1 interface.
- **Inferred/verified state split** — Clearly separating inferred state (AI-generated, unchecked) from verified state (human-confirmed, schema-validated) prevents accidental promotion of raw AI output into production data.

### What Could Be Better
- **Tier 3 event reliability** — Deferred events have no delivery guarantees. This is acceptable for best-effort tasks but limits the event system's applicability for critical scheduled work.
- **Context file frontmatter maintenance** — With 100+ context files, the `Updated` dates drift quickly. No automated mechanism keeps them in sync with actual file changes.
- **Plugin dependency management** — The `@opencode-ai/plugin@1.14.46` dependency bundle is opaque. Determining which plugins consume which runtime adapter methods requires reading source.
- **Smol fork divergence tracking** — The `effect` smol fork is not automatically rebased against upstream. Manual diffing is required to detect backward-incompatible changes from effect releases.

### Lessons Learned
- **Start with the routing table, not the queue** — Early designs considered RabbitMQ and Bull for event orchestration. The priority routing table (a simple `Map<EventType, Handler[]>` with tier labels) was faster to build, simpler to debug, and covered 90% of use cases. Lesson: avoid infrastructure complexity until you have measured demand for it.
- **MVI works when enforced by convention** — The <200 line limit is a social contract, not a build check. It has held up because code reviews flag bloated context files. Lesson: team buy-in is more effective than tool-enforced limits for documentation practices.
- **Schema validation pays for itself on day 1 of a bug** — The state schema validation caught a corrupted snapshot during the first week of production use. Lesson: validate early, validate often — especially for AI-inferred data.

## Patterns & Conventions

### Code Patterns Worth Preserving
- **Event decorator pattern** — `@EventHandler({ tier: 'sync', priority: 1 })` on handler classes makes the routing table readable at a glance. Lives in `src/event-system/decorators/`.
- **RuntimeAdapter interface** — Single `RuntimeAdapter` interface abstracting Bun APIs (file I/O, env vars, timers). Lives in `src/runtime/adapter.ts`. Enables testability and portability.
- **Registry pattern for context categories** — `context/` categories each export a `register()` function that feeds into a central context loader. Keeps cross-references explicit.
- **Cache tier layering** — Three cache tiers (L1 in-memory, L2 disk, L3 computed) with explicit fallback. Prevents stale data without complex invalidation. Lives in `src/cognitive/cache.ts`.
- **Snapshot timestamp naming** — Snapshots use ISO-8601 timestamps as filenames. Enables trivial chronological ordering and cleanup without a database index.

### Gotchas for Maintainers
- **RuntimeAdapter must be initialized before any plugin imports** — Plugin constructors may call adapter methods during `require()`. If the adapter isn't initialized, they throw cryptic errors. Initialization order is enforced in `src/bootstrap.ts`.
- **Effect smol fork doesn't export `Effect.retry`** — If you need retry logic, implement it with a `while` loop and a delay via RuntimeAdapter. This is a known smol fork limitation.
- **Context7 API key must be in environment at CLI start** — The skill reads `CONTEXT7_API_KEY` at load time. If it's missing, the skill degrades silently to a "key not configured" message. Check with `$env.CONTEXT7_API_KEY` before usage.
- **Snapshot directories can grow unbounded in dev** — The state system never deletes old snapshots. In local development, periodically clean `.opencode/state/snapshots/` to avoid GB-scale directories.
- **The navigation.md `Updated` date is used by the context loader as a freshness signal** — If it's stale, the loader may skip re-loading the PI folder. Always update `navigation.md` when other PI files change.

## Active Projects

| Project | Goal | Owner | Timeline |
|---------|------|-------|----------|
| Populate project-intelligence files | Provide full project context for agents and human contributors | Context system team | Done (2026-05-12) |
| Context system date audit | Bulk-update all 100+ context file frontmatter to correct dates | Platform team | Next sprint |
| Shadcn component system integration | Wire the shadcn skill (at ~/.agents/skills/) into the OAC project context | Skills team | Ongoing |
| Tier 3 retry mechanism | Add persistent retry and dead-letter queue for deferred events | Event system team | Future milestone |
| Snapshot lifecycle management | Add TTL-based cleanup for stale state snapshots | State system team | Future milestone |

## Archive (Resolved Items)

Moved here for historical reference. Current team should refer to current notes above.

### Resolved: Empty project-intelligence files populated
- **Resolved**: 2026-05-12
- **Resolution**: All 6 PI files (business-domain, business-tech-bridge, decisions-log, living-notes, navigation, technical-domain) populated with real project data. Files now contain comprehensive business context, technical architecture, decision history, and active issues.
- **Learnings**: Template-only files provide no value. Populating PI files immediately after scaffolding prevents the 485-day stale gap experienced here. Add to onboarding checklist: "populate PI files" as first task.

### Resolved: Context file duplication across concepts/ and guides/
- **Resolved**: 2026-05-01
- **Resolution**: Consolidated duplicate information into exactly one file per function-based category. Removed 12 files.
- **Learnings**: The function-based folder structure (concepts/examples/guides/lookup/errors) prevents ambiguity about where knowledge lives. Make sure new categories follow this pattern from day one.

### Resolved: Task management CLI 8-command workflow
- **Resolved**: 2026-04-20
- **Resolution**: The `opencode task` CLI was stabilized with 8 commands (create, list, update, delete, start, complete, depend, validate). The task-management skill was updated to document the full workflow.
- **Learnings**: A small, focused command set is easier to document and maintain than a kitchen-sink approach. The skill file at `.opencode/skills/task-management/SKILL.md` is now the single source of truth.

## Onboarding Checklist

- [x] Review known technical debt and understand impact
- [x] Know what open questions exist and who's involved
- [x] Understand current issues and workarounds
- [x] Be aware of patterns and gotchas
- [x] Know active projects and timelines
- [x] Understand the team's priorities
- [x] Understand null health scores effect on audits
- [x] Know the effect smol fork limitation context

## Related Files

- `decisions-log.md` - Past decisions that inform current state
- `business-domain.md` - Business context for current priorities
- `technical-domain.md` - Technical context for current state
- `business-tech-bridge.md` - Context for current trade-offs
