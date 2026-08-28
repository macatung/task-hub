#!/bin/sh
set -e

echo "[task-hub] Starting container initialization..."

# Remove Vite dev server hot file if present
rm -f /var/www/html/public/hot

# Bind Nginx to Cloud Run $PORT (default 8080)
PORT="${PORT:-8080}"
sed -i "s/listen 80 default_server;/listen $PORT default_server;/g" /etc/nginx/http.d/default.conf 2>/dev/null || true
sed -i "s/listen \[::\]:80 default_server;/listen [::]:$PORT default_server;/g" /etc/nginx/http.d/default.conf 2>/dev/null || true

# 1. Environment file check
if [ ! -f /var/www/html/.env ]; then
    if [ -f /var/www/html/.env.example ]; then
        echo "📄 .env not found, copying from .env.example..."
        cp /var/www/html/.env.example /var/www/html/.env
    fi
fi

# 2. Application Key Check & Generation
if ! grep -q "^APP_KEY=base64:" /var/www/html/.env 2>/dev/null; then
    echo "🔑 Generating Laravel Application Key..."
    php artisan key:generate --force || true
fi

# 3. SQLite Database Initialization
mkdir -p /var/www/html/database
if [ ! -f /var/www/html/database/database.sqlite ]; then
    echo "🗄️ Initializing SQLite database file..."
    touch /var/www/html/database/database.sqlite
fi

# 4. Storage & Cache Directory Preparation
mkdir -p /var/www/html/storage/framework/cache/data \
         /var/www/html/storage/framework/sessions \
         /var/www/html/storage/framework/views \
         /var/www/html/storage/logs \
         /var/www/html/bootstrap/cache

# Clear stale dev caches
rm -f /var/www/html/bootstrap/cache/*.php

# 5. Database Migration (seeding only if RUN_SEEDER=true)
php artisan package:discover --ansi || true
echo "⚡ Running database migrations..."
if [ "$RUN_SEEDER" = "true" ]; then
    echo "🌱 Seeding database..."
    php artisan migrate --force --seed || php artisan migrate --force || true
else
    php artisan migrate --force || true
fi

# 6. Cache Optimization
echo "🚀 Caching Laravel configurations for production..."
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# 7. CRITICAL: Final Ownership and Full Write Permissions for www-data
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database
chmod 666 /var/www/html/database/database.sqlite 2>/dev/null || true

echo "[task-hub] Container ready on port $PORT!"

# Execute passed command (supervisord)
exec "$@"
