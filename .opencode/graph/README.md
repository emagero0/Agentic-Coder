# Graph Reasoning Layer — OAC Phase 5

This directory contains the Graph Reasoning Layer, which enables relationship-aware cross-cutting queries over the verified architecture state.

## Purpose

Instead of reading individual registries in isolation, agents can now ask questions that span the entire architecture:

| Question | Command |
|----------|---------|
| What breaks if I change X? | `/graph blast-radius {node-id}` |
| What depends on this module? | `/graph dependents {node-id}` |
| What is dead code? | `/graph orphans` |
| Does feature Y have full coverage? | `/graph feature-coverage {feature-id}` |
| Are there circular dependencies? | `/graph cycles` |
| What is the overall graph health? | `/graph stats` |

## Directory Structure

```
graph/
├── README.md                          ← this file
├── engine/
│   ├── graph-engine.ts               ← core BFS/DFS traversal + cycle detection
│   ├── query-builder.ts              ← fluent chainable query API
│   └── impact-analyzer.ts            ← blast radius + formatted impact reports
├── schemas/
│   └── graph-schema.ts               ← TypeScript types for all graph structures
└── queries/
    ├── find-dependents.ts             ← "what depends on X?"
    ├── find-blast-radius.ts           ← "what breaks if X changes?"
    ├── find-orphans.ts                ← "what has no relationships?"
    └── find-feature-coverage.ts       ← "which nodes implement feature Y?"
```

## Data Source

The graph engine reads from:
```
state/verified/architecture/architecture-graph.json
```

This file is populated by the `ArchitectureSupervisor` during `/audit architecture`. If it has 0 nodes, run `/audit architecture` first.

## Design Constraints

- **Read-only**: The graph engine never writes to state files
- **No external dependencies**: All algorithms use standard Node.js built-ins
- **No database**: The graph operates entirely over the JSON state file
- **Composable**: All query modules export pure functions — no side effects

## Usage Example

```typescript
import { GraphEngine } from "./engine/graph-engine.js";
import { findBlastRadius } from "./queries/find-blast-radius.js";
import { findOrphans } from "./queries/find-orphans.js";

const engine = new GraphEngine();
await engine.load("state/verified/architecture/architecture-graph.json");

// Blast radius
const blast = await findBlastRadius(engine, "auth-middleware");
console.log(blast.report.formatted);

// Orphans
const orphans = findOrphans(engine);
console.log(`${orphans.count} dead code candidates detected.`);
```

## Phase Integration

| Supervisor | Integration |
|-----------|-------------|
| `ArchitectureSupervisor` | Blast radius appended to each drift alert |
| `ProjectManagerSupervisor` | Feature coverage check during `/audit features` |
| `MemoryCurator` | Orphan detection in memory hygiene report |
