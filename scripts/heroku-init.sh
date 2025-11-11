#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/heroku-init.sh -a <app-name> [options]

Options:
  -a, --app <name>            Heroku app name (required)
      --admin-user <name>     Admin username (default: admin)
      --admin-password <pass> Admin password (default: admin123)
      --admin-email <email>   Admin email (default: admin@mailia.fi)
      --admin-fullname <name> Admin full name (default: Admin User)
      --skip-config           Skip config var checks/updates
  -h, --help                  Show this help
EOF
}

APP_NAME=""
ADMIN_USER="admin"
ADMIN_PASSWORD="admin123"
ADMIN_EMAIL="admin@mailia.fi"
ADMIN_FULLNAME="Admin User"
SKIP_CONFIG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -a|--app)
      APP_NAME="$2"; shift 2 ;;
    --admin-user)
      ADMIN_USER="$2"; shift 2 ;;
    --admin-password)
      ADMIN_PASSWORD="$2"; shift 2 ;;
    --admin-email)
      ADMIN_EMAIL="$2"; shift 2 ;;
    --admin-fullname)
      ADMIN_FULLNAME="$2"; shift 2 ;;
    --skip-config)
      SKIP_CONFIG=true; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage; exit 1 ;;
  esac
done

if [[ -z "$APP_NAME" ]]; then
  echo "Error: --app is required" >&2
  usage
  exit 1
fi

if ! command -v heroku >/dev/null 2>&1; then
  echo "Error: Heroku CLI not found in PATH" >&2
  echo "Install from https://devcenter.heroku.com/articles/heroku-cli" >&2
  exit 1
fi

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
SCHEMA_PATH="$REPO_ROOT/backend/database/schema.sql"

printf '🚀 Mailia Heroku bootstrap starting for app "%s"\n' "$APP_NAME"

if ! heroku apps:info -a "$APP_NAME" >/dev/null; then
  echo "Error: app '$APP_NAME' not found. Create it first (heroku create $APP_NAME)." >&2
  exit 1
fi
printf '   ✔ App exists\n'

ensure_config() {
  local key="$1"
  local value="$2"
  local is_secret="${3:-false}"

  local existing
  existing=$(heroku config:get "$key" -a "$APP_NAME" 2>/dev/null || true)
  if [[ -z "$existing" ]]; then
    if [[ "$is_secret" == "true" ]]; then
      echo "   ➕ Setting $key = <generated>"
    else
      echo "   ➕ Setting $key = $value"
    fi
    heroku config:set "$key=$value" -a "$APP_NAME" >/dev/null
  else
    printf '   ✔ %s already set\n' "$key"
  fi
}

random_secret() {
  # 64 bytes base64 -> 88 chars, sufficient entropy
  openssl rand -base64 48 | tr -d '\n'
}

if [[ "$SKIP_CONFIG" != true ]]; then
  echo "🔐 Ensuring required config vars are set..."
  ensure_config NODE_ENV production
  ensure_config USE_DATABASE_URL true
  ensure_config CLIENT_URL "https://$APP_NAME.herokuapp.com"
  ensure_config RATE_LIMIT_WINDOW_MS 900000
  ensure_config RATE_LIMIT_MAX_REQUESTS 100
  ensure_config JWT_EXPIRES_IN 15m
  ensure_config JWT_REFRESH_EXPIRES_IN 7d
  ensure_config JWT_SECRET "$(random_secret)" true
  ensure_config JWT_REFRESH_SECRET "$(random_secret)" true
  printf '   ✔ Config step complete\n'
else
  echo "⚠️  Skipping config var setup (--skip-config)."
fi

if [[ ! -f "$SCHEMA_PATH" ]]; then
  echo "Error: schema file not found at $SCHEMA_PATH" >&2
  exit 1
fi

echo "📄 Applying database schema ($SCHEMA_PATH)..."
heroku pg:psql -a "$APP_NAME" < "$SCHEMA_PATH"
printf '   ✔ Schema applied\n'

echo "👤 Ensuring admin user exists..."
heroku run --app "$APP_NAME" -- bash -c "cd backend && npm run create:admin -- '$ADMIN_USER' '$ADMIN_PASSWORD' '$ADMIN_EMAIL' '$ADMIN_FULLNAME'"
printf '   ✔ Admin user ensured\n'

printf '✅ Heroku bootstrap complete. Login with %s / %s\n' "$ADMIN_USER" "$ADMIN_PASSWORD"
if [[ "$SKIP_CONFIG" != true ]]; then
  echo "   To skip config next time, add --skip-config"
fi
