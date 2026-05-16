> **STATUS: NOT YET IMPLEMENTED** — Requires benchmark comparison handler
> This command definition describes the intended behavior, but no handler exists yet.

# /benchmark

Generate capability and performance comparison matrices between current implementations and alternatives.

## Usage

```
/benchmark {feature-or-library}    — compare current implementation vs known alternatives
```

## Behavior

1. Identifies the current implementation from `state/verified/features/feature-registry.json`
2. Discovers alternatives via External Intelligence Gateway (npm trends, GitHub stars, weekly downloads)
3. Runs structured comparison across weighted criteria
4. Stores results in `research/benchmarks/bench-{slug}-{DATE}.json`
5. Updates `state/research/research-registry.json → benchmarks[]`

## Output Format

```
Benchmark: Authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Current:        next-auth@4.24.0
  Alternatives:   lucia@3, clerk, auth.js@5

  Criteria          next-auth  lucia    clerk    auth.js
  ─────────────────────────────────────────────────────
  Setup complexity  medium     low      low      medium
  Bundle size       42kb       18kb     N/A      38kb
  OAuth providers   40+        custom   30+      40+
  Edge runtime      ✓          ✓        ✓        ✓
  Self-hosted       ✓          ✓        ✗        ✓
  TypeScript        ✓          ✓        ✓        ✓
  Last release      6mo ago    1mo ago  3wk ago  1mo ago
  Weekly DLs        2.1M       180k     310k     220k
  ─────────────────────────────────────────────────────
  Recommendation:   Monitor auth.js — official successor to next-auth
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Confidence: 0.80 | Sources: npm, github | Retrieved: 2026-05-11T19:00:00Z
```

## Criteria Weighting

Default weight by category:
- **Security libraries**: security score (40%), maintenance (30%), adoption (30%)
- **UI libraries**: DX (30%), bundle size (25%), ecosystem (25%), performance (20%)
- **Database clients**: performance (35%), type safety (30%), maintenance (20%), adoption (15%)
- **Default**: adoption (35%), maintenance (35%), DX (30%)

Custom criteria can be specified:
```
/benchmark authentication --criteria "setup-time,edge-support,self-hosted"
```

## Storage

Each benchmark writes:
- `research/benchmarks/bench-{slug}-{DATE}.json` — full structured data
- Entry in `research-registry.json → benchmarks[]` with summary and recommendation

## Constraints
- All external data fetched through External Intelligence Gateway only
- Benchmark results are read-only advisory — no automatic migrations
- Data is tagged with retrieval timestamp and expires after 7 days (re-run to refresh)
