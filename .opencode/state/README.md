# OpenAgentsControl — Structured State Layer

This directory contains machine-readable registries that give the OAC framework persistent,
queryable awareness of the project's features, architecture, dependencies, and agent capabilities.

---

## Core Principle: Inferred vs Verified

**NEVER mix inferred state with verified state.**

| Directory | Meaning |
|-----------|---------|
| `inferred/` | Auto-populated by discovery scans. Tagged with confidence scores. Provisional — never treated as authoritative. |
| `verified/` | Confirmed by human review, deep audits (`/audit`), tests, or runtime analysis. Authoritative ground truth. |
| `snapshots/` | Versioned historical snapshots before any major mutation. Used for rollback. |

---

## Who Writes Where

| Writer | Target | Permission |
|--------|--------|-----------|
| `/scan-state` command | `inferred/**` | Open — always overwrites with fresh scan |
| Event handlers (Tier 1/2) | `inferred/**` | Append-only |
| `ArchitectureSupervisor` | `verified/architecture/**` | Append with `/audit` confirmation |
| `ProjectManagerSupervisor` | `verified/features/**` | Append with `/audit` confirmation |
| `MemoryCurator` | `project-health.json`, `agents/**` | Append |
| Human / `/audit` command | `verified/**` | Promotes inferred → verified |

---

## Registry Files

### Inferred (provisional, confidence-scored)
- `inferred/features/feature-registry.json` — Detected features with evidence and confidence
- `inferred/architecture/architecture-graph.json` — Detected components and relationships
- `inferred/dependencies/dependency-state.json` — Dependency health from package manifests

### Verified (authoritative ground truth)
- `verified/features/feature-registry.json` — Confirmed complete features
- `verified/architecture/architecture-graph.json` — Confirmed architectural components
- `verified/dependencies/dependency-state.json` — Manually confirmed dependency health

### Cross-cutting (always authoritative)
- `agents/agent-capabilities.json` — Agent registry, synced from agent-metadata.json
- `project/project-health.json` — Aggregate health metrics and trend

---

## Confidence Score Reference

| Range | Meaning |
|-------|---------|
| 0.90–1.00 | High confidence — strong structural evidence |
| 0.70–0.89 | Medium confidence — partial evidence, likely correct |
| 0.50–0.69 | Low confidence — inferred from indirect signals |
| 0.00–0.49 | Speculative — flag for immediate human review |

---

## Write Safety Rules

1. Never overwrite `verified/` files automatically — requires explicit `/audit` confirmation.
2. Before mutating any `verified/` file, copy current state to `snapshots/{filename}-{ISO_DATE}.json`.
3. Event handlers may only write to `inferred/` or create reports in `.opencode/events/outputs/`.
4. All state files must remain valid JSON at all times — use atomic writes (write to tmp, rename).
