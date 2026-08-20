# ==============================================================================
# Task Hub — Multi-Stage Production Dockerfile
# Stage 1: Build Frontend Assets (Vite + Vue 3 + TailwindCSS)
# Stage 2: Install PHP Composer Dependencies
# Stage 3: Production Alpine Runtime with PHP 8.2-FPM, Nginx & Supervisord
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Frontend Asset Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Composer Dependencies Builder
# ------------------------------------------------------------------------------
FROM composer:2 AS composer-builder
WORKDIR /app
COPY composer.json composer.lock* ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --no-progress \
    --optimize-autoloader \
    --no-scripts \
    --ignore-platform-reqs
COPY . .
RUN composer dump-autoload --optimize --no-dev

# ------------------------------------------------------------------------------
# Stage 3: Final Production Runtime
# ------------------------------------------------------------------------------
FROM php:8.2-fpm-alpine AS runner

# Install Nginx, Supervisor, SQLite, PostgreSQL client and system utilities
RUN apk add --no-cache \
    nginx \
    supervisor \
    sqlite \
    postgresql-client \
    curl

# Install required PHP extensions
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions pdo_sqlite pdo_mysql pdo_pgsql pgsql mbstring zip bcmath opcache intl xml ctype fileinfo gd

# Set working directory
WORKDIR /var/www/html

# Copy application files (code, views, vendor) from composer-builder
COPY --from=composer-builder /app /var/www/html

# Copy built frontend assets from frontend-builder
COPY --from=frontend-builder /app/public/build /var/www/html/public/build

# Copy configs
COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/custom.ini
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

# Set up storage and cache permissions
RUN mkdir -p /var/www/html/storage/framework/cache/data \
             /var/www/html/storage/framework/sessions \
             /var/www/html/storage/framework/views \
             /var/www/html/storage/logs \
             /var/www/html/bootstrap/cache \
             /var/www/html/database \
    && chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database \
    && chmod -R 777 /var/www/html/storage /var/www/html/bootstrap/cache /var/www/html/database

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]
