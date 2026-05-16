> **STATUS: NOT YET IMPLEMENTED** — Requires experiment sandbox handler
> This command definition describes the intended behavior, but no handler exists yet.

# /experiment

Create and manage isolated R&D experiments with a hybrid sandbox model.

## Usage

```
/experiment create "{hypothesis}"    — create and run a new sandboxed experiment
/experiment status {id}              — check status and current findings of an experiment
/experiment list                     — list all experiments with status and results
/experiment conclude {id}            — mark experiment as concluded and promote findings
```

## Sandbox Model

**Ephemeral Execution** (OS temp dir — automatically destroyed after run):
- Windows: `%TEMP%\opencode-experiments\{id}\`
- Unix: `/tmp/opencode-experiments/{id}/`

**Persistent Intelligence** (committed to project — survives across sessions):
- `research/experiments/{id}/manifest.json`
- `research/experiments/{id}/results.md`
- `research/experiments/{id}/reproducibility.md`

Production codebase is **never touched**.

## Behavior

### `/experiment create "{hypothesis}"`

1. Validate hypothesis is a testable claim (not vague speculation)
2. Generate unique experiment ID: `exp-{slug}-{YYYYMMDD}`
3. Register in `state/research/research-registry.json → experiments[]` with status `planned`
4. Create ephemeral sandbox
5. Write structured plan:
   - `hypothesis`: the claim being tested
   - `success_criteria`: measurable pass/fail conditions
   - `method`: step-by-step execution plan
6. Execute experiment within sandbox
7. Set status to `running`
8. Extract results to persistent path
9. Destroy ephemeral sandbox
10. Set status to `complete` with `result` and `confidence`

**Output on creation:**
```
Experiment Created
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ID:         exp-react-query-vs-swr-20260511
  Hypothesis: react-query has 30% lower bundle size than swr for our usage
  Status:     running
  Sandbox:    %TEMP%\opencode-experiments\exp-react-query-vs-swr-20260511\
  Artifacts:  .opencode/research/experiments/exp-react-query-vs-swr-20260511/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `/experiment status {id}`

Reads `research-registry.json` and returns current state:
```
Experiment: exp-react-query-vs-swr-20260511
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Status:     complete
  Result:     CONFIRMED — react-query bundle: 42kb, swr bundle: 31kb (hypothesis FAILED)
  Confidence: 0.92
  Completed:  2026-05-11T20:15:00Z
  Artifacts:  .opencode/research/experiments/exp-react-query-vs-swr-20260511/
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### `/experiment list`

Table of all experiments with ID, hypothesis (truncated), status, and completion date.

### `/experiment conclude {id}`

Marks experiment as `concluded`, summarizes findings, and appends to `research-registry.json → findings[]`.

## Constraints
- Ephemeral sandboxes are always destroyed after execution
- No package installs in the production project directory
- Experiments may not write to `state/verified/` or any non-research directory
- Each experiment must have measurable success criteria before execution begins
