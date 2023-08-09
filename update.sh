#!/bin/bash
set -e

bold=$(tput bold)
normal=$(tput sgr0)

function print_bold {
  printf "%s$1\n%s" "$bold" "$normal"
}

print_bold "===> Updating homebrew"
brew update
brew upgrade
brew upgrade --casks

print_bold "\n===> Updating rust"
rustup -q update

print_bold "\n===> Updating npm"
npm update --global --no-fund --no-update-notifier
