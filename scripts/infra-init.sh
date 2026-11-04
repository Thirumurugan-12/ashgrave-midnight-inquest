#!/usr/bin/env bash
# Creates infra/.env for the Switch + Mattermost stack with fresh random secrets,
# then points the game's .env at it. Safe to re-run: an existing infra/.env is kept.
set -euo pipefail
cd "$(dirname "$0")/.."

env_file=infra/.env
if [ ! -f "$env_file" ]; then
  command -v openssl >/dev/null || { echo "openssl is required." >&2; exit 1; }
  cp infra/env.template "$env_file"
  set_var() { sed -i.bak "s|^$1=.*|$1=$2|" "$env_file"; }
  # Same secrets as Switch's own deploy/local/generate-env-secrets.sh.
  for key in DB_PASSWORD DB_OWNER_PASSWORD AGENT_REGISTRATION_TOKEN GATEWAY_ADMIN_PASSWORD \
             MATTERMOST_ADMIN_PASSWORD MATTERMOST_USER_PASSWORD; do
    set_var "$key" "$(openssl rand -hex 24)"
  done
  set_var SECRET_KEYS "ashgrave:$(openssl rand -hex 32)"
  set_var SWITCH_VERSION 0.31.0
  set_var MATTERMOST_TEAM_NAME ashgrave
  set_var MATTERMOST_USER detective
  rm -f "$env_file.bak"
  chmod 600 "$env_file"
  echo "✓ created $env_file"
else
  echo "• $env_file already exists, keeping it"
fi

get() { grep "^$1=" "$env_file" | head -1 | cut -d= -f2-; }

# Point the game at the stack.
[ -f .env ] || cp .env.example .env
upsert() {
  if grep -q "^$1=" .env; then sed -i.bak "s|^$1=.*|$1=$2|" .env; else echo "$1=$2" >> .env; fi
  rm -f .env.bak
}
upsert SWITCH_BRIDGE_URL "http://127.0.0.1:$(get API_HOST_PORT)"
upsert SWITCH_REGISTRATION_KEY "$(get AGENT_REGISTRATION_TOKEN)"
echo "✓ .env now points at the stack"

cat <<EOF

When the stack is up (npm run infra:up):
  Mattermost  http://localhost:$(get MATTERMOST_HOST_PORT)   team: $(get MATTERMOST_TEAM_NAME)
              admin:  $(get MATTERMOST_ADMIN_USER) / see MATTERMOST_ADMIN_PASSWORD in $env_file
              player: $(get MATTERMOST_USER) / see MATTERMOST_USER_PASSWORD in $env_file
  Gateway     http://localhost:$(get GATEWAY_HOST_PORT)   $(get GATEWAY_ADMIN_EMAIL) / see GATEWAY_ADMIN_PASSWORD
  Agent API   http://127.0.0.1:$(get API_HOST_PORT)
EOF
