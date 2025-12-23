#!/bin/sh
set -e

# Start app + nginx to answer HTTP challenge
docker compose up -d tombola nginx
docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d tombola.freeinfo.it --email vincenzo.difranco@gmail.com --agree-tos --no-eff-email


# Reload nginx with certs
docker compose restart nginx

# Start renew loop
docker compose up -d certbot
