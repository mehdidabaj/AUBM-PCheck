#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aubm-pcheck}"
APP_USER="${APP_USER:-aubm}"
REPO_URL="${REPO_URL:-https://github.com/mehdidabaj/AUBM-PCheck.git}"
BRANCH="${BRANCH:-cursor/debian-express-8091-8e0b}"
PUBLIC_URL="${PUBLIC_URL:-http://195.200.200.16:8091}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lancez ce script en root (sudo)."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg git build-essential python3

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/"$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
fi

mkdir -p "$APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
npm install
npm rebuild better-sqlite3
npm run build

cat > "$APP_DIR/.env" <<EOF
HOST=0.0.0.0
PORT=8091
DATA_DIR=$APP_DIR/data
NODE_ENV=production
EOF

mkdir -p "$APP_DIR/data"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

install -m 644 "$APP_DIR/deploy/aubm-pcheck.service" /etc/systemd/system/aubm-pcheck.service
systemctl daemon-reload
systemctl enable --now aubm-pcheck.service

if command -v ufw >/dev/null 2>&1; then
  ufw allow 8091/tcp || true
fi

echo
echo "Déploiement terminé."
echo "Service : systemctl status aubm-pcheck"
echo "URL     : $PUBLIC_URL"
echo "Health  : curl -s $PUBLIC_URL/api/health"
