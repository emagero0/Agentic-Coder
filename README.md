# Agentic Coder — OAC Cognitive Event System

**Open Agent Coordinator**: A production-grade cognitive event system and agent orchestration platform for AI coding assistants.

Built on top of OpenCode's agent framework, this system adds event-driven architecture, state management, graph-based reasoning, dependency intelligence, and automated governance — turning a basic AI coding assistant into a governed, self-auditing development platform.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Agentic Coder OAC Platform                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OpenCode Runtime  ──►  Plugin Entry  ──►  Priority Router  │
│                                              │              │
│                          ┌───────────────────┼──────────┐   │
│                          ▼                   ▼          ▼   │
│                    Tier 1 (Sync)      Tier 2 (Async)  T3   │
│                    ┌────────────┐  ┌──────────────┐  Def  │
│                    │update-reg. │  │check-deps    │  erred │
│                    │invalidate  │  │analyze-drift │       │
│                    │session-mgr │  │              │       │
│                    └─────┬──────┘  └──────┬───────┘       │
│                          └──────┬─────────┘               │
│                                 ▼                          │
│                        RuntimeAdapter                      │
│                   (file I/O, crypto, dispatch)              │
│                                                             │
├────────────────── Tool Layer ─────────────────────────────┤
│  context-resolver  │  prompt-compiler  │  external-gateway │
│  (5 modules)       │  (4 modules)      │  (whitelisted     │
│                    │                   │   API proxy)      │
├────────────────── Supervision ────────────────────────────┤
│  ArchitectureSupervisor  │  ProjectManagerSupervisor      │
│  MemoryCurator           │  GraphQueryEngine              │
├────────────────── Governance ─────────────────────────────┤
│  Inferred/Verified State  │  Daily Consolidation Scanner │
│  Graph Engine (BFS/DFS)   │  Knowledge Graph (Graphify)  │
│  Dependency Intelligence  │  PR Review Bot               │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Event Processing System
3-tier priority router with 7 handlers:
- **Tier 1 — Sync** (`update-registry`, `invalidate-cache`, `session-manager`): Critical state mutations, run synchronously
- **Tier 2 — Async** (`check-dependencies`, `analyze-drift`): Background analysis, fire-and-forget
- **Tier 3 — Deferred** (`weekly-audit`, `ecosystem-watch`): Scheduled maintenance, queued

### Architecture Graph
- Curated 24-node graph of all system modules
- BFS, DFS, blast radius, cycle detection, orphan finding
- Inferred (provisional) + Verified (authoritative) split
- 11 documented architecture patterns with confidence scoring

### 3 Deep-Audit Supervisors
| Supervisor | Scope | Trigger |
|---|---|---|
| **ArchitectureSupervisor** | Drift detection, consistency scoring | `/audit architecture` |
| **ProjectManagerSupervisor** | Feature completeness, route mapping | `/audit features`, `/audit routes` |
| **MemoryCurator** | PI file hygiene, contradiction detection | `/audit memory` |

### Dependency Intelligence
- **Automatic CVE detection** on every dependency change — queries OSV.dev via ExternalGateway
- **Version drift monitoring** — checks npm registry for latest versions
- **Risk classification** — auto-scores dependency risk as none/low/medium/high/critical
- **Rich reports** — per-package CVE list with upgrade recommendations

### PR Review Bot
- **4 drift detectors**: architecture-sensitive paths, orphan files, naming conventions, handler patterns
- **Structured PR review output** — markdown formatted as GitHub PR comments with verdicts
- **GitHub integration** — `ExternalGateway.postPrComment()` posts reviews to PRs (requires `GITHUB_TOKEN`)

### State Management
- Inferred/verified split with schema validation
- Snapshot-before-write rollback safety
- 6 inferred + 3 verified registries (features, architecture, dependencies, test-coverage, feedback)

### Graph Reasoning Layer
- `GraphEngine` with BFS, DFS, blast radius, cycle detection, topological sort
- Impact analyzer for change risk assessment
- Cross-registry feature-to-node linking

### Tool Modules
| Module | Files | Purpose |
|---|---|---|
| **context-resolver** | 5 | Fingerprint, chunk loading, dependency resolution, entropy scanning |
| **prompt-compiler** | 4 | 3-tier cache, template engine, symbol registry |
| **external-gateway** | 1 | Whitelisted API proxy (npm, osv.dev, github) |

### Daily Consolidation Scanner
- `scripts/consolidation-scanner.ps1` — standalone PowerShell script
- 7 automated checks: metadata sync, contradictions, nav refs, stale dirs, graph orphans, capability gaps, graphify cross-ref
- Outputs JSON reports — no API calls, no LLM dependency
- Can be registered as a scheduled task

### Knowledge Graph (Graphify)
- 8,686-node AST-level graph of the entire codebase
- `graphify export callflow-html` generates interactive Mermaid architecture diagrams
- `/graphify .` rebuilds when code changes

### Test Infrastructure
- 24 test files, 233 passing tests, 0 failing
- 83.5% statement coverage
- All 7 handlers tested at 100%
- Graph engine: 98.5%, impact analyzer: 96.8%

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python (optional, for graphify) | 3.10+ | `python --version` |
| PowerShell (Windows only) | 5.1+ | `$PSVersionTable.PSVersion` |

---

## Quick Start

```bash
# 1. Install dependencies
cd .opencode
npm install
cd ..

# 2. Verify the system runs
cd .opencode
npx vitest run
cd ..

# 3. Run the consolidation scanner
powershell -File scripts/consolidation-scanner.ps1
```

### Optional: Build the Knowledge Graph

```bash
# Install graphify (requires Python 3.10+)
pip install graphifyy

# Build the graph
python -m graphify update .

# Generate interactive architecture diagrams
python -m graphify export callflow-html
# Open graphify-out/opencode1-callflow.html in a browser
```

### Optional: Register Daily Health Scanner

```powershell
# Run as Administrator
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$PWD\scripts\consolidation-scanner.ps1`" -Quiet"
$trigger = New-ScheduledTaskTrigger -Daily -At 09:00
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName "OAC-Consolidation-Scanner" `
    -Action $action -Trigger $trigger -Principal $principal
```

---

## Slash Commands

| Command | Supervisor | Purpose |
|---|---|---|
| `/audit features` | ProjectManagerSupervisor | Feature completeness audit |
| `/audit routes` | ProjectManagerSupervisor | Route/flow mapping |
| `/audit architecture` | ArchitectureSupervisor | Architecture drift detection |
| `/audit dependencies` | ProjectManagerSupervisor | Dependency ecosystem analysis |
| `/audit memory` | MemoryCurator | Memory hygiene and consolidation |
| `/audit health` | All supervisors | Full system health check |
| `/graph .` | Graphify | Build knowledge graph |
| `/graph query "..."` | Graphify | Query the knowledge graph |
| `/scan-state` | — | Bootstrap state registries |
| `/context` | ContextOrganizer | Context file management |

---

## Development

### Project Structure

```
.opencode/
├── config/                  # Agent metadata, consolidation tracking
├── context/                 # MVI context system (179 files)
│   ├── core/               # Standards, workflows, system docs
│   ├── project-intelligence/ # Business, technical, decision docs
│   ├── development/        # Dev guides per stack
│   └── ui/                 # Design system, animation, patterns
├── events/                  # Event processing system
│   ├── router/             # Priority router (3-tier dispatch)
│   ├── handlers/           # 7 handlers (sync/async/deferred)
│   └── adapters/           # RuntimeAdapter (Bun implementation)
├── graph/                   # Graph reasoning engine
│   ├── engine/             # GraphEngine, ImpactAnalyzer, QueryBuilder
│   ├── queries/            # Blast radius, orphans, dependents
│   └── schemas/            # Graph schema types
├── state/                   # State management
│   ├── inferred/           # Provisional, AI-generated
│   ├── verified/           # Authoritative, human-confirmed
│   └── snapshots/          # Pre-write rollback points
├── tool/                    # Tool modules
│   ├── context-resolver/   # 5 modules
│   ├── prompt-compiler/    # 4 modules
│   └── external-gateway/   # Whitelisted API proxy
├── tests/                   # 24 test files, 233 tests
├── skills/                  # System skills (context7, task-mgmt)
│   Agent definitions        # 30 agents in 10 categories
└── command/                 # 16 slash commands
```

### Running Tests

```bash
cd .opencode

# Run all tests
npx vitest run

# Watch mode
npx vitest

# With coverage
npx vitest run --coverage
```

### Health Scores

The system tracks 6 health dimensions in `.opencode/state/project/project-health.json`:

| Dimension | Current Score | Monitored By |
|---|---|---|
| Feature Completeness | 0.94 | ProjectManagerSupervisor |
| Architecture Consistency | 0.94 | ArchitectureSupervisor |
| Dependency Health | 0.97 | Dependency Intelligence Handler |
| Memory Hygiene | 0.93 | MemoryCurator |
| Documentation Coverage | 0.92 | Manual |
| Test Coverage | 0.96 | BuildAgent |
| **Overall** | **0.95** | All supervisors |

---

## Configuration

### Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | For PR comments | GitHub API token for posting PR review comments |
| (Any LLM API key) | For graphify full extraction | `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` |

### System-Level Skills

Some skills live at `~/.agents/skills/` (system-level, not in this repo):
- `find-skills` — Skill discovery
- `shadcn` — Shadcn/ui component management
- `shadcn-component-discovery` — Component registry search
- `humanizer` — Content humanization

These are referenced by the feature registry but installed independently.

---

## Repository

**Source:** https://github.com/emagero0/Agentic-Coder

---

## License

MIT — see LICENSE file.
