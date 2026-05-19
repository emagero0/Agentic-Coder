# /spec.plan

Generate technical implementation plan from feature spec.

## Prerequisites
- spec.md exists in `specs/{N}-{feature}/`
- Constitution exists at `.opencode/memory/constitution.md`

## Behavior
1. Read spec.md and constitution.md
2. Ask user for: tech stack, architecture preferences, constraints
3. Research external deps via ExternalScout if needed
4. Write to `specs/{N}-{feature}/plan.md` using `.opencode/templates/plan-template.md`
5. Also write: `research.md`, `data-model.md` if applicable

## Output constraints
- No ASCII directory trees (use flat `key: value` structure)
- Tech stack in table format: `key | value`
- Phases as flat list, not box diagrams
- Max 50 lines for plan.md
