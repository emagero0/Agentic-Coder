# OpenAgents Control (OAC) — Complete Guide

> **OAC is a cognitive control layer for AI-assisted development.**  
> It sits inside your repository as a `.opencode/` directory and gives your AI agents memory, standards, supervision, and architectural awareness. Agents learn your patterns. They stay in bounds. They surface risks before they become problems.

---

## Table of Contents

1. [What OAC Does](#what-oac-does)
2. [Full File Structure](#full-file-structure)
3. [Technical Capabilities](#technical-capabilities)
4. [Agent Roster](#agent-roster)
5. [Command Reference](#command-reference)
6. [Using OAC with an Existing Codebase](#using-oac-with-an-existing-codebase)
7. [Starting a New Project with OAC](#starting-a-new-project-with-oac)
8. [Other Use Cases](#other-use-cases)
9. [How the Cognitive Layers Work](#how-the-cognitive-layers-work)
10. [Token Optimization & Prompt Caching](#token-optimization--prompt-caching)

---

## What OAC Does

OAC solves three core problems with AI coding agents:

| Problem | OAC Solution |
|---------|-------------|
| AI generates generic code that doesn't match your patterns | Context system teaches agents your exact stack, conventions, and standards |
| AI changes things it shouldn't, or you can't trust what it did | Every mutation requires explicit human approval before execution |
| AI has no memory between sessions | Structured state system (`inferred/`, `verified/`, `snapshots/`) persists knowledge across sessions |
| AI can't reason about architecture-wide impact | Graph Reasoning Layer computes blast radius, detects orphans, finds cycles |
| You don't know if dependencies are healthy | R&D Supervisor monitors CVEs, ecosystem health, and package abandonment |
| Every session re-loads the same context and rebuilds the same prompts | Token Optimization layer caches compiled prompts and context bundles; only re-computes when a dependency changes |

---

## Full File Structure

```
.opencode/
│
├── README.md                          Core project readme (upstream OAC docs)
├── OAC-GUIDE.md                       This file
├── .gitignore                         Excludes cache/, snapshots/, secrets
├── env.example                        Template for required environment variables
├── package.json                       Runtime dependencies (event system, etc.)
│
│── ─── AGENTS ─────────────────────────────────────────────────────────────
│
├── agent/
│   ├── core/
│   │   ├── openagent.md               General-purpose orchestrator (start here)
│   │   └── opencoder.md               Production coding specialist (6-stage workflow)
│   ├── subagents/
│   │   ├── code/
│   │   │   ├── build-agent.md         Type-checking and build validation
│   │   │   ├── coder-agent.md         Focused implementation (atomic tasks only)
│   │   │   ├── reviewer.md            Code review and security analysis
│   │   │   └── test-engineer.md       TDD and test authoring
│   │   ├── core/
│   │   │   ├── contextscout.md        Smart pattern discovery (MVI engine)
│   │   │   ├── documentation.md       Docs generation
│   │   │   ├── externalscout.md       Live docs fetcher for external libraries
│   │   │   └── task-manager.md        Feature-to-subtask decomposition
│   │   ├── development/
│   │   │   ├── devops-specialist.md   CI/CD, Docker, infrastructure
│   │   │   └── frontend-specialist.md 4-stage UI workflow (layout→theme→animation→impl)
│   │   └── system-builder/
│   │       └── context-organizer.md   Context structure management
│   └── supervisors/                   ← Autonomous monitoring agents (Phase 3–5)
│       ├── architecture-supervisor.md  Drift detection + pattern governance
│       ├── graph-query-engine.md      Read-only graph query delegate
│       ├── memory-curator.md          Memory hygiene, deduplication, consolidation
│       ├── project-manager-supervisor.md Feature auditing + route analysis
│       └── rnd-supervisor.md          Ecosystem watch + dependency intelligence
│
├── agents/
│   └── openagent.md                   (Legacy entry point, kept for compatibility)
│
│── ─── COMMANDS ────────────────────────────────────────────────────────────
│
├── command/
│   ├── add-context.md                 Interactive wizard to capture your patterns
│   ├── analyze-patterns.md            Code pattern analysis report
│   ├── audit.md                       /audit {architecture|features|routes|memory|deps}
│   ├── benchmark.md                   /benchmark — library/approach comparison matrix
│   ├── clean.md                       /clean — hygiene pass on context and state
│   ├── commit.md                      /commit — smart conventional-format git commits
│   ├── context.md                     /context — inspect/reload context files
│   ├── experiment.md                  /experiment — sandboxed hypothesis testing
│   ├── graph.md                       /graph — architectural graph queries
│   ├── optimize.md                    /optimize — code optimization workflow
│   ├── research.md                    /research — ecosystem and dependency intelligence
│   ├── scan-state.md                  /scan-state — rebuild all inferred state
│   ├── test.md                        /test — run testing workflows
│   └── validate-repo.md               /validate-repo — structural health check
│   └── openagents/
│       └── check-context-deps.md      Dependency check for context files
│
│── ─── CONFIGURATION ────────────────────────────────────────────────────────
│
├── config/
│   └── agent-metadata.json            Master registry of all agents + dependencies
│
│── ─── CONTEXT SYSTEM ────────────────────────────────────────────────────────
│
├── context/
│   ├── navigation.md                  Top-level context router
│   ├── core/
│   │   ├── navigation.md
│   │   ├── essential-patterns.md      MVI principle, context design rules
│   │   ├── visual-development.md
│   │   ├── config/
│   │   │   └── paths.json             Canonical path constants
│   │   ├── context-system/            Full context system specification
│   │   │   ├── guides/                Creation, organization, compact, workflows
│   │   │   ├── operations/            Extract, harvest, migrate, organize, update
│   │   │   └── standards/             Frontmatter, MVI, structure, templates
│   │   ├── standards/                 Immutable quality gates
│   │   │   ├── code-analysis.md
│   │   │   ├── code-quality.md
│   │   │   ├── documentation.md
│   │   │   ├── project-intelligence.md
│   │   │   ├── security-patterns.md
│   │   │   └── test-coverage.md
│   │   ├── system/                    Context resolution and path guides
│   │   ├── task-management/           Task schema, splitting, managing guides
│   │   └── workflows/                 Code review, delegation, design iteration, etc.
│   ├── project-intelligence/          ← YOUR living project memory (git-committed)
│   │   ├── living-notes.md            Ongoing discoveries, gotchas, active work
│   │   ├── decisions-log.md           Architectural decisions + rationale
│   │   ├── technical-domain.md        Tech stack, conventions, tooling
│   │   ├── business-domain.md         Business context, user personas, KPIs
│   │   └── business-tech-bridge.md    Mapping features to business outcomes
│   ├── development/                   Framework + language context files
│   │   ├── ai/mastra-ai/              Mastra AI framework patterns
│   │   ├── principles/                API design, clean code
│   │   └── [frontend|backend|data|infrastructure|integration]/
│   ├── ui/
│   │   └── web/                       Animation, design systems, React patterns
│   └── openagents-repo/               OAC meta-documentation (guides, blueprints, etc.)
│
│── ─── EVENT SYSTEM ────────────────────────────────────────────────────────
│
├── events/
│   ├── README.md                      Event system specification
│   ├── router/
│   │   └── priority-router.ts         Tier 1/2/3 event dispatcher
│   ├── handlers/
│   │   ├── sync/
│   │   │   └── update-registry.ts     Synchronous: file change → registry update
│   │   ├── async/
│   │   │   ├── analyze-drift.ts       Async: detect architecture drift
│   │   │   └── check-dependencies.ts  Async: CVE and health check trigger
│   │   └── deferred/
│   │       ├── ecosystem-watch.ts     Background: dependency staleness + R&D triggers
│   │       └── weekly-audit.ts        Scheduled: weekly consolidated audit
│   ├── adapters/runtime/bun/
│   │   └── index.ts                   Bun runtime event adapter
│   └── outputs/                       Event handler output reports (JSON)
│
│── ─── GRAPH REASONING LAYER (Phase 5) ──────────────────────────────────────
│
├── graph/
│   ├── README.md                      Graph layer documentation
│   ├── engine/
│   │   ├── graph-engine.ts            BFS, DFS, cycle detection, topological sort
│   │   ├── impact-analyzer.ts         Blast radius + severity classification
│   │   └── query-builder.ts           Fluent chainable query API
│   ├── schemas/
│   │   └── graph-schema.ts            TypeScript types (GraphNode, GraphEdge, etc.)
│   └── queries/
│       ├── find-blast-radius.ts       "What breaks if X changes?"
│       ├── find-dependents.ts         "What depends on X?"
│       ├── find-orphans.ts            "What has no relationships?" (dead code)
│       └── find-feature-coverage.ts  "Which nodes implement feature Y?"
│
│── ─── R&D / RESEARCH (Phase 4) ─────────────────────────────────────────────
│
├── research/
│   ├── experiments/                   Sandboxed experiment outputs
│   ├── benchmarks/                    Library/approach comparison results
│   ├── ecosystem-watch/               Dependency health and trend reports
│   └── migration-analysis/            Migration feasibility assessments
│
├── cache/
│   ├── external/                      Gateway cache (CVE, npm, GitHub API responses)
│   │
│   │── ─── TOKEN OPTIMIZATION CACHE (Phase 6) ──────────────────────────────
│   ├── deterministic/                 24h TTL — compiled supervisor prompts, verified graph results
│   ├── inferred/                      1h TTL  — feature audit summaries, dependency scan results
│   ├── speculative/                   15m TTL — R&D findings, CVE analysis, ecosystem watch
│   ├── invalidation/
│   │   └── manifest.json              Dependency graph of all cache entries (source-of-truth for eviction)
│   └── manifest/
│       └── context-manifest.json      Maps context files → chunks → consuming agents
│
│── ─── SKILLS ──────────────────────────────────────────────────────────────
│
├── skills/
│   ├── context7/                      Live library documentation fetcher
│   │   ├── SKILL.md                   Skill specification
│   │   ├── library-registry.md        Supported library index
│   │   └── README.md
│   └── task-management/               Task CLI scripts
│       ├── SKILL.md
│       ├── router.sh
│       └── scripts/task-cli.ts
│
│── ─── STATE MANAGEMENT ────────────────────────────────────────────────────
│
├── state/
│   ├── README.md                      State system specification
│   ├── agents/
│   │   └── agent-capabilities.json    Live registry of all agent capabilities + roles
│   ├── project/
│   │   └── project-health.json        Overall project health scores
│   ├── research/
│   │   └── research-registry.json     R&D topics, experiments, findings
│   ├── inferred/                      ← AI-generated, not yet verified
│   │   ├── architecture/
│   │   │   └── architecture-graph.json  Graph nodes, edges, drift alerts
│   │   ├── dependencies/
│   │   │   └── dependency-state.json  Dep health, CVEs, abandonment signals
│   │   └── features/
│   │       └── feature-registry.json  Detected features + confidence scores
│   ├── verified/                      ← Human-confirmed ground truth
│   │   ├── architecture/
│   │   │   └── architecture-graph.json  Confirmed topology
│   │   ├── dependencies/
│   │   │   └── dependency-state.json  Confirmed dep state
│   │   └── features/
│   │       └── feature-registry.json  Promoted features
│   └── snapshots/                     ← Pre-mutation backups (timestamped)
│       └── inferred-{DATETIME}/       Snapshot of inferred/ before any promotion
│
│── ─── TOOLS ──────────────────────────────────────────────────────────────
│
└── tool/
    ├── env/
    │   └── index.ts                   Environment variable resolver + validation
    ├── events/
    │   └── index.ts                   Event emission utilities
    ├── external-gateway/
    │   └── index.ts                   Whitelisted HTTP proxy for R&D agents
    │
    │── ─── TOKEN OPTIMIZATION TOOLS (Phase 6) ─────────────────────────────
    ├── context-resolver/
    │   ├── fingerprint-engine.ts      mtime-first SHA-256 hashing (4 hash types)
    │   ├── chunk-loader.ts            H1/H2 markdown splitter with stable chunk IDs
    │   ├── dependency-resolver.ts     Agent → context file dependency map
    │   └── index.ts                   Public facade: resolve(agentId) → ResolvedContextBundle
    └── prompt-compiler/
        ├── cache-manager.ts           Metadata-envelope cache with classification dirs
        ├── template-engine.ts         Static/dynamic prompt split, classification resolver
        └── index.ts                   Public facade: compile(agentId, bundle, state) → CompilerResult
```

---

## Technical Capabilities

### 1. Context-Aware Code Generation
Agents load your exact patterns before generating code via the **ContextScout** system. You define your stack, conventions, and standards once; every agent session inherits them. Context files are MVI-compliant (< 200 lines each), enabling ~80% token reduction vs loading full codebase.

### 2. Human-Approval Gating
No agent writes files, runs shell commands, or promotes state without explicit user confirmation. The approval prompt is always shown before execution. This is enforced in the agent definition markdown files — you can read and edit the rules.

### 3. Supervised Architecture Auditing (`/audit architecture`)
The `ArchitectureSupervisor` compares inferred vs verified graph topology, detects:
- New modules not yet in the graph
- Deleted modules still referenced
- Layer violations (e.g., UI importing DB directly)
- Naming inconsistencies
- Pattern drift (e.g., new file violates Feature-Sliced Design)

Outputs a scored drift report (0.0–1.0 consistency score). Offers to promote clean nodes to verified with your approval.

### 4. Feature Intelligence (`/audit features`)
The `ProjectManagerSupervisor` reads every feature entry in the registry, re-verifies evidence against actual file content, detects regressions, and re-scores confidence. Features need ≥ 0.85 confidence + confirmed evidence to be promoted to verified.

**Phase 5 enhancement**: Cross-references features against the architecture graph to catch features that have zero node coverage (possibly unimplemented despite appearing in the registry).

### 5. Blast Radius Analysis (`/graph blast-radius {node-id}`)
The `GraphQueryEngine` runs BFS from any node to compute:
- **Directly affected** nodes (single-hop dependents)
- **Transitively affected** nodes (all downstream consumers)
- **Severity** (critical / high / medium / low) based on affected count
- **Affected features** — which product features are at risk
- **Recommendation** — plain-English risk summary

Used automatically by `ArchitectureSupervisor` to escalate drift severity when a drifted node has wide blast radius.

### 6. Dependency Intelligence (`/research dependencies`)
The `RndSupervisor` queries OSV.dev, npm, and GitHub (through the `ExternalGateway`) to report:
- CVEs for all dependencies
- Packages with no commits in 12+ months (abandonment risk)
- Outdated major versions
- Better alternatives to high-risk packages

All responses are cached with provenance metadata to prevent duplicate fetches.

### 7. Sandboxed Experiments (`/experiment create`)
Run hypothesis tests in isolated temp directories. Only findings are persisted to `.opencode/research/experiments/`. No experiment can mutate source code.

### 8. Library Benchmarking (`/benchmark {feature}`)
Produce structured comparison matrices for library decisions (e.g., "which state manager should we adopt?") with weighted criteria scoring.

### 9. Memory Hygiene (`/audit memory`)
The `MemoryCurator` scans all `project-intelligence/` files for:
- Duplicate entries across files
- Stale items (> 90 days old, no resolution)
- Conflicting decisions
- Orphaned TODOs

**Phase 5 enhancement**: Also reports orphaned architecture nodes (dead code candidates) detected by `GraphQueryEngine`.

### 10. Event-Driven Background Monitoring
The priority router dispatches events to tiered handlers:
- **Tier 1 (sync)**: File changes → instant registry update
- **Tier 2 (async)**: Code changes → drift analysis, dependency check
- **Tier 3 (deferred)**: `session.idle` → ecosystem watch (staleness reports, research suggestions)

### 11. Ecosystem-Watch (Deferred Background)
When the session is idle for 15+ minutes, `ecosystem-watch.ts` automatically checks:
- Which researched topics have gone stale (no update in 14 days)
- Which dependencies are outdated or show health signals
- Emits `research.topic.created` events when new investigation is warranted

### 12. External Intelligence Gateway
All R&D and CVE queries pass through a centralized gateway with:
- **Whitelist**: Only npm, OSV.dev, GitHub, Snyk, caniuse, Can I Use
- **TTL caching**: 24 hr by default, per-provider override
- **Provenance tracking**: Every cached response records its source URL, timestamp, and hash
- **No direct agent internet access**: Agents cannot make arbitrary outbound HTTP calls

### 13. Inferred → Verified → Snapshot State Machine
Knowledge flows through three tiers:
1. **Inferred**: AI-generated, unconfirmed. Can be wrong.
2. **Verified**: Human-confirmed ground truth. Agents treat this as authoritative.
3. **Snapshots**: Pre-mutation backups. Created automatically before any verified write.

This means you can always roll back a promotion if it turns out to be wrong.

### 14. Graph Queries (`/graph`)
Six built-in queries over the architecture graph:

| Query | Purpose |
|-------|---------|
| `blast-radius {id}` | Impact severity of changing a node |
| `dependents {id}` | All modules that depend on a node |
| `orphans` | Nodes with no relationships (dead code) |
| `feature-coverage {id}` | Which nodes implement a feature |
| `cycles` | Circular dependency detection |
| `stats` | Overall graph health summary |

### 15. Token Optimization & Prompt Caching (`/cache`)

The **Phase 6 token optimization layer** sits beneath every agent and supervisor. It eliminates redundant token consumption by caching compiled prompts, resolved context bundles, and graph traversal results — with surgical, dependency-aware invalidation.

**How it works:**

1. **FingerprintEngine** — before loading any context file, checks mtime. If unchanged, skips SHA-256 hashing and returns the cached fingerprint. On actual change, computes 4 hash types: file hash, section hash, dependency-tree hash, and template hash.

2. **ChunkLoader** — splits markdown at H1/H2 boundaries into stable chunks. Chunk IDs survive heading renames via explicit `<!-- chunk:id=... -->` comments, so cache continuity is preserved even when you refactor context headings.

3. **DependencyResolver** — declarative map of which agent/command depends on which context files and which specific chunks. Populates `cache/manifest/context-manifest.json` automatically, giving the invalidation engine a complete consumer graph.

4. **CacheManager** — every cache entry stores a mandatory metadata envelope: classification, dependencies, source hashes, TTL, and the events that should trigger eviction. Three classification directories enforce epistemic hygiene:

   | Classification | TTL | When to use |
   |---|---|---|
   | `deterministic/` | 24 h | Supervisor prompts built from verified state |
   | `inferred/` | 1 h | Audit summaries built from inferred registries |
   | `speculative/` | 15 m | R&D findings, CVE results, ecosystem watch |

5. **TemplateEngine** — splits every prompt into a static instruction block (long-lived, aggressively cached) and a dynamic state injection (short-lived, always recomputed). Resolves the most-restrictive classification of all inputs so speculative data never silently upgrades a deterministic cache entry.

6. **`invalidate-cache` event handler (Tier 1)** — fires on `file.edited`, `file.watcher.updated`, and `cache.invalidate`. Reads `cache/invalidation/manifest.json`, evicts only the cache entries that declared a dependency on the changed file, and writes an invalidation report to `events/outputs/`. Never performs a global wipe.

**Result**: on a warm session, agents compile their prompts in microseconds from disk. On a cold start (or after a file changes), only the affected entries are recomputed. R&D speculation is never promoted into deterministic cognition.

---

## Agent Roster

| Agent | Type | Trigger | Purpose |
|-------|------|---------|---------|
| `OpenAgent` | Core | `opencode --agent OpenAgent` | General tasks, Q&A, exploration |
| `OpenCoder` | Core | `opencode --agent OpenCoder` | Production features, multi-file refactoring |
| `SystemBuilder` | Core | `opencode --agent SystemBuilder` | Build custom AI systems from scratch |
| `ContextScout` | Subagent | Auto-delegated | Discovers relevant context patterns |
| `TaskManager` | Subagent | Auto-delegated | Decomposes features into atomic tasks |
| `CoderAgent` | Subagent | Auto-delegated | Executes focused code changes |
| `TestEngineer` | Subagent | Auto-delegated | TDD and test authoring |
| `CodeReviewer` | Subagent | Auto-delegated | Security + quality review |
| `BuildAgent` | Subagent | Auto-delegated | Type checking, build validation |
| `DocWriter` | Subagent | Auto-delegated | Documentation generation |
| `ExternalScout` | Subagent | Auto-delegated | Fetches live library docs |
| `FrontendSpecialist` | Subagent | Auto-delegated | 4-stage UI design workflow |
| `DevOpsSpecialist` | Subagent | Auto-delegated | CI/CD, Docker, infra |
| `ContextOrganizer` | Subagent | Auto-delegated | Context file management |
| `ArchitectureSupervisor` | Supervisor | `/audit architecture` or drift event | Drift detection, pattern governance |
| `ProjectManagerSupervisor` | Supervisor | `/audit features`, `/audit routes` | Feature completeness, route analysis |
| `MemoryCurator` | Supervisor | `/audit memory` or periodic | Memory hygiene, deduplication |
| `RndSupervisor` | Supervisor | `/research`, `/experiment`, `/benchmark` | Ecosystem watch, R&D, CVE analysis |
| `GraphQueryEngine` | Supervisor | `/graph *` or delegated | Read-only graph traversal |

---

## Command Reference

```bash
# State Management
/scan-state                    # Rebuild all inferred state from scratch
/validate-repo                 # Structural health check

# Auditing
/audit architecture            # Drift detection, graph build, pattern check
/audit features                # Feature completeness + regression detection
/audit routes                  # Route → feature mapping, orphan routes
/audit memory                  # Memory hygiene, deduplication, dead code
/audit dependencies            # CVE scan, abandonment check (via /research)

# Graph Queries
/graph stats                   # Overall graph health
/graph blast-radius {node-id}  # Change impact analysis
/graph dependents {node-id}    # What depends on this?
/graph orphans                 # Dead code candidates
/graph feature-coverage {id}   # Feature → node mapping
/graph cycles                  # Circular dependency detection

# R&D and Research
/research dependencies         # Full dependency health report
/research {topic}              # Ecosystem research on a topic
/research summary              # Consolidated findings from registry
/experiment create             # Sandboxed hypothesis test
/experiment list               # Show experiments + status
/benchmark {feature}           # Library comparison matrix

# Development Workflow
/add-context                   # Capture your patterns (one-time or update)
/commit                        # Smart conventional git commit
/test                          # Run testing workflows
/optimize                      # Code optimization pass
/context                       # Inspect / reload context files
/clean                         # Hygiene pass on stale context
/analyze-patterns              # Pattern analysis report

# Token Optimization & Cache Management
/cache stats                   # Summary: entry count, classification breakdown, oldest/newest
/cache inspect {key}           # Full metadata for a specific cache entry
/cache invalidate {file-path}  # Manually evict all caches depending on this file
/cache prune                   # Remove expired entries only (safe, non-destructive)
/cache clear                   # Wipe all cache entries (requires confirmation)
```

---

## Using OAC with an Existing Codebase

### Day 1 — Onboarding an Existing Project

**Goal**: Give OAC a model of what your project currently is.

```bash
# 1. Open your project in opencode
cd your-project/
opencode --agent OpenAgent

# 2. Capture your patterns (15 min, run once)
> /add-context
# Answer questions about your stack, conventions, API patterns, component shapes

# 3. Build the initial inferred state (scans your codebase)
> /scan-state
# OAC reads your files and populates:
# - state/inferred/features/feature-registry.json
# - state/inferred/architecture/architecture-graph.json
# - state/inferred/dependencies/dependency-state.json

# 4. Review what was inferred
> /audit architecture
# See what OAC detected. Approve promotions of correct nodes to verified/.

> /audit features
# See what features were detected. Promote accurate ones.

> /audit dependencies
# See dependency health. Flag any CVEs or abandoned packages.
```

**What you get after Day 1**:
- A verified architecture graph representing your actual module topology
- A feature registry with confidence scores
- A dependency health baseline
- Context files reflecting your team's real coding standards

### Ongoing Development Flow

```
You: > "Add a forgot-password email flow"
        ↓
ContextScout:  loads your auth patterns, email patterns, API shape
        ↓
OpenCoder:     proposes plan matching YOUR conventions
        ↓
You approve → OpenCoder implements → TestEngineer validates
        ↓
event system detects new files → async drift analysis runs
        ↓
ArchitectureSupervisor: "3 new nodes detected, 0 drift alerts"
```

### Integrating with Existing Teams

```bash
# Lead developer sets up OAC + captures patterns
/add-context
git add .opencode/context/project-intelligence/
git commit -m "chore: add OAC team patterns"
git push

# Every team member now gets the same patterns automatically
# No per-developer config needed
```

### Auditing a Legacy or Inherited Codebase

If you've inherited a codebase with no documentation:

```bash
> /scan-state
# Let OAC infer what it can

> /audit architecture
# Gets you: module map, layer violations, orphaned modules, naming issues

> /graph orphans
# Immediately surface dead code candidates

> /graph cycles
# Find circular dependencies before they cause problems

> /research dependencies
# CVE scan + abandonment check on all deps

> /audit features
# Detect what features exist vs what's actually implemented
```

Use the audit outputs as a foundation for writing proper ADRs and living notes.

---

## Starting a New Project with OAC

### Project Kickoff

```bash
mkdir my-new-project && cd my-new-project
git init

# Install OAC (creates .opencode/ directory)
curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer

opencode --agent OpenCoder
> "Set up a Next.js 14 project with TypeScript, Drizzle ORM, and Tailwind"
```

OAC will:
1. Scaffold the project using your confirmed patterns
2. Add all decisions to `decisions-log.md`
3. Register detected features in the inferred registry

### Capture Patterns Immediately

```bash
> /add-context
# Even for a new project, capture your intended conventions NOW
# This prevents drift from the first commit
```

### Build Feature by Feature

```bash
> "Add user authentication with email + password"
# OpenCoder proposes plan → you approve → implements → tests → reviews

> /audit features
# Verifies the feature is complete before moving on

> /commit
# Smart conventional commit: "feat(auth): add email+password authentication"
```

### Architecture Governance from Day 1

```bash
> /audit architecture
# After each significant feature, check for drift
# Catches: wrong layer imports, naming inconsistencies, missing modules

> /graph stats
# Quick health check — are we adding dead code? Any cycles?
```

---

## Other Use Cases

### Use Case: Pre-Refactor Safety Check

Before a large refactor:

```bash
> /graph blast-radius auth-middleware
# Shows: 10 nodes affected, 3 features at risk, severity: HIGH
# Immediately know the scope before you touch anything

> /graph dependents {module-you-want-to-rename}
# See every caller before renaming
```

### Use Case: Dependency Upgrade Decision

```bash
> /research dependencies
# OAC checks npm + OSV.dev — finds: "react-query v3 has 2 medium CVEs, v5 available"

> /benchmark state-management
# Comparison matrix: react-query v5 vs SWR vs TanStack Query v5
# Weighted by: bundle size, DX, TS support, maintenance activity

> /experiment create
# "Test react-query v5 migration on 2 API calls"
# Runs in sandbox, reports findings — no source code touched
```

### Use Case: Onboarding a New Developer

```bash
# New developer joins, clones repo
# .opencode/ is committed to git — they get everything on day 1

opencode --agent OpenAgent
> "Explain the architecture of this codebase"
# Agent reads architecture-graph.json, feature-registry.json, technical-domain.md
# Gives accurate, context-aware explanation in minutes
```

### Use Case: Weekly Health Check

```bash
> /audit memory          # Find stale notes, contradictions
> /audit features        # Catch any regressions from last week
> /audit architecture    # Detect drift from new PRs
> /research dependencies # New CVEs since last week?
> /graph stats           # Any new orphans or cycles?
```

Run these weekly or set up `weekly-audit.ts` to trigger them automatically when the session is idle.

### Use Case: Diagnosing High Token Usage

If you're seeing unusually high token consumption per session:

```bash
> /cache stats
# Shows: how many entries exist, what classification, oldest entry
# If "expired (pending prune)" is high → stale entries are bloating disk but NOT causing re-computation

> /cache prune
# Remove expired entries. This is always safe.

> /cache inspect {key}
# Deep-dive a specific entry: what deps does it track, when does it expire, what events invalidate it?

# If you suspect a context file change is not propagating correctly:
> /cache invalidate .opencode/context/core/standards/code-quality.md
# Forces recompilation of all prompts that depend on that file
# Then re-run your command — it will now use fresh compiled context
```

> **Rule of thumb**: use `/cache prune` routinely, `/cache invalidate {file}` surgically, and `/cache clear` only as a last resort. Global clears cause a cold-start penalty on the next session.

### Use Case: Building a Custom AI System

```bash
opencode --agent SystemBuilder
> "Create a customer support AI system"
# Interactive wizard generates:
# - Custom orchestrator agent
# - Domain-specific subagents
# - Context files for your domain
# - Commands for your workflow
```

### Use Case: Continuous Context Updates

As your project evolves, your patterns change:

```bash
> /add-context --update
# Adds new library patterns (e.g., you adopted Stripe)
# Updates naming conventions (you switched to kebab-case)
# All future agent sessions use the updated patterns
```

---

## How the Cognitive Layers Work

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 5: Graph Reasoning  (/graph blast-radius, /graph orphans) │
│  Relationships, blast radius, dead code, cycle detection         │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: R&D Intelligence  (/research, /experiment, /benchmark) │
│  External ecosystem, CVEs, sandboxed experiments                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: Supervisory Agents  (/audit *)                         │
│  Architecture drift, feature auditing, memory hygiene           │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: Event System  (background, always running)             │
│  File change → drift check → dependency check → research trigger │
├─────────────────────────────────────────────────────────────────┤
│  Layer 1: Core Agents  (OpenAgent, OpenCoder, subagents)         │
│  Code generation, review, testing, documentation                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 0: Token Optimization  (/cache, ContextResolver,          │
│           PromptCompiler)                                        │
│  Fingerprinting, chunk caching, dep-aware invalidation,          │
│  prompt compilation with epistemic classification                │
├─────────────────────────────────────────────────────────────────┤
│  Foundation: Context + State  (inferred / verified / snapshots)  │
│  Your patterns, your architecture, your features — with memory   │
└─────────────────────────────────────────────────────────────────┘
```

Each layer enriches the one above it:
- **Foundation** gives agents your patterns so generated code matches from the start
- **Layer 0** resolves, fingerprints, and caches context + compiled prompts before any agent sees them
- **Layer 1** generates and reviews code using those patterns
- **Layer 2** detects problems passively as you work; file changes also trigger Layer 0 invalidation
- **Layer 3** audits deeply on-demand, with human approval for any state change
- **Layer 4** goes outside the codebase to check ecosystem health
- **Layer 5** reasons across the whole architecture graph to compute impact

No layer operates autonomously. Every state mutation requires explicit human confirmation. Every external call goes through the gateway. Every destructive operation creates a snapshot first.

---

## Token Optimization & Prompt Caching

This section is a quick reference for the **Phase 6** caching layer.

### Classification Rules

| Classification | TTL | Set when |
|---|---|---|
| `deterministic` | 24 h | All deps are from `state/verified/` or stable instruction files |
| `inferred` | 1 h | Any dep comes from `state/inferred/` or a registry scan |
| `speculative` | 15 m | Any dep comes from R&D output, CVE data, or ecosystem watch |

The most restrictive input wins. A prompt that mixes verified state with one inferred registry file is classified `inferred`, not `deterministic`.

### Invalidation Flow

```
File changes on disk
        ↓
  Tier 1 event fires: file.edited
        ↓
  invalidate-cache.ts reads manifest.json
        ↓
  Finds all cache keys that declare a dep on this file
        ↓
  Deletes matching .json files from deterministic/ inferred/ speculative/
        ↓
  Updates manifest.json (evicted keys removed)
        ↓
  Writes invalidation report → events/outputs/invalidation-{ts}.json
        ↓
  Next compile() call for affected agent → cache miss → fresh compilation
```

### Safe Operations

| Operation | Effect | Risk |
|---|---|---|
| `/cache prune` | Removes expired entries | None — safe anytime |
| `/cache invalidate {file}` | Evicts entries depending on file | Triggers cold re-compile for affected agents only |
| `/cache stats` | Read-only inspection | None |
| `/cache inspect {key}` | Read-only metadata view | None |
| `/cache clear` | Wipes all entries | Full cold-start on next session |

### Anti-Patterns

- **Never treat `speculative/` cache as authoritative** — R&D conclusions are guesses, not facts
- **Never run `/cache clear` as a routine** — use `/cache prune` for expired cleanup
- **Never cache without a metadata envelope** — keyless entries cannot be invalidated later
- **Never store unverified inferred state in `deterministic/`** — classification must match the weakest input

---

*OAC is built on [OpenCode](https://opencode.ai) — open-source, model-agnostic, MIT licensed.*  
*Community: [nextsystems.ai](https://nextsystems.ai) — [@DarrenBuildsAI](https://x.com/DarrenBuildsAI)*
