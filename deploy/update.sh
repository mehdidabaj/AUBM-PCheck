#!/usr/bin/env bash
# Mise à jour forcée sur le serveur Debian
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aubm-pcheck}"
# Branche de prod Express : inclut les correctifs import/ajout tâches
BRANCH="${BRANCH:-cursor/debian-express-8091-8e0b}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lancez en root : sudo bash deploy/update.sh"
  exit 1
fi

git config --global --add safe.directory "$APP_DIR" || true
cd "$APP_DIR"
git fetch origin
echo "Déploiement branche : $BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
echo "Commit : $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
bash "$APP_DIR/deploy/install-debian.sh"

echo
echo "Vérifications :"
curl -sS http://127.0.0.1:8091/api/health || true
echo
systemctl --no-pager --full status aubm-pcheck | head -20 || true
echo
echo "Si l’UI reste ancienne : Ctrl+F5 dans le navigateur (cache JS)."
