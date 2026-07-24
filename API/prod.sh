#!/usr/bin/env bash
# =====================================================================
#  prod  —  Déploiement en production, TOUT conteneurisé (Docker)
#
#  Stack (docker compose) : postgres + mongodb + neo4j + api + front
#  Apache reste l'entrée publique (:80) et reverse-proxy vers les conteneurs :
#     /api  et /socket.io  -> conteneur api   (localhost:3000)
#     /     (SPA)          -> conteneur front (localhost:8080, nginx)
#
#  Sécurité du déploiement :
#   1) on BUILD les images d'abord → si un build échoue, le site en place n'est
#      pas touché (le script s'arrête).
#   2) on ne bascule Apache qu'APRÈS avoir vérifié que api & front répondent.
#   3) la conf Apache est sauvegardée + testée (configtest) ; rollback si invalide.
#
#  Options :
#    prod            déploiement standard
#    prod --restart  force la recréation des conteneurs
#
#  En cas d'échec de l'API conteneurisée, rollback rapide vers l'ancienne API PM2 :
#    docker compose stop api && pm2 start ecosystem.config.cjs && pm2 save
# =====================================================================
set -euo pipefail

FORCE_RESTART=0
[[ "${1:-}" == "--restart" || "${1:-}" == "-r" ]] && FORCE_RESTART=1

# 127.0.0.1 et pas localhost : localhost resout ::1 (IPv6) en premier alors que
# Docker publie les ports en IPv4, le healthcheck echouait pour rien.
API_URL="http://127.0.0.1:3000/"
FRONT_C_URL="http://127.0.0.1:8080/"
SITE_URL="http://127.0.0.1/"
PG_CONTAINER="POSTGRES_CONTAINER"
APACHE_VHOST="/etc/apache2/sites-available/react.conf"

cd /var/www/API

echo "════════════════════════════════════════════════════"
echo "   DÉPLOIEMENT PRODUCTION — Docker (5 conteneurs) + Apache"
echo "════════════════════════════════════════════════════"

# Attend qu'une URL réponde 200 (max 30s), sinon logs du service + échec.
wait_http() { # $1=url  $2=nom  $3=service compose (pour les logs)
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" || echo 000)
    [[ "$code" == "200" ]] && { echo "   $2 OK ($code)"; return 0; }
    sleep 1
  done
  echo "✗ $2 ne répond pas ($1)"
  docker compose logs --tail 40 "$3" || true
  return 1
}

# ---------------------------- BUILD ---------------------------------
# On construit AVANT toute bascule : un build KO n'impacte pas la prod en place.
echo ""
echo "▶ [1/6] Build des images Docker (api + front)..."
docker compose build api front

# --- Archive du client Java de bureau (téléchargement admin) --------------------
# Le dossier PetitsSecretsVoisins/ (image jpackage : .exe + runtime) est compressé
# en un .zip servi par la route admin GET /api/admin/telecharger-app-java (dossier
# ./private monté en lecture seule dans le conteneur api). Non bloquant.
echo "▶ Archive du client Java de bureau (téléchargement admin)..."
mkdir -p /var/www/API/private
# 'zip' n'est pas toujours présent sur le VPS : on tente une installation silencieuse.
if ! command -v zip >/dev/null 2>&1; then
  echo "   'zip' absent — installation (apt-get)..."
  sudo apt-get install -y zip >/dev/null 2>&1 || true
fi
if command -v zip >/dev/null 2>&1; then
  ( cd /var/www/API && rm -f private/petits-secrets-voisins.zip \
    && zip -r -q private/petits-secrets-voisins.zip PetitsSecretsVoisins )
  taille=$(du -h /var/www/API/private/petits-secrets-voisins.zip 2>/dev/null | cut -f1)
  echo "   private/petits-secrets-voisins.zip généré (${taille})."
else
  echo "   ⚠ 'zip' toujours absent — installez-le : sudo apt-get update && sudo apt-get install -y zip"
fi

# ------------------------- LIBÉRER :3000 ----------------------------
# L'ancienne API tournait via PM2 sur :3000 ; le conteneur api va prendre ce port.
if pm2 describe api >/dev/null 2>&1; then
  echo "▶ [2/6] Arrêt de l'ancienne API PM2 (le conteneur api prend le relais)..."
  pm2 delete api >/dev/null 2>&1 || true
  pm2 save >/dev/null 2>&1 || true
else
  echo "▶ [2/6] Pas d'API PM2 à arrêter (déjà en conteneur)."
fi

# ---------------------------- UP ------------------------------------
echo "▶ [3/6] Démarrage de TOUS les conteneurs..."
docker compose up -d --remove-orphans
if [[ "$FORCE_RESTART" == "1" ]]; then
  echo "   --restart : recréation complète..."
  docker compose up -d --force-recreate --remove-orphans
fi

for c in MONGODB_CONTAINER NEO4J_CONTAINER "$PG_CONTAINER" API_CONTAINER FRONT_CONTAINER; do
  running=$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || echo "false")
  if [[ "$running" != "true" ]]; then
    echo "✗ Le conteneur $c n'est pas démarré. État :"; docker compose ps; exit 1
  fi
  echo "   $c : OK (running)"
done

# ------------------------- POSTGRES prêt ----------------------------
echo "▶ [4/6] Attente que Postgres soit prêt..."
for i in $(seq 1 30); do
  if docker exec "$PG_CONTAINER" pg_isready -U admin -d connected_neighbours >/dev/null 2>&1; then
    echo "   Postgres prêt."; break
  fi
  [[ "$i" == "30" ]] && { echo "✗ Postgres ne répond pas après 30s"; exit 1; }
  sleep 1
done
docker exec "$PG_CONTAINER" psql -U admin -d connected_neighbours -tAc "SELECT pg_reload_conf();" >/dev/null || true

# ------------------- SANTÉ des conteneurs api & front ---------------
echo "▶ [5/6] Vérification que api & front répondent (avant de basculer Apache)..."
wait_http "$API_URL"     "API   (:3000)" api
wait_http "$FRONT_C_URL" "Front (:8080)" front

# ---------------------------- APACHE --------------------------------
# On (re)pointe Apache vers les conteneurs. Sauvegarde + configtest + reload.
# HTTPS : si un certificat Let's Encrypt existe pour le domaine, on génère EN PLUS
# un vhost :443 (SSL) et on redirige le :80 vers HTTPS. Sinon, vhost :80 simple.
# Détection automatique -> le HTTPS SURVIT à chaque `prod` (rien à refaire).
echo "▶ [6/6] Configuration Apache (reverse-proxy vers les conteneurs)..."

DOMAIN="petitsecretentrevoisins.online"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

# Directives de reverse-proxy communes à HTTP et HTTPS (capturées LITTÉRALEMENT :
# le $1 de la RewriteRule ne doit pas être interprété par bash).
read -r -d '' PROXY_BLOCK <<'PROXYEOF' || true
    ProxyPreserveHost On

    # Ne jamais proxyfier les challenges Let's Encrypt (émission/renouvellement).
    ProxyPass /.well-known/acme-challenge/ !

    # API : /api/* -> conteneur api (:3000)
    ProxyPass        /api  http://localhost:3000
    ProxyPassReverse /api  http://localhost:3000

    # Fichiers servis par l'API hors du prefixe /api : PDF des contrats, photos, vocaux.
    ProxyPass        /uploads  http://localhost:3000/uploads
    ProxyPassReverse /uploads  http://localhost:3000/uploads

    # Socket.IO (websocket + long-polling) -> conteneur api
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule ^/socket\.io/(.*) ws://localhost:3000/socket.io/$1 [P,L]
    ProxyPass        /socket.io/  http://localhost:3000/socket.io/
    ProxyPassReverse /socket.io/  http://localhost:3000/socket.io/

    # Front (SPA React) -> conteneur nginx (:8080)
    ProxyPass        /  http://localhost:8080/
    ProxyPassReverse /  http://localhost:8080/
PROXYEOF

sudo cp -a "$APACHE_VHOST" "${APACHE_VHOST}.bak.$(date +%s)"

# `sudo test` : /etc/letsencrypt/live est en 0700 root, illisible par l'user courant.
if sudo test -f "${CERT_DIR}/fullchain.pem"; then
  echo "   ✓ Certificat détecté -> :80 redirige vers HTTPS + vhost :443 (SSL)."
  sudo tee "$APACHE_VHOST" >/dev/null <<EOF
# :80 -> redirige tout vers HTTPS (sauf les challenges ACME).
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}
    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/.well-known/acme-challenge/
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</VirtualHost>

# :443 -> site en HTTPS, reverse-proxy vers les conteneurs.
<VirtualHost *:443>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}

    SSLEngine on
    SSLCertificateFile    ${CERT_DIR}/fullchain.pem
    SSLCertificateKeyFile ${CERT_DIR}/privkey.pem
    SSLProtocol           all -SSLv3 -TLSv1 -TLSv1.1

${PROXY_BLOCK}
</VirtualHost>
EOF
else
  echo "   (pas de certificat -> vhost HTTP simple ; lance certbot pour activer HTTPS)"
  sudo tee "$APACHE_VHOST" >/dev/null <<EOF
<VirtualHost *:80>
    ServerName ${DOMAIN}
    ServerAlias www.${DOMAIN}

${PROXY_BLOCK}
</VirtualHost>
EOF
fi

if ! sudo apache2ctl configtest 2>/dev/null; then
  echo "✗ Config Apache invalide → restauration de la sauvegarde."
  sudo cp -a "$(ls -t ${APACHE_VHOST}.bak.* | head -1)" "$APACHE_VHOST"
  exit 1
fi
sudo systemctl reload apache2

# ---------------------------- SANTÉ ---------------------------------
echo ""
echo "▶ [SANTÉ] Vérification du site via Apache..."
sleep 2
if sudo test -f "${CERT_DIR}/fullchain.pem"; then
  # HTTPS actif : le :80 doit rediriger (301) et le :443 servir le site (200).
  # -k + Host: le certificat est au nom du domaine, pas de "localhost".
  redir=$(curl -s  -o /dev/null -w "%{http_code}" --max-time 8 "http://localhost/" || echo 000)
  site=$( curl -sk -o /dev/null -w "%{http_code}" --max-time 8 -H "Host: ${DOMAIN}" "https://localhost/" || echo 000)
  echo "   HTTP  (redirection) -> $redir"
  echo "   HTTPS (:443)        -> $site"
else
  site=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$SITE_URL" || echo 000)
  echo "   SITE ($SITE_URL) -> HTTP $site"
fi
if [[ "$site" != "200" ]]; then
  echo "✗ Le site ne répond pas via Apache. Rollback possible :"
  echo "    docker compose stop api && pm2 start ecosystem.config.cjs && pm2 save"
  exit 1
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "✓ Déploiement conteneurisé terminé — 5 conteneurs + Apache."
echo "════════════════════════════════════════════════════"
docker compose ps
