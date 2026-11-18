#!/bin/zsh
cd -- "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
export ARENA_LAN=1
export PORT=4845
node scripts/launch.mjs --open
