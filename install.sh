#!/bin/bash
set -e

if ! command -v brew &> /dev/null; then
    printf "\n===> Installing homebrew\n"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

if ! command -v cargo &> /dev/null; then
    printf "\n===> Installing rustup\n"
    curl https://sh.rustup.rs -sSf | sh -s -- -y
fi

cargo run --quiet --release
