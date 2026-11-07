#!/bin/sh
# Creates the Ashgrave services in the linked Railway project. Secrets come from
# deploy/railway.secrets (git-ignored) and MODEL_API_KEY from .env.
set -e
cd "$(dirname "$0")/.."
. deploy/railway.secrets
MODEL_API_KEY=$(grep '^MODEL_API_KEY=' .env | cut -d= -f2-)
V=0.31.0
PG='${{Postgres.PGPASSWORD}}'
PGHOST_REF='${{Postgres.RAILWAY_PRIVATE_DOMAIN}}'

railway add --service switch --image ghcr.io/sandbox-quantum/switch-core:$V \
  -v "DB_HOST=$PGHOST_REF" -v DB_PORT=5432 -v DB_USER=switch_app -v "DB_PASSWORD=$DB_PASSWORD" \
  -v DB_OWNER_USER=postgres -v "DB_OWNER_PASSWORD=$PG" -v DB_NAME=switch \
  -v ID_SERVER_NAME=ashgrave -v MATRIX_SERVER_NAME=ashgrave \
  -v "AGENT_REGISTRATION_TOKEN=$AGENT_REGISTRATION_TOKEN" -v "SECRET_KEYS=$SECRET_KEYS" \
  -v GATEWAY_COOKIE_SECURE=false -v OUTBOUND_ALLOWED_PRIVATE_HOSTS=mattermost.railway.internal \
  -v AGENT_MANAGEMENT_ENABLED=false -v GATEWAY_ADMIN_EMAIL=admin@switch.local \
  -v "GATEWAY_ADMIN_PASSWORD=$GATEWAY_ADMIN_PASSWORD" -v FRONTEND_BASE_URL=http://localhost:5173 \
  -v TELEMETRY_ENVIRONMENT=local -v PORT=8000 --json

railway add --service mattermost --image mattermost/mattermost-team-edition:11.9.0 \
  -v MM_SQLSETTINGS_DRIVERNAME=postgres \
  -v "MM_SQLSETTINGS_DATASOURCE=postgres://postgres:$PG@$PGHOST_REF:5432/mattermost?sslmode=disable" \
  -v MM_SERVICESETTINGS_ENABLELOCALMODE=true -v MM_SERVICESETTINGS_ENABLEONBOARDINGFLOW=false \
  -v MM_DISPLAYSETTINGS_CUSTOMURLSCHEMES=switchdash -v MM_SERVICESETTINGS_ENABLEBOTACCOUNTCREATION=true \
  -v MM_SERVICESETTINGS_ENABLEUSERACCESSTOKENS=true \
  -v "MM_SERVICESETTINGS_ALLOWEDUNTRUSTEDINTERNALCONNECTIONS=switch.railway.internal" \
  -v MM_TEAMSETTINGS_ENABLEOPENSERVER=true -v MM_TEAMSETTINGS_TEAMMATENAMEDISPLAY=full_name \
  -v MM_LOGSETTINGS_ENABLEDIAGNOSTICS=false -v MM_LOGSETTINGS_ENABLESENTRY=false \
  -v MM_SERVICESETTINGS_ENABLESECURITYFIXALERT=false -v MM_ANNOUNCEMENTSETTINGS_ADMINNOTICESENABLED=false \
  -v MM_ANNOUNCEMENTSETTINGS_USERNOTICESENABLED=false -v MM_PLUGINSETTINGS_ENABLEREMOTEMARKETPLACE=false \
  -v 'MM_PLUGINSETTINGS_PLUGINSTATES={"mattermost-ai":{"Enable":false},"com.mattermost.calls":{"Enable":false}}' \
  -v RAILWAY_RUN_UID=0 -v PORT=8065 --json

railway add --service setup --image ghcr.io/sandbox-quantum/setup:$V \
  -v SWITCH_URL=http://switch.railway.internal:8000 -v MATTERMOST_URL=http://mattermost.railway.internal:8065 \
  -v MATTERMOST_URL_FOR_SWITCH=http://mattermost.railway.internal:8065 \
  -v MATTERMOST_CALLBACK_BASE_URL=http://switch.railway.internal:8081 \
  -v MATTERMOST_ADMIN_USER=admin -v "MATTERMOST_ADMIN_PASSWORD=$MATTERMOST_ADMIN_PASSWORD" \
  -v MATTERMOST_TEAM_NAME=ashgrave -v MATTERMOST_USER=detective \
  -v "MATTERMOST_USER_PASSWORD=$MATTERMOST_USER_PASSWORD" \
  -v GATEWAY_ADMIN_EMAIL=admin@switch.local -v "GATEWAY_ADMIN_PASSWORD=$GATEWAY_ADMIN_PASSWORD" --json

railway add --service game \
  -v SWITCH_BRIDGE_URL=http://switch.railway.internal:8000 -v "SWITCH_REGISTRATION_KEY=$AGENT_REGISTRATION_TOKEN" \
  -v "MODEL_API_KEY=$MODEL_API_KEY" -v MATTERMOST_URL=http://mattermost.railway.internal:8065 \
  -v MATTERMOST_TEAM_NAME=ashgrave -v MATTERMOST_USER=detective \
  -v "MATTERMOST_USER_PASSWORD=$MATTERMOST_USER_PASSWORD" \
  -v GATEWAY_ADMIN_EMAIL=admin@switch.local -v "GATEWAY_ADMIN_PASSWORD=$GATEWAY_ADMIN_PASSWORD" \
  -v "PGHOST=$PGHOST_REF" -v PGPORT=5432 -v PGUSER=postgres -v "PGPASSWORD=$PG" \
  -v DB_NAME=switch -v DB_USER=switch_app -v "DB_PASSWORD=$DB_PASSWORD" \
  -v PLAYERS=detective -v STATE_DIR=/data -v PORT=5180 --json
