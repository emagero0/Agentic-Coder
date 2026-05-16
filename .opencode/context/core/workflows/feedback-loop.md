<!-- Context: core/workflows/feedback-loop | Priority: critical | Version: 1.0 | Updated: 2026-05-16 -->

# Agent Feedback Loop System

**Purpose**: Self-correcting feedback loop that records agent errors, compresses them into rules, decays old lessons, and injects active rules into agent context — all within a fixed token budget.

---

## Architecture

```
Execution completes (or fails)
        ↓
  1. RECORD → Error/outcome written to error-registry.json
        ↓
  2. COMPRESS → Raw error → compact rule (≤200 chars)
        ↓
  3. DECAY → All rules have weight that fades over time
        ↓
  4. EVICT → Rules below threshold removed from active set
        ↓
  5. INJECT → Active rules loaded into agent context on next task
        ↓
  6. REINFORCE → If same error recurs, weight resets to 1.0
        ↓
  (loop)
```

**Token budget**: Fixed at ~350 tokens per execution (not growing with history).

---

## Data Files

| File | Purpose | Location |
|------|---------|----------|
| Error Registry | Full error log with weights, timestamps, context | `state/inferred/feedback/error-registry.json` |
| Active Rules | Currently active compressed rules for injection | `state/inferred/feedback/active-rules.json` |

---

## Agent Protocol

### Pre-Execution (Context Loading Phase)

Before executing any task, agents MUST load the active rules:

```javascript
// 1. Read the active rules file
// 2. Filter rules matching this agent_id and task_type
// 3. Apply them as context constraints
```

Active rules are loaded via ContextScout just like any other context file. The rules appear as compact directives at the top of the agent's working context.

### Post-Execution (Recording Phase)

After execution completes (success or failure), if a notable event occurred:

```javascript
// 1. Check if the task had a failure or quality issue
// 2. If yes → compose a compressed rule (≤200 chars)
// 3. If no → call the decay engine (passively age all rules)
```

---

## Decay Engine

Each feedback rule has a **weight** that decays over time:

```
Rule added → weight = 1.0
Each clean execution (no recurrence) → weight *= 0.8
If weight < 0.2 → evicted from active-rules.json
If rule fires again → weight resets to 1.0
```

**Properties**:
- One-off mistake: ~8 clean sessions → evicted
- Recurring pattern: stays active indefinitely (weight keeps resetting)
- Token cost: fixed — never grows with history

### Eviction Criteria

A rule is evicted from `active-rules.json` when:
1. `weight < eviction_threshold` (default: 0.2) — stale, not recurring
2. `agent_rules[agent_id].length > max_active_rules_per_agent` — oldest/lowest-weight rule removed
3. `global_rules.length > max_active_rules` — lowest-weight global rule removed

Evicted rules remain in `error-registry.json` (full history preserved). They can be re-promoted if the error recurs.

---

## Compression Rules

Raw errors MUST be compressed to compact rules before entering the active set:

| Raw Error | Compressed Rule | Tokens Saved |
|-----------|----------------|--------------|
| "On 2026-03-12, coder-agent wrote SQL query without parameterizing user input, causing injection vulnerability. Fix was to use parameterized queries with ? placeholders." | `RULE: Always parameterize SQL queries — never interpolate user input into SQL strings.` | 380 → 15 |
| "Agent generated HTML with inline onclick handlers, failed security review because of XSS risk. Fixed by using addEventListener and proper content sanitization." | `RULE: Never use inline event handlers (onclick, onload, etc.) — use addEventListener or framework event binding.` | 310 → 18 |
| "Test assertions were weak — only checking status codes, not response bodies or error states. Review flagged it." | `RULE: Assert response bodies AND status codes in tests — status alone is insufficient.` | 280 → 17 |

**Rules for compression**:
- Target max 200 characters per rule
- Start with `RULE:` prefix
- State the DO/DON'T first, then the rationale
- Use imperative mood
- Keep agent-agnostic where possible (apply to all agents)

---

## Agent Rules Index

Active rules are indexed by agent in `active-rules.json`:

```json
{
  "agent_rules": {
    "coder-agent": [
      "RULE: Always parameterize SQL queries — never interpolate user input into SQL strings.",
      "RULE: Assert response bodies AND status codes in tests — status alone is insufficient."
    ],
    "tester": [
      "RULE: Test edge cases (empty input, null, max length) — not just happy path.",
      "RULE: Use describe/it blocks — flat test functions reduce readability."
    ],
    "openagent": [
      "RULE: Always load context files before executing — never assume project conventions."
    ]
  },
  "global_rules": [
    "RULE: Never commit .env files or credentials — verify .gitignore before staging."
  ]
}
```

---

## Integration Points

| Workflow Phase | Feedback Hook | What Happens |
|----------------|---------------|-------------|
| Context loading (pre-execution) | Inject active rules | Rules loaded from active-rules.json filtered by agent_id + task_type |
| Self-Review Loop | Auto-record | If self-review catches an issue, log it as a low-severity error |
| stop_on_failure triggered | Manual record | Supervisor routes failure to FeedbackSupervisor for recording |
| CodeReviewer completes | Manual record | Reviewer's findings can be fed back as rules |
| /audit feedback | Full review | FeedbackSupervisor deep scan: check decay, promote/demote rules |

---

## Manual Commands

| Command | Trigger | Action |
|---------|---------|--------|
| `/audit feedback` | FeedbackSupervisor deep audit | Full feedback loop scan: list active rules, check decay, promote/demote |
| `/audit feedback rules` | Fast check | List all active rules grouped by agent |
| `/audit feedback errors` | Error history | Show error registry summary |

---

## Token Budget

```
Per-execution cost:
├── Load active rules (max 10 rules × ~50 chars)  ~100 tokens
├── Decay engine (read + update weights)           ~50 tokens
├── Post-exec recording (only on error)            ~100 tokens
├── Compression (only on error)                    ~100 tokens
└── Total overhead                                 ~250-350 tokens
```

This is **fixed** — it does not grow with the number of historical errors.

---

## Guardrails

1. **Never auto-inject without decay** — rules must decay to prevent bloat
2. **Never exceed max_active_rules** — cap of 10 global, 5 per agent
3. **Never record without compression** — raw errors go to registry only, active rules are always compressed
4. **Never override human judgment** — feedback rules are suggestions, not hard constraints
5. **Always require human approval** for rule promotion to "permanent" status (weight locked at 1.0)
