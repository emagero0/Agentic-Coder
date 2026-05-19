# /spec.implement

Execute all tasks from the spec pipeline in order.

## Prerequisites
- constitution.md, spec.md, plan.md, tasks.md all exist

## Behavior
1. Read tasks.md from `specs/{N}-{feature}/`
2. Execute tasks in order: Setup → Foundation → US1 → US2 → ...
3. Within each phase: run `[P]` tasks in parallel, sequential tasks in order
4. Validate after each phase (type-check, lint, test)
5. Stop on failure — report error, propose fix, wait for approval
6. Use CoderAgent for individual tasks, BatchExecutor for 5+ parallel

## Execution rules
- Tests before implementation within each US
- No parallel execution of tasks touching same files
- No file edits without loading context files first
- Report progress as: `Phase N/N complete (X/Y tasks)`
- No emoji, no box-drawing in progress reports
