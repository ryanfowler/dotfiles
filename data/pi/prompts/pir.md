---
description: Plan, implement, and iteratively review a task with subagents
argument-hint: "<implementation task>"
---
Complete the following implementation task end-to-end:

$ARGUMENTS

Use this workflow without stopping between phases:

1. Call the `subagent` tool with `read_only: true` to create a concrete implementation plan. Choose `gpt-5.6-luna` or `gpt-5.6-sol` and a reasoning effort appropriate for this planning task. Tell it to inspect the repository thoroughly, use only read-only shell commands, and return a concise ordered plan without modifying files.
2. Implement the task yourself according to that plan. Modify the working tree, add or update tests, and run the relevant checks. Do not merely describe the implementation.
3. Call another `subagent` against the live checkout with `read_only: true`. Choose `gpt-5.6-luna` or `gpt-5.6-sol` and a reasoning effort appropriate for the scope, complexity, and risk of the review. Include the original task and plan in its prompt. Tell it to inspect staged, unstaged, and untracked changes using only read-only commands such as `git status`, `git diff`, and `git ls-files`; use `web_search` and `web_fetch` when external documentation or current information would help verify a finding; review correctness, resource handling, concurrency, performance, compatibility, security, test coverage, complexity, and completeness; and return only actionable findings or exactly `No actionable findings.`
4. If the reviewer reports actionable findings, resolve every valid finding, update and run tests as needed, then repeat step 3. Stop after no actionable findings remain or after five total reviews.
5. Summarize the completed implementation, tests run, and any findings intentionally left unresolved.
