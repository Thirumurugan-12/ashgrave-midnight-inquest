#!/bin/sh
# Boot sequence for the hosted game (Railway). Every step is safe to repeat.
set -e
mkdir -p "$STATE_DIR"

# 1. Databases: what infra's init-db does locally. Mattermost's database, Switch's
#    database, and Switch's restricted runtime role (it must not own the tables).
if [ -n "$PGHOST" ]; then
  until psql -d postgres -c 'select 1' >/dev/null 2>&1; do echo "waiting for postgres"; sleep 3; done
  psql -d postgres -tc "select 1 from pg_database where datname='mattermost'" | grep -q 1 || psql -d postgres -c 'create database mattermost'
  psql -d postgres -tc "select 1 from pg_database where datname='$DB_NAME'" | grep -q 1 || psql -d postgres -c "create database \"$DB_NAME\""
  psql -d postgres -tc "select 1 from pg_roles where rolname='$DB_USER'" | grep -q 1 ||
    psql -d postgres -c "create role \"$DB_USER\" login password '$DB_PASSWORD' nosuperuser nocreatedb nocreaterole nobypassrls"
  psql -d postgres -c "alter role \"$DB_USER\" password '$DB_PASSWORD'" >/dev/null
  echo "✓ databases ready"
fi

# 2. Wait for Switch.
until node -e "fetch(process.env.SWITCH_BRIDGE_URL + '/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"; do
  echo "waiting for switch"; sleep 5
done

# 3. Agents and rooms. Rooms need the Mattermost bridge, which the setup service creates.
npx tsx scripts/register.ts
until npx tsx scripts/setup-rooms.ts; do echo "waiting for the mattermost bridge"; sleep 15; done

exec npx tsx src/main.ts
