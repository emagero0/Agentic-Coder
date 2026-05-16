# /graph

Query the architecture graph using the Graph Reasoning Layer (Phase 5).

## Usage

```
/graph blast-radius {node-id}       — what breaks if this node changes?
/graph dependents {node-id}         — what modules depend on this node?
/graph orphans                      — which nodes have no relationships?
/graph feature-coverage {feature}   — which nodes implement this feature?
/graph cycles                       — detect circular dependencies
/graph stats                        — overall graph summary statistics
```

## Prerequisites
Requires the verified architecture graph to be populated. If `/audit architecture` has not been run yet, the graph will be empty and all queries will return zero results.

## Behavior

### `/graph blast-radius {node-id}`

Computes the blast radius: all directly and transitively affected nodes if the specified node changes. Uses `ImpactAnalyzer` from `graph/engine/impact-analyzer.ts`.

```
Blast Radius: auth-middleware
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Severity:            HIGH
  Confidence:          90%
  Directly affected:   3 node(s)
    → user-service (service)
    → api-router (module)
    → dashboard-component (component)
  Transitively affected: 7 node(s)
    ⤷ profile-page
    ⤷ settings-page
    ...
  Affected features:   authentication, user-management
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Recommendation: High-risk change. 10 nodes affected. Review all dependents before modifying.
```

### `/graph dependents {node-id}`

All nodes that import or depend on the specified node (direct + transitive).

### `/graph orphans`

Finds nodes with no inbound AND no outbound edges. These are dead code candidates.
- Verified orphans: likely removable dead code
- Unverified orphans: may be scaffolding or entry points not yet mapped

### `/graph feature-coverage {feature-id}`

Cross-references a verified feature ID with the architecture graph to show which nodes implement it and whether coverage is complete, partial, or missing.

```
Feature Coverage: authentication
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Status:     PARTIAL
  Confidence: 60%
  Nodes:      2
    ✓ auth-middleware (module)
    ~ session-store (utility)
  Gaps:
    ⚠ No verified node for JWT validation logic
```

### `/graph cycles`

Detects circular dependency chains. Each cycle is listed as an ordered list of node IDs forming the loop.

### `/graph stats`

High-level overview of the current graph state:

```
Graph Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total nodes:          42
  Total edges:          87
  Verified nodes:       28
  Orphans:              3
  Cycles detected:      0
  Avg connectivity:     2.07
  Most connected:       api-router (12), auth-middleware (9), db-client (7)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Integration

These queries are also available to supervisors programmatically:
- `ArchitectureSupervisor` uses blast-radius during `/audit architecture`
- `ProjectManagerSupervisor` uses feature-coverage during `/audit features`
- `MemoryCurator` uses orphans during memory hygiene reports
