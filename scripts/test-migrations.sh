#!/usr/bin/env bash
#
# Replay every migration, in order, into a throwaway Postgres container.
#
# WHY: the SQL under supabase/migrations/ carries the security posture of the
# whole app — RLS, the SECURITY DEFINER account-deletion function, the rate
# limiters — and it was the only code here with no way to run it except pasting
# into the production SQL editor. That is a bad place to discover a typo, and a
# worse place to discover that a limiter silently counts zero.
#
# WHAT A PASS MEANS: every migration is valid SQL that applies cleanly, in order,
# onto a Supabase-shaped schema, and every self-test inside them held. It does
# NOT mean production is fine — see supabase/test/bootstrap.sql on the limits of
# the stand-in.
#
# Usage:  npm run test:migrations           (needs Docker running)
#         KEEP=1 npm run test:migrations    (leave the container up to poke at)
#
set -uo pipefail

CONTAINER=jelli-migration-test
IMAGE=postgres:15-alpine
PGPASSWORD=postgres
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
dim()   { printf '\033[2m%s\033[0m\n' "$*"; }

cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then
    dim "KEEP=1 — leaving container '$CONTAINER' running."
    dim "  psql:  docker exec -it $CONTAINER psql -U postgres -d jelli"
    dim "  stop:  docker rm -f $CONTAINER"
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if ! docker info >/dev/null 2>&1; then
  red "Docker is not running. Start Docker Desktop and try again."
  exit 1
fi

dim "Starting $IMAGE as '$CONTAINER'…"
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" \
  -e POSTGRES_PASSWORD="$PGPASSWORD" \
  -e POSTGRES_DB=jelli \
  "$IMAGE" >/dev/null || { red "Could not start the container."; exit 1; }

# Wait for the server to accept connections.
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U postgres -d jelli >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [ "$i" = "60" ]; then red "Postgres never became ready."; exit 1; fi
done

# ON_ERROR_STOP is the whole point: a migration that half-applies must fail the
# run, not scroll past. -q keeps the output to warnings, notices and errors.
psql_file() {
  docker exec -i "$CONTAINER" \
    psql -U postgres -d jelli -q -v ON_ERROR_STOP=1 -f - < "$1"
}

dim "Applying supabase/test/bootstrap.sql (Supabase stand-ins)…"
if ! psql_file "$HERE/supabase/test/bootstrap.sql"; then
  red "bootstrap.sql failed — the harness itself is broken, not your migration."
  exit 1
fi

failed=0
count=0

run_all() {
  count=0
  for f in "$@"; do
    name="$(basename "$f")"
    count=$((count + 1))
    if out="$(psql_file "$f" 2>&1)"; then
      # Surface RAISE NOTICE output (the self-tests announce themselves there).
      # psql prefixes these with `psql:<stdin>:NNN: `, so anchoring to ^NOTICE
      # silently matches nothing — which is how a self-test goes unnoticed.
      notices="$(printf '%s' "$out" | grep -iE 'NOTICE: +[A-Z]' | grep -viE 'already exists|skipping|does not exist' || true)"
      green "  ok   $name"
      [ -n "$notices" ] && printf '%s\n' "$notices" | sed 's/^/         /'
    else
      red   "  FAIL $name"
      printf '%s\n' "$out" | sed 's/^/         /'
      failed=1
      return 1   # a later migration assumes this one applied; carrying on is noise
    fi
  done
  return 0
}

# ---- PASS 1: a clean database -------------------------------------------------
ALL=("$HERE"/supabase/migrations/*.sql)
dim "Pass 1/2 — applying ${#ALL[@]} migrations to an empty database…"
run_all "${ALL[@]}"
total=$count

# ---- PASS 2: a database that already has data in it ---------------------------
#
# This pass is the one that earns its keep. A migration's self-test runs against
# PRODUCTION, which is full of other people's rows — so an assertion like "the
# top-rated album is mine" or "one profile matches %MAYA%" is only true of an
# empty world. It passes pass 1, then fails on the real project. That happened
# (0024, and 0025 was next); see supabase/test/seed.sql.
#
# Only the self-testing migrations are re-run, selected by grepping for the
# marker rather than by a hardcoded number — so a future one is included the day
# it's written. They're also the only idempotent ones: the early migrations use
# bare `create table`, so re-applying them is an error, not a test.
if [ "$failed" = "0" ]; then
  echo
  dim "Pass 2/2 — seeding realistic data and re-running the self-tests against it…"
  if ! psql_file "$HERE/supabase/test/seed.sql" >/dev/null 2>&1; then
    red "seed.sql failed — the harness itself is broken, not your migration."
    exit 1
  fi
  SELFTESTED=()
  for f in "$HERE"/supabase/migrations/*.sql; do
    grep -q 'SELF-TEST' "$f" && SELFTESTED+=("$f")
  done
  run_all "${SELFTESTED[@]}"
fi

echo
if [ "$failed" = "0" ]; then
  green "All $total migrations applied cleanly, and every self-test passed — including a second run against seeded data, so none of them silently assume an empty database."
else
  red "Migration run failed. Nothing was applied to any real database."
  exit 1
fi
