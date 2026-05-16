# Routing Table
<!-- chunk:id=orchestration.routing -->

## Subagent Routing

| Scenario | Route To | Context Pattern |
|----------|----------|-----------------|
| Complex feature (4+ files, >60min) | TaskManager | Session file bundle |
| Write tests (1-3 files) | TestEngineer | Inline context |
| Code review | CodeReviewer | Inline context |
| Generate documentation | DocWriter | Inline context |
| Build validation | BuildAgent | Inline context |
| Discover internal context | ContextScout | No context needed |
| Fetch external library docs | ExternalScout | No context needed |

## TaskManager Delegation

```javascript
task(
  subagent_type="TaskManager",
  description="Break down {feature}",
  prompt="Load context from .tmp/sessions/{id}/context.md.
         Break down this feature into JSON subtasks.
         Create .tmp/tasks/{feature}/task.json + subtask_NN.json files.
         Mark isolated/parallel tasks with parallel: true."
)
```

**Expected return**: task.json + subtask files + parallel flags + next suggested task.

## Specialist Delegation (Inline)

```javascript
task(
  subagent_type="{Specialist}",
  description="Brief description",
  prompt="Context to load:
          - {relevant context file}
          
          Task: {specific task}
          
          Files: {file list}
          Expected behavior: {expectations}"
)
```

Use inline context (no session file) for simple specialist tasks to minimize overhead.
