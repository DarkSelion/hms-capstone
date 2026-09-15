#!/bin/bash
set -e

# Deploy script for Pampanga Home Suites
# Usage: bash deploy.sh
# Requires: SSH key for hotel-v2-key, git, access to server

SERVER="ubuntu@3.80.68.104"
KEY="hotel-v2.pem"
REMOTE_DIR="/var/www/hotel"

echo "=== Deploying Pampanga Home Suites ==="

# 1. Commit any local changes
echo "[1/6] Checking for local changes..."
if [ -n "$(git status --porcelain)" ]; then
  echo "  Uncommitted changes found. Committing..."
  git add -A
  git commit -m "Auto-deploy $(date +%Y-%m-%d_%H-%M)"
fi

# 2. Push to GitHub
echo "[2/6] Pushing to GitHub..."
git push origin master 2>/dev/null || echo "  Push failed (no changes or no remote)"

# 3. Pull on server + install deps + migrate
echo "[3/6] Pulling on server + composer install + migrate..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" bash -s <<'REMOTE'
cd /var/www/hotel
sudo chown -R ubuntu:ubuntu .
git pull origin master
cd backend
composer install --no-dev --optimize-autoloader 2>/dev/null || composer install --no-dev
php artisan migrate --force
php artisan config:cache 2>/dev/null || true
php artisan route:cache 2>/dev/null || true
sudo chown -R www-data:www-data ../backend/storage ../backend/bootstrap/cache
sudo chmod -R 775 ../backend/storage ../backend/bootstrap/cache
REMOTE

# 4. Build frontend locally
echo "[4/6] Building frontend..."
cd frontend
npm install
npm run build
cd ..

# 5. Deploy frontend dist to server
echo "[5/6] Deploying frontend..."
tar -czf /tmp/hotel-dist.tar.gz -C frontend/dist .
scp -i "$KEY" -o StrictHostKeyChecking=no /tmp/hotel-dist.tar.gz "$SERVER":/tmp/
ssh -i "$KEY" -o StrictHostKeyChecking=no "$SERVER" bash -s <<'REMOTE'
sudo rm -rf /var/www/hotel/frontend/dist/*
sudo tar -xzf /tmp/hotel-dist.tar.gz -C /var/www/hotel/frontend/dist
sudo chown -R www-data:www-data /var/www/hotel/frontend/dist
rm /tmp/hotel-dist.tar.gz
REMOTE
rm /tmp/hotel-dist.tar.gz 2>/dev/null

# 6. Verify
echo "[6/6] Verifying..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://pampangahomesuites.duckdns.org/api/public/settings/hotel)
if [ "$STATUS" = "200" ]; then
  echo "=== Deploy complete! Site is live at https://pampangahomesuites.duckdns.org ==="
else
  echo "=== Deploy done but site returned HTTP $STATUS — check server ==="
fi
