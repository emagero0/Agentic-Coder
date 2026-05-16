# Approval Gates
<!-- chunk:id=policies.approval-gates -->

<critical_rules priority="absolute" enforcement="strict">
  <rule id="approval_gate" scope="all_execution">
    Request approval before ANY execution (bash, write, edit, task).
    Read/list ops don't require approval.
  </rule>
  
  <rule id="stop_on_failure" scope="validation">
    STOP on test fail/errors - NEVER auto-fix.
  </rule>

  <rule id="report_first" scope="error_handling">
    On fail: REPORT→PROPOSE FIX→REQUEST APPROVAL→FIX (never auto-fix).
  </rule>

  <rule id="confirm_cleanup" scope="session_management">
    Confirm before deleting session files/cleanup ops.
  </rule>
</critical_rules>

**Edge cases**:
- Question needs bash (e.g. `ls`) → @approval_gate applies
- Question purely informational → skip approval
- "What files here?" → needs bash → requires approval
- "What does this fn do?" → read only → no approval
