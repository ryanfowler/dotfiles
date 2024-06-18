# zshrc

# Rust
export PATH="$HOME/.cargo/bin:$PATH"

# Go
export PATH="$HOME/go/bin:$PATH"

# Homebrew
export HOMEBREW_NO_ANALYTICS=1
export HOMEBREW_NO_ENV_HINTS=1
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

# Set default editor
export VISUAL=nvim
export EDITOR=$VISUAL

# Use emacs?! mode for sensible keybindings
bindkey -e

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

# Setup fzf
FD_SEARCH="fd --hidden --follow --exclude '/.git/'"
export FZF_DEFAULT_COMMAND="$FD_SEARCH --type f"
export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"
export FZF_ALT_C_COMMAND="$FD_SEARCH --type d"
export FZF_DEFAULT_OPTS="--no-height"
export FZF_CTRL_T_OPTS="--preview 'bat -n --color=always {}'"
export FZF_ALT_C_OPTS="--preview 'eza -la --color=always {}'"
_fzf_compgen_path() {
  fd --type f --hidden --follow --exclude ".git" . "$1"
}
_fzf_compgen_dir() {
  fd --type d --hidden --follow --exclude ".git" . "$1"
}
_fzf_comprun() {
  local command=$1
  shift

  case "$command" in
    cd)           fzf --preview 'eza -la --color=always {}' "$@" ;;
    export|unset) fzf --preview "eval 'echo \$'{}"          "$@" ;;
    *)            fzf --preview 'bat -n --color=always {}'  "$@" ;;
  esac
}
eval "$(fzf --zsh)"

# zsh completions
FPATH=/opt/homebrew/share/zsh/site-functions:$FPATH
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
