function gwd --description "Remove the current git worktree and its branch"
    set -l wt_path (git rev-parse --show-toplevel 2>/dev/null)
    if test -z "$wt_path"
        echo "Error: not in a git repository"
        return 1
    end

    # Ensure we're in a worktree, not the main working tree
    set -l git_common (git rev-parse --git-common-dir 2>/dev/null)
    set -l git_dir (git rev-parse --git-dir 2>/dev/null)
    if test "$git_common" = "$git_dir"
        echo "Error: not in a worktree (this is the main working tree)"
        return 1
    end

    set -l branch (git branch --show-current 2>/dev/null)

    # Move out before removing
    cd (git -C "$wt_path" rev-parse --path-format=absolute --git-common-dir 2>/dev/null | string replace --regex '/\.git$' '')

    git worktree remove "$wt_path"
    or return 1

    if test -n "$branch"
        git branch -d "$branch" 2>/dev/null
        or echo "Note: branch '$branch' not deleted (not fully merged). Use `git branch -D $branch` to force."
    end
end
