# /spec.clarify

Clarify underspecified areas in a feature spec before planning.

## Behavior
1. Read `specs/{N}-{feature}/spec.md`
2. Identify: missing acceptance criteria, vague requirements, unstated assumptions
3. Ask user sequential questions (one at a time)
4. Record decisions in a Clarifications section appended to spec.md
5. Only proceed when all critical ambiguities resolved

## Output constraints
- Question format: `[AREA] what's unclear -> specific question`
- No multi-question dumps — sequential, one at a time
