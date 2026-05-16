# /research

Research ecosystem topics, dependency health, and technology trends.

## Usage

```
/research dependencies           — full dependency ecosystem scan (CVEs, outdated, deprecated)
/research {library-name}         — deep research on a specific library or technology
/research summary                — generate weekly research digest from all findings
/research topics                 — list all open and concluded research topics
```

## Behavior

Delegates to **RndSupervisor** (Subsystem A or B depending on subcommand).

### `/research dependencies`
1. Reads `state/inferred/dependencies/dependency-state.json`
2. Routes each package through the External Intelligence Gateway (npm, OSV.dev, GitHub)
3. Flags: outdated (>2 major versions behind), vulnerable (any CVE ≥ medium), deprecated, abandoned
4. Outputs report: `research/ecosystem-watch/dep-report-{DATE}.json`
5. Updates `state/research/research-registry.json → ecosystem_watch[]`

**Output format:**
```
Dependency Scan — 2026-05-11
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠  next          14.0.0 → 15.2.1  (outdated: 1 major)
  🔴 lodash        4.17.19           (CVE-2021-23337, severity: high)
  ⚫ left-pad      1.3.0             (abandoned: last commit 4yr ago)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  3 flagged / 42 total
  Upgrade candidates saved to research-registry.json
```

### `/research {library-name}`
1. Creates or resumes a topic entry in `research-registry.json → topics[]`
2. Runs structured research via ExternalScout (through External Gateway)
3. Report sections: Problem → Existing Solutions → Emerging Alternatives → Recommendation
4. Stores in `research-registry.json → findings[]` and `research/ecosystem-watch/{topic}-{DATE}.json`

**Output format:**
```
Research: next-auth
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Problem:      OAuth/JWT authentication layer
  Current:      next-auth@4.x (stable, 89k⭐, active)
  Alternatives: lucia@3 (lighter), clerk (managed), auth.js (community fork)
  Recommendation: Monitor auth.js — it is the official next-auth successor
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Confidence: 0.85 | Source: npm, github | Retrieved: 2026-05-11T19:00:00Z
```

### `/research summary`
1. Reads all findings in `research-registry.json`
2. Deduplicates overlapping findings
3. Archives concluded topics >90 days old
4. Writes: `research/ecosystem-watch/weekly-digest-{DATE}.md`

### `/research topics`
Lists all research topics with status, priority, and last activity date.

## Constraints
- All external data fetched through External Intelligence Gateway only
- No finding is stored without `source`, `retrieved_at`, `confidence` fields
- Read-only access to verified state
- Never auto-upgrades or modifies production code
