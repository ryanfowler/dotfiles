---
description: Generate a commit message from staged changes
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

## Context

- Staged diff: !`git diff --cached`
- Recent commits for style reference: !`git log --oneline -10`

## Instructions

Write a commit message for the staged changes. Follow conventional commits format. The subject line should be under 72 characters. Add a body only if the change is non-obvious. Match the tone and style of the recent commit history.

Output ONLY the commit message, nothing else.
