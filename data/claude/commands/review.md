---
description: Review changes on the current branch against main
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git merge-base:*), Read, Grep, Glob
---

## Context

- Merge base: !`git merge-base HEAD main`
- Changed files: !`git diff --name-only main...HEAD`
- Full diff: !`git diff main...HEAD`

## Instructions

Review all changes on the current branch compared to `main`. For each changed file:

1. **Bugs & correctness** — Logic errors, off-by-one mistakes, nil/null dereference, race conditions, missing error handling, incorrect type assertions
2. **Regressions** — Changes that could break existing behavior, removed functionality without replacement, altered return types or signatures that callers depend on
3. **Simplification opportunities** — Dead code, overly complex conditionals, unnecessary abstractions, duplicated logic that could be extracted
4. **Edge cases** — Unhandled inputs, boundary conditions, empty/nil collections, concurrent access patterns
5. **Security** — Injection risks, unchecked user input, hardcoded secrets, improper access control

## Output format

Organize findings by severity:
- 🔴 **Critical** — Bugs, security issues, or regressions that must be fixed
- 🟡 **Warning** — Potential issues or code smells worth addressing
- 🟢 **Suggestion** — Simplifications or improvements, not blocking

For each finding, reference the specific file and line range, explain the issue, and suggest a fix. If the changes look clean, say so — don't invent problems.
