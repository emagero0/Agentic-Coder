# OpenAgentsControl — Event System

The event system makes the OAC framework reactive. Filesystem changes, dependency updates,
and tool executions trigger analysis pipelines that produce recommendations.

**Key rule**: Event handlers never modify production code. They produce reports and update
inferred state only.

---

## Architecture

```
OpenCode Runtime Event
        ↓
   .opencode/tool/events/index.ts   ← Plugin entry point
        ↓
   events/router/priority-router.ts  ← Classifies and routes events
        ↓
  ┌─────────────────┬──────────────────┬────────────────────┐
  │ Tier 1: Sync    │ Tier 2: Async    │ Tier 3: Deferred   │
  │ (Critical)      │ (Background)     │ (Scheduled)        │
  │                 │                  │                    │
  │ update-registry │ analyze-drift    │ weekly-audit       │
  │                 │ check-deps       │                    │
  └─────────────────┴──────────────────┴────────────────────┘
        ↓                  ↓                    ↓
  Sync state write    Async report         Scheduled report
  (inferred only)     in outputs/          in outputs/
```

---

## Event Priority Tiers

### Tier 1 — Critical / Synchronous
Blocks execution. Used for state mutations that require consistency.

**Triggers**: Registry writes, architecture state updates, approval gates, memory consolidation.

**Rule**: Never allow concurrent writes. Use sequential processing with file locking.

### Tier 2 — Background / Async
Fire-and-forget. Results written to `events/outputs/` as JSON report files.

**Triggers**: File changes, dependency scans, drift analysis, route detection, report generation.

**Rule**: Must not block the main execution thread. Failures are logged but non-fatal.

### Tier 3 — Deferred / Scheduled
Run on a schedule or triggered by the `session.idle` event.

**Triggers**: Weekly audits, ecosystem trend analysis, architectural forecasting.

**Rule**: Always runs in isolation. Writes to `events/outputs/` and `state/inferred/` only.

---

## Runtime Isolation

Bun-specific APIs are confined to `adapters/runtime/bun/`. All handler logic uses the
shared adapter interface (`adapters/runtime/shared types`) so handlers remain runtime-agnostic.

If the runtime changes (Deno, Node, Rust service), only the adapter needs to change.

---

## Output Format

All event handlers produce structured JSON reports in `events/outputs/`:

```json
{
  "event_type": "string",
  "tier": 1 | 2 | 3,
  "timestamp": "ISO_DATE",
  "trigger": "description of what triggered this",
  "analysis": {
    "what_changed": "...",
    "impact": "...",
    "confidence": 0.85
  },
  "recommendations": [
    {
      "action": "...",
      "priority": "high | medium | low",
      "requires_approval": true
    }
  ],
  "state_updates": {
    "path": "relative/path/to/state/file.json",
    "changes": "description of what was updated"
  }
}
```

---

## Files

| File | Tier | Purpose |
|------|------|---------|
| `router/priority-router.ts` | — | Routes events to correct tier queue |
| `handlers/sync/update-registry.ts` | 1 | Applies confirmed state mutations |
| `handlers/async/analyze-drift.ts` | 2 | Detects architectural drift |
| `handlers/async/check-dependencies.ts` | 2 | Scans dependency health changes |
| `handlers/deferred/weekly-audit.ts` | 3 | Runs full weekly analysis |
| `adapters/runtime/bun/index.ts` | — | Bun-specific runtime adapter |
| `outputs/` | — | All analysis reports land here |
