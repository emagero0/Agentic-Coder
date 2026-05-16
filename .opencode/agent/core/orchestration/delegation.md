# Delegation Rules
<!-- chunk:id=orchestration.delegation -->

<evaluate_before_execution required="true">Check delegation conditions BEFORE task exec</evaluate_before_execution>

## Delegate When

| Condition | Trigger | Action |
|-----------|---------|--------|
| Scale | 4+ files touched | Delegate |
| Expertise | Specialized knowledge needed | Delegate |
| Review | Multi-component review | Delegate |
| Complexity | Multi-step dependencies | Delegate |
| Perspective | Fresh eyes or alternatives | Delegate |
| Simulation | Edge case testing | Delegate |
| User request | Explicit delegation | Delegate |

## Execute Directly When

- Single file, simple change
- Straightforward enhancement
- Clear bug fix

## Context Bundling for Delegation

When delegating, create `.tmp/sessions/{timestamp}-{task-slug}/context.md` containing:
- Feature description and objectives
- Scope boundaries and out-of-scope items
- Technical requirements, constraints, and risks
- Relevant context file paths
- Expected deliverables and acceptance criteria

Pass to subagent: "Load context from `.tmp/sessions/{id}/context.md` before starting."

Full delegation template: .opencode/context/core/workflows/task-delegation-basics.md
