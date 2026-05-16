<!-- Context: project-intelligence/technical | Priority: high | Version: 1.0 | Updated: 2026-05-12 -->

# Technical Domain

> Document the technical foundation, architecture, and key decisions for the OpenCode OAC platform.

## Quick Reference

- **Purpose**: Understand how the project works technically
- **Update When**: New features, refactoring, tech stack changes
- **Audience**: Developers, DevOps, technical stakeholders

## Primary Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Language | TypeScript | 6.0.x | Static typing for agent-scale codebases; native ESM support |
| Runtime | Bun (primary), Node (secondary), Deno (planned) | Latest | Fast startup (critical for CLI tool), built-in TS support, cross-platform |
| Core Packages | @opencode-ai/plugin, @opencode-ai/sdk | 1.14.48 | OpenCode's own plugin system and SDK for agent orchestration |
| Effect System | effect (smol fork — stripped of `io`/`fiber`/`scope`) | 4.0.0-beta.59 | Typed functional effects for state and error management; smol fork keeps bundle small |
| Schema Validation | zod | 4.1.8 | Runtime schema validation for state, configuration, and API responses |
| Task Registry | File-based (Markdown + frontmatter) | N/A | Zero infrastructure, git-trackable, scriptable |
| Agent Routing | Metadata-based capability registry | N/A | Deterministic, debuggable, no ML dependency for routing decisions |
| Context Cache | 3-tier (L1 memory, L2 disk, L3 computed) | N/A | Minimizes redundant computation; tiered for speed/capacity trade-off |

## Architecture Pattern

```
Type: Agent-based orchestration platform
Pattern: 3-tier event processing + MVI context system + Inferred/verified state split
Diagram: See `.opencode/context/core/system/context-guide.md` for system interactions
```

```
                    ┌─────────────────────────────────────┐
                    │         OpenCode OAC Platform        │
                    └─────────────────────────────────────┘
                                      │
            ┌──────────────┬──────────┴──────────┬──────────────┐
            ▼              ▼                     ▼              ▼
    ┌─────────────┐ ┌───────────┐ ┌──────────────────┐ ┌──────────────┐
    │ Event       │ │ Context   │ │ Cognitive         │ │ State        │
    │ System      │ │ System    │ │ Platform          │ │ Management   │
    │ (3-tier)    │ │ (MVI)     │ │ (Graph Reasoning) │ │ (Inf/Ver)    │
    └──────┬──────┘ └─────┬─────┘ └───────┬──────────┘ └──────┬───────┘
           │              │               │                   │
           └──────────────┴───────────────┴───────────────────┘
                                      │
                              ┌───────┴───────┐
                              │ RuntimeAdapter │
                              │ (Bun/Node/Deno)│
                              └───────────────┘
```

### Why This Architecture?

The OAC platform must be simultaneously responsive to user input, thorough in background analysis, and extensible via plugins. A monolithic architecture would couple these concerns; a microservice architecture would be over-engineered for a single-process agent runtime.

The **3-tier event system** decouples urgency levels without infrastructure overhead. The **MVI context system** provides structured knowledge for agents without a database. The **inferred/verified state split** prevents AI hallucinations from corrupting ground truth. The **RuntimeAdapter** keeps the door open for non-Bun runtimes without committing to support them today.

This architecture prioritizes simplicity, testability, and zero-infrastructure operation. Every component can run on a developer's laptop with no Docker, no database, and no message broker.

## Project Structure

```
.opencode/                          # OpenCode configuration root
├── config/                         # OpenCode configuration files
│   ├── agent-metadata.json         # Agent registration metadata
│   └── opencode.json               # Core OpenCode config
├── context/                        # MVI context system (100+ files)
│   ├── core/                       # Core context: system, standards, project-intelligence
│   │   ├── context-system/         # Context system operations & guides
│   │   ├── standards/              # Standards documents (frontmatter, MVI, etc.)
│   │   ├── system/                 # System-level context
│   │   └── engine/                 # Core engine context
│   ├── project-intelligence/       # THIS FOLDER — project-level strategic context
│   ├── concepts/                   # Function-based: conceptual knowledge
│   ├── examples/                   # Function-based: usage examples
│   ├── guides/                     # Function-based: step-by-step guides
│   ├── lookup/                     # Function-based: reference data
│   └── errors/                     # Function-based: error patterns & fixes
├── skills/                         # Registered skills
│   ├── task-management/            # Task management skill (8 CLI commands)
│   └── context7/                   # Context7 live documentation skill
└── state/                          # State management (inferred/verified split)
    ├── inferred/                   # AI-inferred state (unverified)
    └── verified/                   # Human/schema-verified state
    └── snapshots/                  # Pre-write snapshots for rollback
```

**Key Directories**:
- `context/` — The MVI context system. Every `.md` file serves one purpose, is under 200 lines, and has frontmatter metadata. Agents load this directory to understand project conventions.
- `context/core/context-system/` — Operations for creating, updating, organizing, and harvesting context. Contains guides like `creation.md` and operations like `harvest.md`.
- `context/core/standards/` — The rulebook for context: frontmatter format, MVI principles, project-intelligence management, and cross-referencing patterns.
- `skills/` — Registered skill implementations. Each has a `SKILL.md` that defines its interface and documentation.
- `state/` — Split into `inferred/` and `verified/` directories. Snapshots are ISO-8601 timestamped files in `snapshots/`.

## Key Technical Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Priority routing table (not queues) | Simpler, no broker dependency, trivially testable | No built-in retry; Tier 3 best-effort only |
| Inferred/verified state split | Prevents AI output corruption of verified data | Requires explicit promotion step; adds workflow overhead |
| RuntimeAdapter interface | Testability, portability, explicit runtime dependencies | Every runtime-dependent module needs adapter injection |
| MVI <200 line constraint | Agent-scannable, low token cost, focused files | Manual cross-file navigation; no graph view |
| Snapshot-before-write | Zero-infrastructure safety net | Unbounded snapshot growth; needs TTL cleanup |
| smol effect fork | Reduced bundle size | No `Effect.retry`, `Effect.fiber`; divergence risk from upstream |
| Metadata-based agent routing | Deterministic, debuggable, fast | Requires manual agent registration and capability maintenance |

See `decisions-log.md` for full decision history with alternatives.

## Integration Points

| System | Purpose | Protocol | Direction |
|--------|---------|----------|-----------|
| Context7 API | Live library documentation retrieval | HTTPS/REST | Outbound (agent → Context7) |
| Filesystem (state) | Inferred/verified state persistence | File I/O via RuntimeAdapter | Internal |
| Filesystem (context) | Context file loading | File I/O via RuntimeAdapter | Internal |
| Filesystem (tasks) | Task management persistence | File I/O via RuntimeAdapter | Internal |
| OpenCode CLI | User interaction and agent invocation | CLI stdio | Inbound (user → OAC) |
| External LLM providers | Agent reasoning (via OpenCode SDK) | HTTPS (via @opencode-ai/sdk) | Outbound (agent → LLM) |

## Technical Constraints

| Constraint | Origin | Impact |
|------------|--------|--------|
| Bundle size must stay lean | CLI tool expectation (fast startup) | Effect smol fork, no heavy frameworks, minimal dependencies |
| No external infrastructure dependencies | Zero-install design principle | Everything runs locally; no database, no broker, no Docker required |
| Single-process architecture | Agent runtime model | All 3 event tiers share the same process; Tier 3 blocking could affect Tier 1 |
| RuntimeAdapter must be initialized first | Plugin module loading order | Bootstrap ordering is fragile; enforced in a single bootstrap file |
| Context files must be agent-readable | MVI principle | Plain markdown with frontmatter; no HTML, no complex formatting, no binary formats |

## Development Environment

```
Setup: bun install (from project root)
Requirements: Bun 1.1+, Node 20+ (for secondary targets), TypeScript 6.0+
Local Dev: bun run dev (hot reload via Bun's --watch)
Testing: bun test (uses Bun's built-in test runner)
Lint: biome check src/
Format: biome format --write src/
```

## Deployment

```
Environment: The OAC platform runs inside OpenCode — it's not deployed as a standalone service
Platform: OpenCode CLI (executes on the user's machine)
CI/CD: Not applicable (no server deployment); testing via bun test
Monitoring: None for the OAC platform itself (relies on OpenCode observability)
```

## Onboarding Checklist

- [x] Know the primary tech stack (Bun, TypeScript 6.0, effect, zod)
- [x] Understand the architecture pattern and why it was chosen
- [x] Know the key project directories and their purpose
- [x] Understand major technical decisions and rationale
- [x] Know integration points and dependencies
- [x] Be able to set up local development environment
- [x] Know how to run tests and deploy
- [x] Understand the 3-tier event system and its limitations
- [x] Know the RuntimeAdapter pattern and initialization requirements

## Related Files

- `business-domain.md` - Why this technical foundation exists
- `business-tech-bridge.md` - How business needs map to technical solutions
- `decisions-log.md` - Full decision history with context
