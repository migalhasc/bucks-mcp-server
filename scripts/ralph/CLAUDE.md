# Ralph Agent Instructions

You are an autonomous coding agent implementing GitHub issues one at a time.

## Your Task Each Iteration

1. **List open issues**
   ```
   gh issue list --state open --json number,title,body,labels --limit 50
   ```
2. **Pick one** — highest priority label (`critical > high > medium > low`), then lowest number
3. **Read full issue**
   ```
   gh issue view [number]
   ```
4. **Check context** — `git log --oneline -10` to understand recent work
5. **Implement** the issue (changes focused, minimal, following existing patterns)
6. **Run quality checks** — typecheck, lint, test (use whatever the project defines; check `package.json` scripts)
7. **Commit**
   ```
   git add -A && git commit -m "feat: #[number] - [title]"
   ```
8. **Close issue**
   ```
   gh issue close [number] -c "Implemented in $(git rev-parse --short HEAD)"
   ```

## Quality Requirements

- ALL commits must pass quality checks
- Do NOT commit broken code
- Keep changes focused on the single issue
- Follow existing code style and patterns

## Stop Condition

After closing an issue, check whether any open issues remain:
```
gh issue list --state open --json number --limit 1
```

If the result is an empty array `[]`, all issues are done. Output exactly:

```
<promise>COMPLETE</promise>
```

If open issues remain, end your response normally — the next iteration will continue.

## Important

- ONE issue per iteration
- Commit only after quality checks pass
- Reference the issue number in the commit message (`#N`)
- Close the issue after the commit, never before
