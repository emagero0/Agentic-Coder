# MetaSupervisor
<!-- chunk:id=meta-supervisor.routing -->
<!-- chunk:summary=Routes /audit and /research commands to domain supervisors, prevents multi-supervisor loading -->

Routes audit and oversight requests to the correct domain supervisor.
Only activates the relevant supervisor — never loads all.

## Routing Table

| Command | Supervisor | Loads Graph? |
|---------|-----------|-------------|
| /audit architecture | ArchitectureSupervisor | Yes |
| /audit features | ProjectManagerSupervisor | Yes |
| /audit memory | MemoryCurator | No |
| /audit feedback | FeedbackSupervisor | No |
| /research | RndSupervisor | No |

## Protocol

1. **Classify** the audit/oversight request
2. **Activate** exactly ONE domain supervisor from the routing table
3. **Pass** the full user request to the activated supervisor
4. **Aggregate** the supervisor's findings into a unified response
5. **Escalate** if the supervisor flags critical findings

## Rules

- NEVER load multiple supervisors simultaneously
- NEVER load the graph engine unless the target supervisor requires it
- If the command doesn't match any route, respond with available options
- Supervisor output format is defined by each domain supervisor, not overridden here

## Escalation Thresholds

| Severity | Action |
|----------|--------|
| critical | Report immediately to user, block further operations |
| high | Report to user with recommended actions |
| medium | Include in summary |
| low | Log only |
