#!/usr/bin/env bash
# Apply every migration to a throwaway database and run the RLS checks.
#
# Usage: TEST_DATABASE_URL=postgresql://postgres@localhost:5432/postgres scripts/db/test-migrations.sh
# The URL must point at a plain Postgres server you can create databases on.
# Never point it at the Supabase project.
set -euo pipefail

: "${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to a disposable Postgres server}"
root="$(cd "$(dirname "$0")/../.." && pwd)"
db="metapick_migration_test"
admin_url="$TEST_DATABASE_URL"
# Swap the database name in the URL path, keeping any ?query parameters.
base="${TEST_DATABASE_URL%%\?*}"
query="${TEST_DATABASE_URL#"$base"}"
test_url="${base%/*}/$db$query"

psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "drop database if exists $db" -c "create database $db"
trap 'psql "$admin_url" -q -c "drop database if exists $db" >/dev/null 2>&1 || true' EXIT

psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/00_local_roles.sql"
for file in "$root"/supabase/migrations/*.sql; do
  echo "applying $(basename "$file")"
  psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$file"
done
psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/rls_test.sql"
psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/updater_test.sql"

if [[ -f "$root/supabase/seed.sql" ]]; then
  # Applying the seed twice proves it is idempotent.
  echo "applying seed.sql twice"
  psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/seed.sql" >/dev/null
  psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/seed.sql" >/dev/null
  psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/rls_test.sql"
  psql "$test_url" -v ON_ERROR_STOP=1 -q -f "$root/supabase/tests/updater_test.sql"
fi
