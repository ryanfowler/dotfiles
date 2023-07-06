# Rust
. "$HOME/.cargo/env"

# Go
export PATH="$HOME/go/bin:$PATH"

# Homebrew
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Starship
eval "$(starship init zsh)"

# Exa
alias ls=exa
alias la="exa -la"

# Tailscale
if [[ $(uname) == "Darwin" ]]; then
  alias tailscale="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
fi
alias ts=tailscale

# htop
alias htop="TERM=xterm-256color htop"

# Helix
export EDITOR=hx

# Zsh History
autoload -U up-line-or-beginning-search
autoload -U down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
bindkey "^[[A" up-line-or-beginning-search # Up
bindkey "^[[B" down-line-or-beginning-search # Down
