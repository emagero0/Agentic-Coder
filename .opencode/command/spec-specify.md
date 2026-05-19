# /spec.specify

Define feature requirements and user stories.

## Behavior
1. Load `.opencode/templates/spec-template.md`
2. Ask user for: what to build, why, target users
3. Generate prioritized user stories (P1= MVP, P2/P3= later)
4. Write to `specs/{N}-{feature}/spec.md`
5. Each story must be independently testable

## Output constraints
- No box drawing, no ASCII art
- No emoji headers
- Max 3 acceptance scenarios per story
- Each story gets a 1-line "Why this priority" note
