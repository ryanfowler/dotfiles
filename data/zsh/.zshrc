# zshrc

# Rust
export PATH="$HOME/.cargo/bin:$PATH"

# Go
export PATH="$HOME/go/bin:$PATH"

# Homebrew
export HOMEBREW_NO_ANALYTICS=1
if [[ $OSTYPE = darwin* ]]; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  export PATH="/opt/homebrew/opt/curl/bin:$PATH"
elif [[ $OSTYPE = linux* ]]; then
  export HOMEBREW_PREFIX="/home/linuxbrew/.linuxbrew"
  export HOMEBREW_CELLAR="/home/linuxbrew/.linuxbrew/Cellar"
  export HOMEBREW_REPOSITORY="/home/linuxbrew/.linuxbrew/Homebrew"
  export PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin${PATH+:$PATH}"
  export MANPATH="/home/linuxbrew/.linuxbrew/share/man${MANPATH+:$MANPATH}:"
  export INFOPATH="/home/linuxbrew/.linuxbrew/share/info:${INFOPATH:-}"
fi

# Starship
export STARSHIP_LOG=error
eval "$(starship init zsh)"

# Exa
alias ls=eza
alias la="eza -la"

# Tailscale
if [[ $OSTYPE = darwin* ]]; then
  alias tailscale="/Applications/Tailscale.app/Contents/MacOS/Tailscale"
fi
alias ts=tailscale

# llvm
export PATH="$PATH:/opt/homebrew/opt/llvm/bin"

# htop
alias htop="TERM=xterm-256color htop"

# Helix
export VISUAL=hx
export EDITOR=$VISUAL

# Share zsh history immediately
setopt INC_APPEND_HISTORY

# zsh history with arrow keys
export HISTFILE="$HOME/.zsh_history"
export HISTSIZE=20000
export SAVEHIST=$HISTSIZE
autoload -U up-line-or-beginning-search
autoload -U down-line-or-beginning-search
zle -N up-line-or-beginning-search
zle -N down-line-or-beginning-search
if [[ $OSTYPE = darwin* ]]; then
  bindkey "^[[A" up-line-or-beginning-search # Up
  bindkey "^[[B" down-line-or-beginning-search # Down
elif [[ $OSTYPE = linux* ]]; then
  bindkey "^[OA" up-line-or-beginning-search # Up
  bindkey "^[OB" down-line-or-beginning-search # Down
fi

# zsh history search with ^r (via fzf)
_history_search() {
  output=$(tac ~/.zsh_history | fzf)
  if [[ -n $output ]]; then
    RBUFFER=""
    LBUFFER=$output
  fi
  zle reset-prompt
}
zle -N _search_widget _history_search
bindkey '^r' _search_widget

# zsh completions
FPATH=/opt/homebrew/share/zsh-completions:$FPATH
autoload -Uz compinit
for dump in ~/.zcompdump(N.mh+24); do
  compinit
done
compinit -C

# Run optional script
local private="${HOME}/.zshrc-custom"
if [[ -e ${private} ]]; then
  . ${private}
fi
