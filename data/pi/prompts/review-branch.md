---
description: Review changes on the current branch against the primary branch
argument-hint: "[focus]"
---

Review all changes on the current branch compared to the repository's primary branch. Optional focus from the user: ${ARGUMENTS:-none}

Workflow:

1. Determine the primary branch:
   - Prefer the upstream default branch from `git symbolic-ref refs/remotes/origin/HEAD` when available
   - Otherwise use `main` if it exists
   - Otherwise use `master` if it exists

2. Inspect the change set:
   - `git status --short --branch`
   - `git merge-base HEAD <primary-branch>`
   - `git diff --stat <primary-branch>...HEAD`
   - `git diff --name-status <primary-branch>...HEAD`
   - `git diff <primary-branch>...HEAD`
   - Recent context when helpful: `git log --oneline --decorate -10`

3. Understand the intent before judging:
   - Summarize what the change appears to do
   - Identify the riskiest files or paths first
   - Read surrounding code for non-trivial changes instead of relying only on the diff
   - Inspect relevant tests, call sites, config, migrations, or docs when they affect correctness

Review priorities, in order:

1. **Correctness and regressions** — Broken behavior, invalid assumptions, missed call sites, changed contracts, bad error handling, race conditions, off-by-one mistakes, nil/null handling, type issues
2. **Security and data safety** — Injection, auth/authz mistakes, unsafe filesystem/network behavior, secret leakage, destructive operations, unsafe defaults
3. **Edge cases and reliability** — Empty inputs, large inputs, concurrency, retries, timeouts, partial failures, platform differences
4. **Tests and validation** — Missing or weak tests for important behavior, snapshots needing updates, test assertions that do not prove the behavior
5. **Maintainability** — Unnecessary complexity, duplication, dead code, confusing names, avoidable abstractions

Guidelines:

- Focus on actionable issues that the author should consider before merging
- Do not nitpick formatting or style unless it affects readability, correctness, or consistency with nearby code
- Do not invent issues; verify claims against the code when possible
- Prefer fewer, higher-confidence findings over a long speculative list
- If a finding depends on uncertainty, say what you are assuming and how to verify it
- Include positive notes only briefly, after findings or when there are no findings

Output format:

1. Start with a short summary of the change and overall risk level: **low**, **medium**, or **high**
2. Then list findings by severity:
   - **Critical** — Bugs, security issues, or regressions that must be fixed
   - **Warning** — Likely issues or important gaps worth addressing
   - **Suggestion** — Simplifications or improvements, not blocking
3. For each finding include:
   - File and line/range when possible
   - What is wrong
   - Why it matters
   - A concrete suggested fix
4. If there are no findings, say that the changes look good and mention any validation gaps you noticed
