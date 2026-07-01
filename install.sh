#!/bin/bash
set -e

if ! command -v brew &> /dev/null; then
    printf "\n===> Installing homebrew\n"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if ! command -v node &> /dev/null; then
    printf "\n===> Installing node\n"
    brew install node
fi

npm install --quiet --no-fund --no-update-notifier
npm run install-dotfiles
