#!/usr/bin/env bash
# Runs ON THE VPS via the SSH deploy workflow (piped to `bash -s`).
# Pulls latest main, rebuilds, and gracefully reloads the pm2 API process.
set -euo pipefail

# A non-interactive SSH shell sources no profile — make sure node/npm/pm2 are found.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

cd "$HOME/6Gate"
git fetch origin main
git reset --hard origin/main      # .env is gitignored, so it's never touched

cd app
npm ci
npm run build                      # -> dist/main.js (runs DB migrations on boot)
pm2 reload 6gate-api --update-env || pm2 start ecosystem.config.js
pm2 save
