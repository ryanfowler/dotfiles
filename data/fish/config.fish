# fish

# Rust
set -x PATH "$HOME/.cargo/bin" $PATH

# Go
set -x PATH "$HOME/go/bin" $PATH

# Homebrew
set -x HOMEBREW_NO_ANALYTICS 1
set -x HOMEBREW_NO_ENV_HINTS 1
switch (uname)
    case Darwin
        set -x PATH /opt/homebrew/bin $PATH
        set -x PATH /opt/homebrew/opt/curl/bin $PATH
    case Linux
        set -x HOMEBREW_PREFIX /home/linuxbrew/.linuxbrew
        set -x HOMEBREW_CELLAR /home/linuxbrew/.linuxbrew/Cellar
        set -x HOMEBREW_REPOSITORY /home/linuxbrew/.linuxbrew/Homebrew
        set -x PATH /home/linuxbrew/.linuxbrew/bin /home/linuxbrew/.linuxbrew/sbin $PATH
        set -x MANPATH /home/linuxbrew/.linuxbrew/share/man $MANPATH
        set -x INFOPATH /home/linuxbrew/.linuxbrew/share/info $INFOPATH
end

# Starship
set -x STARSHIP_LOG error
starship init fish | source

# Eza
alias ls="eza"
alias la="eza -la"

# Tailscale
switch (uname)
    case Darwin
        alias tailscale "/Applications/Tailscale.app/Contents/MacOS/Tailscale"
end
alias ts="tailscale"

# llvm
switch (uname)
    case Darwin
        set -x PATH $PATH /opt/homebrew/opt/llvm/bin
end

set -x PATH $PATH $HOME/.local/bin

# Defualt editor
set -x VISUAL nvim
set -x EDITOR $VISUAL

# Share history immediately
set -U fish_history_share yes

# Setup fzf
set -x FD_SEARCH "fd --hidden --follow --exclude '/.git/'"
set -x FZF_DEFAULT_COMMAND "$FD_SEARCH --type f"
set -x FZF_CTRL_T_COMMAND "$FZF_DEFAULT_COMMAND"
set -x FZF_ALT_C_COMMAND "$FD_SEARCH --type d"
set -x FZF_DEFAULT_OPTS "--no-height"
set -x FZF_CTRL_T_OPTS "--preview 'bat -n --color=always {}'"
set -x FZF_ALT_C_OPTS "--preview 'eza -la --color=always {}'"
fzf --fish | source

# Run optional local script
set private $HOME/.config/fish/config-custom.fish
if test -e $private
    source $private
end

# bun
set --export BUN_INSTALL "$HOME/.bun"
set --export PATH $BUN_INSTALL/bin $PATH
