---
description: Implement, review, and commit a task
argument-hint: "<implementation task>"
---
Complete the following implementation task end-to-end:

$ARGUMENTS

Use this workflow without stopping between phases. Prompt templates cannot invoke other prompt templates, so execute the `/sub-review` and `/commit` workflows directly as described below.

1. **Implement:** Inspect the repository, modify the working tree, add or update tests, and run the relevant checks. Do not merely describe the implementation.
2. **Run the `/sub-review` workflow:**
   - Call the `subagent` tool with `read_only: true`. Use the current agent's model and thinking level unless the user explicitly requested an override.
   - Tell the subagent to review all unstaged and untracked changes with read-only commands and return only actionable findings or exactly `No actionable findings.`
   - Evaluate each finding and fix every valid actionable issue in the main session. Update and run tests as needed.
   - Repeat with a fresh subagent until no actionable findings remain or five review passes have completed. Do not exceed five passes.
3. **Run the `/commit` workflow:**
   - Inspect the repository state, diff, and recent commits. Determine the primary branch from `origin/HEAD`, then `main`, then `master`.
   - Run the applicable tests, linters, type checks, format checks, or builds. Stop and ask before committing if a relevant check fails or the changes are unsafe or unrelated.
   - If the current branch is the primary branch, create a concise topic branch. Otherwise, keep the current topic branch unless the user requested a different branch.
   - Stage only the intended changes and create a conventional commit with a subject under 72 characters.
   - Push the branch to `origin`, set its upstream when needed, and create a pull request against the primary branch with `gh pr create`.
   - Report the commit SHA and message, branch, push result, pull request URL, validation results, and any caveats.

Do not ask the user to continue between phases unless you need information or a decision that you cannot infer safely.
