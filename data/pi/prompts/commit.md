---
description: Commit the current changes
argument-hint: "[instructions]"
---

Commit the current changes cleanly. Additional user instructions: ${ARGUMENTS:-none}

Workflow:

1. Inspect repository state:
   - `git status --short --branch`
   - `git diff`
   - `git diff --cached`
   - `git log --oneline -10`

2. Determine the primary branch:
   - Prefer the upstream default branch from `git symbolic-ref refs/remotes/origin/HEAD` when available
   - Otherwise use `main` if it exists
   - Otherwise use `master` if it exists

3. Review the changes before committing:
   - Understand the intent of the diff
   - Watch for secrets, accidental debug code, generated junk, or unrelated changes
   - If changes look unsafe or unrelated, stop and ask before committing

4. Create or confirm the working branch before staging:
   - If the current branch is the primary branch, create a new appropriately named branch before staging or committing
   - If the current branch is already a feature/topic branch, keep using it unless the user asked otherwise
   - Choose a concise branch name that reflects the change

5. Stage and commit:
   - Stage the intended changes
   - Write a conventional commit message
   - Keep the subject under 72 characters
   - Add a body only when helpful
   - Match the tone and style of recent commits

6. Push the commit:
   - Push the branch to origin, setting upstream when needed

7. Ask about creating a pull request:
   - After the commit has been pushed, ask the user whether they want a pull request created
   - Do not create a pull request unless the user confirms
   - If confirmed, create a pull request against the primary branch using `gh pr create` when available
   - Write a concise PR title and body summarizing changes and validation

8. Final response:
   - Commit SHA and message
   - Branch name
   - Push result
   - PR URL, if created
   - Validation run and result
   - Any notable caveats

