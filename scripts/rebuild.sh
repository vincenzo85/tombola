#!/usr/bin/env bash
set -euo pipefail

### CONFIG
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.yml"

APP_SERVICE="tombola"
NGINX_SERVICE="nginx"

### FLAGS (default)
PULL=0
NO_CACHE=0
SHOW_LOGS=0

### PARSE ARGOMENTI
for arg in "$@"; do
  case "$arg" in
    --pull)
      PULL=1
      ;;
    --no-cache)
      NO_CACHE=1
      ;;
    --logs)
      SHOW_LOGS=1
      ;;
    *)
      echo "❌ Argomento non valido: $arg"
      echo "Usa: --pull --no-cache --logs"
      exit 1
      ;;
  esac
done

echo "🚀 Rebuild Tombola"
echo "📁 Project root: $PROJECT_ROOT"
echo "⚙️  Flags: pull=$PULL | no-cache=$NO_CACHE | logs=$SHOW_LOGS"
echo

cd "$PROJECT_ROOT"

### (opzionale) git pull
if [[ "$PULL" -eq 1 ]]; then
  echo "📥 Git pull..."
  git pull
  echo
fi

### STOP servizi (solo app, NON nginx per sicurezza)
echo "🛑 Stop app container..."
docker compose stop "$APP_SERVICE"
echo

### BUILD
BUILD_ARGS=()
[[ "$NO_CACHE" -eq 1 ]] && BUILD_ARGS+=(--no-cache)

echo "🔨 Build app (${BUILD_ARGS[*]:-cache enabled})..."
docker compose build "${BUILD_ARGS[@]}" "$APP_SERVICE"
echo

### START servizi
echo "▶️  Start containers..."
docker compose up -d "$APP_SERVICE" "$NGINX_SERVICE"
echo

### STATUS
echo "📊 Stato container:"
docker compose ps
echo

### LOGS (opzionale)
if [[ "$SHOW_LOGS" -eq 1 ]]; then
  echo "📜 Logs (CTRL+C per uscire)"
  docker compose logs -f --tail=100 "$APP_SERVICE"
fi

echo
echo "✅ Rebuild completato con successo"
