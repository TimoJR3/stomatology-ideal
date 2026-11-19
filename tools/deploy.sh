#!/usr/bin/env bash
# Деплой dist/ на свой сервер по SSH.
# Каждая версия кладётся в отдельную папку releases/<время>-<коммит>, затем ссылка current
# мгновенно переключается на неё (посетители не видят «полузагруженный» сайт).
# Хранятся последние KEEP_RELEASES версий — откат: см. deploy/SERVER.md.
#
# Нужны переменные: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH (например /var/www/dinastiya).
# Необязательные: DEPLOY_PORT (22), KEEP_RELEASES (5), GITHUB_SHA.
# SSH-ключ и known_hosts должны быть уже настроены (в CI это делает workflow).
set -euo pipefail

: "${DEPLOY_HOST:?нужен DEPLOY_HOST}"
: "${DEPLOY_USER:?нужен DEPLOY_USER}"
: "${DEPLOY_PATH:?нужен DEPLOY_PATH}"
PORT="${DEPLOY_PORT:-22}"
KEEP="${KEEP_RELEASES:-5}"

# защита от опечаток и подстановок в путях и параметрах
[[ "$DEPLOY_PATH" =~ ^/var/www/[a-z0-9-]+$ ]] || { echo "DEPLOY_PATH должен быть вида /var/www/имя" >&2; exit 1; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*$ ]]   || { echo "недопустимый DEPLOY_USER" >&2; exit 1; }
[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9.:-]+$ ]]      || { echo "недопустимый DEPLOY_HOST" >&2; exit 1; }
[[ "$PORT" =~ ^[0-9]+$ && "$KEEP" =~ ^[0-9]+$ ]] || { echo "недопустимый порт или KEEP_RELEASES" >&2; exit 1; }
[[ -f dist/index.html ]] || { echo "нет dist/index.html — сначала npm run build" >&2; exit 1; }

SHA="${GITHUB_SHA:-local}"
REL="$(date -u +%Y%m%d%H%M%S)-${SHA:0:7}"
TARGET="$DEPLOY_USER@$DEPLOY_HOST"
SSH_OPTS="-p $PORT -o BatchMode=yes -o StrictHostKeyChecking=yes"

echo "Загружаю релиз $REL на $DEPLOY_HOST:$DEPLOY_PATH"
# shellcheck disable=SC2086
ssh $SSH_OPTS "$TARGET" "mkdir -p '$DEPLOY_PATH/releases/$REL'"
rsync -rlz --delete --chmod=D755,F644 -e "ssh $SSH_OPTS" dist/ "$TARGET:$DEPLOY_PATH/releases/$REL/"

# атомарное переключение и удаление старых релизов
# shellcheck disable=SC2086
ssh $SSH_OPTS "$TARGET" "set -e
  cd '$DEPLOY_PATH'
  ln -sfn 'releases/$REL' current.tmp
  mv -Tf current.tmp current
  ls -1dt releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf --"

echo "Готово: $DEPLOY_PATH/current -> releases/$REL"
