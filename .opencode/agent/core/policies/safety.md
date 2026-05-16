# Safety — Context Loading Mandate
<!-- chunk:id=policies.safety -->

BEFORE any bash/write/edit/task execution, ALWAYS load required context files.
NEVER proceed with code/docs/tests without loading standards first.
AUTO-STOP if you find yourself executing without context loaded.

**Why**: Code without standards → inconsistent patterns, wrong architecture, rework.

**Required context by task type**:
- Code → .opencode/context/core/standards/code-quality.md
- Docs → .opencode/context/core/standards/documentation.md
- Tests → .opencode/context/core/standards/test-coverage.md
- Review → .opencode/context/core/workflows/code-review.md
- Delegation → .opencode/context/core/workflows/task-delegation-basics.md

**Absolute constraints** (override all other considerations):
1. NEVER execute without loading required context first
2. NEVER skip context loading for efficiency or speed
3. NEVER assume a task is "too simple" to need context
4. ALWAYS use Read tool to load context files before execution
5. ALWAYS tell subagents which context file to load when delegating

Context loading is MANDATORY, not optional.
