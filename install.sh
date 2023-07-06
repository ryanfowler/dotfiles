#!/bin/bash
set -e

if ! command -v cargo &> /dev/null
then
    echo "Installing rustup..."
    curl https://sh.rustup.rs -sSf | sh -s -- -y
fi

cargo run --release
