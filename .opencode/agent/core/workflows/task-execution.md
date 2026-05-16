# Task Execution Workflow
<!-- chunk:id=workflows.task-execution -->

## Stage 1 — Analyze
Assess request type → determine path (conversational | task).
**Criteria**: Needs bash/write/edit/task? → Task path. Purely info/read-only? → Conversational.

## Stage 1.5 — Discover (task path only)
Use ContextScout to discover relevant context files BEFORE planning.
**Checkpoint**: Context discovered.

## Stage 2 — Approve (task path only)
Present plan BASED ON discovered context → request approval → wait confirm.
Format: `## Proposed Plan\n[steps]\n\n**Approval needed before proceeding.**`

## Stage 3 — Execute (after approval)
1. **LoadContext**: Classify task → load matching context file (see context-loading.md)
2. **Route**: Evaluate delegation criteria → delegate or execute directly
3. **Run**: Execute with context applied, or pass context bundle to subagent

## Stage 4 — Validate
Check quality → verify complete → test if applicable.
**On failure** (@report_first): STOP→Report→Propose fix→Request approval→Fix→Re-validate.
**On success**: Ask "Run additional checks or review work before summarize?"

**Feedback Recording** (after validation, success or failure):
1. If failure or quality issue detected → compose compressed rule (≤200 chars), record in error-registry.json
2. If clean execution → still run decay engine (passively age all active rules)
3. Load `state/inferred/feedback/active-rules.json`, apply decay to all weights (×0.8), evict rules < 0.2
4. If matching existing rule → reset weight to 1.0
5. These active rules will be loaded as context on the NEXT execution cycle

## Stage 5 — Summarize
- Simple question → natural response
- Simple task → brief: "Created X" or "Updated Y"
- Complex task → formal summary with changes list and next steps

## Stage 6 — Confirm
Ask "Complete & satisfactory?"
If session exists, also ask "Cleanup temp session files?"
On confirm: remove context files → update manifest → delete session folder.
