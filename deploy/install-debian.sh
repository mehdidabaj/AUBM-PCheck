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

# Échappe une valeur pour une chaîne SQL entre simples quotes
sql_escape() {
  printf "%s" "$1" | sed "s/'/''/g"
}

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y curl ca-certificates gnupg git mariadb-server

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

systemctl enable --now mariadb

# Préserver le mot de passe existant si .env déjà présent
if [[ -z "$MYSQL_PASS" && -f "$APP_DIR/.env" ]]; then
  # shellcheck disable=SC1090
  MYSQL_PASS="$(grep -E '^MYSQL_PASSWORD=' "$APP_DIR/.env" | cut -d= -f2- || true)"
fi
if [[ -z "$MYSQL_PASS" ]]; then
  MYSQL_PASS="$(openssl rand -hex 12)"
fi

MYSQL_PASS_SQL="$(sql_escape "$MYSQL_PASS")"
MYSQL_USER_SQL="$(sql_escape "$MYSQL_USER_NAME")"

mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${MYSQL_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${MYSQL_USER_SQL}'@'localhost' IDENTIFIED BY '${MYSQL_PASS_SQL}';
ALTER USER '${MYSQL_USER_SQL}'@'localhost' IDENTIFIED BY '${MYSQL_PASS_SQL}';
GRANT ALL PRIVILEGES ON \`${MYSQL_DB}\`.* TO '${MYSQL_USER_SQL}'@'localhost';
FLUSH PRIVILEGES;
SQL

if ! id -u "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/"$APP_USER" --shell /usr/sbin/nologin "$APP_USER"
fi

mkdir -p "$APP_DIR"
git config --global --add safe.directory "$APP_DIR" || true

if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  chown -R root:root "$APP_DIR/.git" 2>/dev/null || true
  git -C "$APP_DIR" fetch origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
fi

cd "$APP_DIR"
npm install
npm run build

# Préserver .env existant ; créer seulement s'il manque
if [[ -f "$APP_DIR/.env" ]]; then
  # Réaligner MYSQL_PASSWORD avec celui utilisé utilisé pour ALTER USER
  if grep -q '^MYSQL_PASSWORD=' "$APP_DIR/.env"; then
    sed -i "s|^MYSQL_PASSWORD=.*|MYSQL_PASSWORD=${MYSQL_PASS}|" "$APP_DIR/.env"
  else
    echo "MYSQL_PASSWORD=${MYSQL_PASS}" >> "$APP_DIR/.env"
  fi
  # Nettoyage d'anciennes clés admin éventuelles
  sed -i '/^ADMIN_/d' "$APP_DIR/.env" || true
  # Assurer les clés minimales
  grep -q '^HOST=' "$APP_DIR/.env" || echo "HOST=0.0.0.0" >> "$APP_DIR/.env"
  grep -q '^PORT=' "$APP_DIR/.env" || echo "PORT=8091" >> "$APP_DIR/.env"
  grep -q '^NODE_ENV=' "$APP_DIR/.env" || echo "NODE_ENV=production" >> "$APP_DIR/.env"
  grep -q '^COOKIE_SECURE=' "$APP_DIR/.env" || echo "COOKIE_SECURE=false" >> "$APP_DIR/.env"
  echo "Fichier .env existant préservé (MYSQL_PASSWORD réaligné)."
else
  SETUP_SECRET="$(openssl rand -hex 16)"
  cat > "$APP_DIR/.env" <<EOF
HOST=0.0.0.0
PORT=8091
NODE_ENV=production
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=${MYSQL_USER_NAME}
MYSQL_PASSWORD=${MYSQL_PASS}
MYSQL_DATABASE=${MYSQL_DB}
SESSION_TTL_HOURS=12
SESSION_COOKIE_NAME=aubm_session
COOKIE_SECURE=false
SETUP_SECRET=${SETUP_SECRET}
EOF
  echo "Nouveau .env créé. SETUP_SECRET=${SETUP_SECRET}"
fi

rm -f "$APP_DIR/ADMIN_BOOTSTRAP_ONCE.txt"

chmod 600 "$APP_DIR/.env"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

install -m 644 "$APP_DIR/deploy/aubm-pcheck.service" /etc/systemd/system/aubm-pcheck.service
systemctl daemon-reload
systemctl enable --now aubm-pcheck.service
systemctl restart aubm-pcheck.service
sleep 2

if command -v ufw >/dev/null 2>&1; then
  ufw allow 8091/tcp || true
fi

echo
echo "Déploiement terminé (Express + MySQL + auth)."
echo "Service : systemctl status aubm-pcheck"
echo "URL     : $PUBLIC_URL"
echo "Health  : curl -s $PUBLIC_URL/api/health"
echo "MySQL   : db=${MYSQL_DB} user=${MYSQL_USER_NAME}"
echo "Premier lancement : créez l’admin sur la page d’accueil."
if grep -q '^SETUP_SECRET=' "$APP_DIR/.env"; then
  echo "SETUP_SECRET : $(grep -E '^SETUP_SECRET=' "$APP_DIR/.env" | cut -d= -f2-)"
fi
echo "Réinit admin     : sudo bash $APP_DIR/deploy/reset-auth.sh"
echo "HTTPS recommandé : reverse proxy nginx + COOKIE_SECURE=true"
