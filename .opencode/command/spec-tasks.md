# /spec.tasks

Break implementation plan into actionable, ordered tasks.

## Prerequisites
- spec.md and plan.md exist in `specs/{N}-{feature}/`

## Behavior
1. Read plan.md and spec.md
2. Generate tasks grouped by user story (US1 first = MVP)
3. Mark parallel tasks with `[P]` prefix
4. Write to `specs/{N}-{feature}/tasks.md` using `.opencode/templates/tasks-template.md`

## Task format
- `T001 [P] [US1] Model: src/models/x.py`
- Each task has exactly one file path
- Tests listed before implementation
- Checkpoints after each user story phase

## Output constraints
- One line per task — no descriptions, no JSON
- No box-drawing phase separators (use `---` only)
- Max 3 tasks per story for tests (if requested)
