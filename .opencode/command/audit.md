---
description: "Deep audit command for supervisory analysis. Invokes ProjectManagerSupervisor, ArchitectureSupervisor, or MemoryCurator for targeted deterministic audits."
notes:
  - "/audit dependencies has no dedicated handler — falls back to analyze-drift logic"
---

# /audit

Invoke a deep deterministic audit via a supervisor agent. Unlike automatic event-driven
observation (which is lightweight), `/audit` triggers a full, structured investigation.

**All audits are advisory.** State is only modified with explicit human confirmation.

---

## Subcommands

### /audit features
**Supervisor**: ProjectManagerSupervisor
**Mode**: Deep feature completeness audit

- Reads all inferred feature entries
- Verifies evidence by reading actual source files
- Re-scores confidence based on real content
- Identifies complete, partial, stubbed, and missing features
- Presents promotion candidates (confidence ≥ 0.85) for human confirmation
- Output: `.opencode/events/outputs/feature-audit-{DATE}.json`

---

### /audit routes
**Supervisor**: ProjectManagerSupervisor
**Mode**: User flow and route mapping

- Scans all route/page files in the project
- Maps routes to features in the feature registry
- Identifies orphan routes (no feature association)
- Identifies missing routes (features with no route)
- Output: `.opencode/events/outputs/route-map-{DATE}.json`

---

### /audit architecture
**Supervisor**: ArchitectureSupervisor
**Mode**: Full architecture drift detection

- Scans actual codebase for modules, imports, and patterns
- Compares against inferred and verified architecture graphs
- Detects drift alerts, pattern violations, and orphaned modules
- Computes architecture consistency score
- Presents clean nodes for verification
- Output: `.opencode/events/outputs/architecture-drift-{DATE}.json`

---

### /audit dependencies
**Supervisor**: ProjectManagerSupervisor
**Mode**: Deep dependency ecosystem analysis

- Reads inferred dependency state
- Checks for stale flags from event handler
- Compares versions against what's recorded
- Generates a prioritized risk list (CVE, deprecated, outdated, abandoned)
- Output: `.opencode/events/outputs/dependency-audit-{DATE}.json`

---

### /audit memory
**Supervisor**: MemoryCurator
**Mode**: Context memory hygiene and consolidation

- Scans all project-intelligence markdown files
- Identifies duplicates, stale items, contradictions, orphaned TODOs
- Proposes specific consolidations (one at a time, with confirmation)
- Syncs agent-capabilities.json with agent-metadata.json
- Output: `.opencode/events/outputs/memory-audit-{DATE}.json`

---

### /audit health
**Supervisors**: All supervisors (aggregate pass)
**Mode**: Full system health check

Runs all audits in sequence and computes aggregate health scores:
- Feature completeness score
- Architecture consistency score
- Dependency health score
- Memory hygiene score
- Overall platform health score

Updates `.opencode/state/project/project-health.json` with new scores.

---

## Execution Rules

1. Every audit starts by reading state — never assumes existing state is current.
2. Every audit reports confidence scores on all findings.
3. No audit modifies `verified/` state without displaying a confirmation prompt.
4. No audit modifies source code under any circumstances.
5. Every audit writes its output to `events/outputs/` even if no issues are found.
6. Audits run to completion — never abort silently if an issue is found.

---

## Quick Reference

| Command | Supervisor | Depth | Auto-triggered? |
|---------|-----------|-------|----------------|
| `/audit features` | ProjectManager | Deep | No |
| `/audit routes` | ProjectManager | Deep | No |
| `/audit architecture` | Architecture | Deep | No |
| `/audit dependencies` | ProjectManager | Deep | No |
| `/audit memory` | MemoryCurator | Deep | No |
| `/audit health` | All | Full | No |
