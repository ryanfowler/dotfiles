function gwa --description "Create a git worktree for the current repo"
    if test (count $argv) -ne 1
        echo "Usage: worktree <branch>"
        return 1
    end

    set -l branch $argv[1]
    set -l repo (basename (git rev-parse --show-toplevel 2>/dev/null))

    if test -z "$repo"
        echo "Error: not in a git repository"
        return 1
    end

    set -l target "$HOME/.code/$repo/$branch"

    git worktree add "$target" "$branch" 2>/dev/null
    or git worktree add -b "$branch" "$target"
    or return 1

    cd "$target"
end
