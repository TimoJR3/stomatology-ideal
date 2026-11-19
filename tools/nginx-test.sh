#!/usr/bin/env bash
# Проверка конфигурации nginx (nginx -t) в контейнере — запускается в CI.
# Подставляет временный самоподписанный сертификат, чтобы проверить синтаксис без настоящего домена.
set -euo pipefail
SLUG="$(node -p "require('./package.json').site.slug")"
DOMAIN="$(grep -m1 -oE 'server_name [^ ;]+' deploy/nginx/site.conf | awk '{print $2}')"
WORK="$(mktemp -d)"
mkdir -p "$WORK/conf.d" "$WORK/snippets" "$WORK/le/live/$DOMAIN" "$WORK/www/$SLUG/current"
cp deploy/nginx/site.conf "$WORK/conf.d/$SLUG.conf"
cp deploy/nginx/security-headers.conf "$WORK/snippets/$SLUG-security-headers.conf"
openssl req -x509 -nodes -newkey rsa:2048 -days 1 -subj "/CN=$DOMAIN" \
  -keyout "$WORK/le/live/$DOMAIN/privkey.pem" -out "$WORK/le/live/$DOMAIN/fullchain.pem" 2>/dev/null
docker run --rm \
  -v "$WORK/conf.d:/etc/nginx/conf.d:ro" \
  -v "$WORK/snippets:/etc/nginx/snippets:ro" \
  -v "$WORK/le:/etc/letsencrypt:ro" \
  -v "$WORK/www:/var/www:ro" \
  nginx:stable-alpine nginx -t
