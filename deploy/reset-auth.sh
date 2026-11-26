#!/usr/bin/env bash
# Vide les comptes applicatifs pour réafficher l’écran de création du 1er admin.
# Génère un SETUP_SECRET one-shot pour empêcher une prise de contrôle publique.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/aubm-pcheck}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Lancez en root : sudo bash deploy/reset-auth.sh"
  exit 1
fi

# shellcheck disable=SC1091
set -a
# shellcheck disable=SC1090
source "$APP_DIR/.env"
set +a

MYSQL_DB="${MYSQL_DATABASE:-aubm_pcheck}"
SETUP_SECRET="$(openssl rand -hex 16)"

# Sur Debian, root MySQL utilise souvent auth_socket → passer par sudo mysql
sudo mysql <<SQL
DELETE FROM \`${MYSQL_DB}\`.sessions;
DELETE FROM \`${MYSQL_DB}\`.users;
SQL

sed -i '/^ADMIN_/d' "$APP_DIR/.env" || true
rm -f "$APP_DIR/ADMIN_BOOTSTRAP_ONCE.txt"

if grep -q '^SETUP_SECRET=' "$APP_DIR/.env"; then
  sed -i "s|^SETUP_SECRET=.*|SETUP_SECRET=${SETUP_SECRET}|" "$APP_DIR/.env"
else
  echo "SETUP_SECRET=${SETUP_SECRET}" >> "$APP_DIR/.env"
fi

chmod 600 "$APP_DIR/.env"
chown "$(stat -c '%U:%G' "$APP_DIR")" "$APP_DIR/.env" 2>/dev/null || true

systemctl restart aubm-pcheck.service
sleep 1
curl -s http://127.0.0.1:8091/api/auth/setup || true
echo
echo "Comptes effacés."
echo "SETUP_SECRET (à saisir dans l’UI) : ${SETUP_SECRET}"
echo "Ouvrez l’UI pour créer le premier administrateur."
