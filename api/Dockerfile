FROM php:8.3-cli

# System libs + PHP extensions
RUN apt-get update && apt-get install -y \
    git curl zip unzip \
    libpq-dev libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install \
        pdo pdo_pgsql pgsql \
        mbstring exif pcntl bcmath gd zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www

COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# Storage / cache must be writable
RUN chmod -R 775 storage bootstrap/cache

EXPOSE 8080

# Cache config+routes, run migrations, seed reference data, then serve.
# Shell form so ${PORT:-8080} expands correctly.
# --schema-path points at a file that doesn't exist on purpose: Laravel then skips
# loading database/schema/pgsql-schema.sql (which needs the psql client, not in this
# image) and runs every migration instead. Verified to produce the identical schema.
CMD php artisan config:clear \
    && php artisan config:cache \
    && php artisan route:cache \
    && php artisan storage:link --force \
    && php artisan migrate --force --schema-path=database/schema/none.sql \
    && php artisan db:seed --class=ServiceTypeSeeder --force \
    && php artisan db:seed --class=CertificationSeeder --force \
    && php artisan db:seed --class=OrganizationMigrationSeeder --force \
    && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
