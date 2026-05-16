# `/cache` — Cache Management Command

<!-- chunk:id=cache.overview -->
## Overview

Inspect and manage the OAC prompt and context cache. The cache eliminates redundant token usage by storing compiled prompts, resolved context bundles, and graph traversal results between sessions.

All cache entries are classified as **deterministic**, **inferred**, or **speculative** — this prevents R&D speculation from poisoning stable cognition.

---

<!-- chunk:id=cache.commands -->
## Commands

### `/cache stats`
Show a summary of the current cache state:

```
Cache Statistics — OAC Token Optimization Layer
================================================
Total entries     : 12
  deterministic   : 5    (24h TTL)
  inferred        : 6    (1h TTL)
  speculative     : 1    (15m TTL)

Expired (pending prune) : 2
Oldest entry     : 2026-05-11T08:30:00Z
Newest entry     : 2026-05-11T22:45:00Z

Cache directories:
  .opencode/cache/deterministic/   5 files
  .opencode/cache/inferred/        6 files
  .opencode/cache/speculative/     1 file
```

---

### `/cache inspect {key}`
Show full metadata for a specific cache entry:

```
Cache Entry: architecture-supervisor:prompt:abc123
  Classification : deterministic
  Created        : 2026-05-11T20:00:00Z
  Expires        : 2026-05-12T20:00:00Z
  Generator      : prompt-compiler
  Dependencies   :
    - .opencode/agent/supervisors/architecture-supervisor.md
    - .opencode/state/verified/architecture/architecture-graph.json
  Source hashes  :
    - sha256:d4e5...
    - sha256:f6a7...
  Invalidation events : file.edited, state.registry.write
  Payload size   : 4.2 KB
```

---

### `/cache invalidate {file-path}`
Manually trigger selective invalidation for all caches that depend on the given file.

Example:
```
/cache invalidate .opencode/context/core/standards/code-quality.md
```

Output:
```
Invalidated 3 cache entries depending on code-quality.md:
  - code-reviewer:prompt:abc123  (deterministic)
  - test-engineer:prompt:def456  (deterministic)
  - architecture-supervisor:summary:ghi789  (inferred)
Affected agents: code-reviewer, test-engineer, architecture-supervisor
```

---

### `/cache prune`
Remove expired entries from disk without touching valid ones. Safe to run at any time.

```
Pruned 4 expired cache entries.
  deterministic : 0 pruned
  inferred      : 3 pruned
  speculative   : 1 pruned
```

---

### `/cache clear`
**Wipe all cache entries across all classification directories.**

> ⚠️ This requires explicit confirmation. Caches will be rebuilt on the next command invocation.

```
Are you sure you want to clear all 12 cache entries? This cannot be undone.
Type "yes" to confirm:
```

Only use `/cache clear` if you suspect widespread stale-context corruption. For targeted cleanup, prefer `/cache invalidate {file-path}`.

---

<!-- chunk:id=cache.anti-patterns -->
## Anti-Patterns to Avoid

| Anti-Pattern | Correct Approach |
|---|---|
| Running `/cache clear` routinely | Use `/cache prune` for expired entries |
| Treating speculative cache as authoritative | Speculative entries are for R&D only |
| Ignoring `potentially_stale` warnings | Recompile if a dep hash changed |
| Caching unverified inferred state as canonical | Use `inferred/` classification, not `deterministic/` |

---

<!-- chunk:id=cache.classification -->
## Cache Classification Guide

| Classification | TTL | Source Type | Use When |
|---|---|---|---|
| `deterministic` | 24h | Verified state, stable instructions | Supervisor prompts, verified graph results |
| `inferred` | 1h | Inferred state, drift analysis | Feature audit summaries, dependency scans |
| `speculative` | 15m | R&D, ecosystem watch, experiments | Research findings, CVE analysis |

The cache layer automatically assigns classification based on the most restrictive input. A prompt built from verified state + inferred registry → classified as `inferred`.
