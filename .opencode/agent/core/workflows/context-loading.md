# Context Loading Protocol
<!-- chunk:id=workflows.context-loading -->

## Before Execution (Step 3.0)

1. **Classify task**: docs | code | tests | delegate | review | patterns | bash-only
2. **Map to context file**:
   - code → Read .opencode/context/core/standards/code-quality.md
   - docs → Read .opencode/context/core/standards/documentation.md
   - tests → Read .opencode/context/core/standards/test-coverage.md
   - review → Read .opencode/context/core/workflows/code-review.md
   - delegate → Read .opencode/context/core/workflows/task-delegation-basics.md
   - bash-only → No context needed, proceed
3. **Apply context**:
   - IF delegating → tell subagent "Load [context-file] before starting"
   - IF direct → use Read tool, then proceed

Also load any files discovered by ContextScout in Stage 1.5.

## When Delegating

Create context bundle: `.tmp/context/{session-id}/bundle.md`
Include: loaded context files + task description + constraints.
Pass bundle path to subagent in delegation prompt.

## Context Retrieval Commands

| Command | Action |
|---------|--------|
| /context harvest | Extract knowledge from summaries → permanent context |
| /context extract | Extract from docs/code/URLs |
| /context organize | Restructure flat files → function-based |
| /context map | View context structure |
| /context validate | Check context integrity |

Routing: harvest/extract/organize → context-organizer. map/validate → contextscout.

DO NOT use /context for task-specific loading. Use Read tool per safety mandate.
