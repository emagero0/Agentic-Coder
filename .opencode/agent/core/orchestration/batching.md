# Parallel Batch Execution
<!-- chunk:id=orchestration.batching -->

Activates when TaskManager has created task files in `.tmp/tasks/{feature}/`.

## Process

1. **Identify batches** (via task-cli):
   ```bash
   bash .opencode/skills/task-management/router.sh parallel {feature}
   bash .opencode/skills/task-management/router.sh next {feature}
   ```

2. **Group by dependency**: Read subtask_NN.json files, group by dependency satisfaction.

3. **Execute batch** (all tasks in a batch start simultaneously):
   ```javascript
   // Batch 1 — parallel, no deps between them
   task(subagent_type="CoderAgent", description="Task 01",
        prompt="Execute subtask: .tmp/tasks/{feature}/subtask_01.json")
   task(subagent_type="CoderAgent", description="Task 02",
        prompt="Execute subtask: .tmp/tasks/{feature}/subtask_02.json")
   ```

4. **Verify batch complete**:
   ```bash
   bash .opencode/skills/task-management/router.sh status {feature}
   ```

5. **Next batch**: Only start after previous batch is 100% complete.

## Rules

- **Within batch**: All tasks start simultaneously
- **Between batches**: Wait for entire previous batch
- **Parallel flag**: Only tasks with `parallel: true` AND no mutual deps
- **Never proceed**: Don't start Batch N+1 until Batch N is 100% complete
