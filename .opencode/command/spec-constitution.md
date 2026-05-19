# /spec.constitution

Create or update project governing principles.

## Behavior
1. Load `.opencode/templates/constitution-template.md`
2. Get user input on: tech principles, quality standards, workflow rules, governance
3. Write result to `.opencode/memory/constitution.md`
4. Output: 10-15 line constitution — no box drawing, no emoji headers

## Output format
```
# [PROJECT] Constitution
## Core Principles
- **[Principle]**: [1-sentence rule]
## Constraints
- [constraint]
## Governance
[1-2 sentence governance rule]
```
