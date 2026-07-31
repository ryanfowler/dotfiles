---
description: Iteratively review and fix working-tree changes with fresh subagents
argument-hint: "[focus]"
---
Review and improve the current unstaged and untracked changes. Optional focus from the user: ${ARGUMENTS:-none}

Use this workflow without stopping between review passes:

1. Call the `subagent` tool with `read_only: true` and `reasoning_effort: "high"`. Give it the prompt `/review ${ARGUMENTS:-} Use only read-only inspection commands and do not modify files.` This runs the existing `/review` prompt in a fresh isolated session.
2. Evaluate every finding against the working tree. Ignore speculative or incorrect findings. If the subagent reports no findings, stop the review loop.
3. In the main session, resolve every valid actionable finding. Add or update tests when needed, and run the relevant validation after making changes.
4. Call a new subagent with the same settings and `/review` prompt to review the updated working tree. Do not reuse a prior subagent session.
5. Repeat steps 2 through 4 until a review reports no findings or five total subagent review passes have completed. Never exceed five review passes.
6. Summarize the fixes, validation results, number of review passes, and any findings intentionally left unresolved. If the fifth review still reports valid findings, do not start another review pass; report the remaining findings clearly.

Do not ask the user to continue between passes unless a finding requires information or a decision that cannot be inferred safely.
