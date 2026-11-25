#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aubm-pcheck}"
APP_USER="${APP_USER:-aubm}"
REPO_URL="${REPO_URL:-https://github.com/mehdidabaj/AUBM-PCheck.git}"
BRANCH="${BRANCH:-cursor/debian-express-8091-8e0b}"
PUBLIC_URL="${PUBLIC_URL:-http://195.200.200.16:8091}"
MYSQL_DB="${MYSQL_DATABASE:-aubm_pcheck}"
MYSQL_USER_NAME="${MYSQL_USER:-aubm}"
MYSQL_PASS="${MYSQL_PASSWORD:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lancez ce script en root (sudo)."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg git mariadb-server

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

systemctl enable --now mariadb

if [[ -z "$MYSQL_PASS" && -f "$APP_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  MYSQL_PASS="$(grep -E '^MYSQL_PASSWORD=' "$APP_DIR/.env" | cut -d= -f2- || true)"
fi
if [[ -z "$MYSQL_PASS" ]]; then
  MYSQL_PASS="$(openssl rand -hex 12)"
fi

mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER_NAME}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
ALTER USER '${MYSQL_USER_NAME}'@'localhost' IDENTIFIED BY '${MYSQL_PASS}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DB}\`.* TO '${MYSQL_USER_NAME}'@'localhost';
FLUSH PRIVILEGES;
SQL

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
npm run build

cat > "$APP_DIR/.env" <<EOF
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=${MYSQL_USER_NAME}
MYSQL_PASSWORD=${MYSQL_PASS}
MYSQL_DATABASE=${MYSQL_DB}
EOF
chmod 600 "$APP_DIR/.env"

chown -R "$APP_USER:$APP_USER" "$APP_DIR"

install -m 644 "$APP_DIR/deploy/aubm-pcheck.service" /etc/systemd/system/aubm-pcheck.service
systemctl daemon-reload
systemctl enable --now aubm-pcheck.service
systemctl restart aubm-pcheck.service

if command -v ufw >/dev/null 2>&1; then
  ufw allow 8091/tcp || true
fi

echo
echo "Déploiement terminé (Express + MySQL/MariaDB)."
echo "Service : systemctl status aubm-pcheck"
echo "URL     : $PUBLIC_URL"
echo "Health  : curl -s $PUBLIC_URL/api/health"
echo "MySQL   : db=${MYSQL_DB} user=${MYSQL_USER_NAME}"
