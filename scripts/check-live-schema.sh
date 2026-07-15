#!/usr/bin/env bash
#
# Ask the LIVE Supabase project which migrations it actually has.
#
# WHY THIS EXISTS: `npm run test:migrations` proves the migrations are correct by
# applying all of them, in order, to a fresh database. It therefore cannot tell
# you the one thing that bit us — that production is *behind*. Migrations here are
# applied by hand, so the deployed code and the live schema drift apart silently,
# and you find out when a screen breaks.
#
# That happened: 0016 (comment threads) was written and shipped but never run, so
# `comments.parent_id` didn't exist. Everything looked fine until code that
# referenced the column reached production, and then comments stopped loading.
#
# This probes each migration's most distinctive artifact through PostgREST using
# the anon key. It's a smoke test, not a schema diff: it asks "did this migration
# land?", not "is every line of it present".
#
# Usage:  npm run check:live
#
set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ -f "$HERE/.env" ] || { echo "No .env — nothing to check against."; exit 1; }
set -a; . "$HERE/.env"; set +a

URL="${EXPO_PUBLIC_SUPABASE_URL:-}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
[ -n "$URL" ] && [ -n "$KEY" ] || { echo "Supabase env vars not set."; exit 1; }

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }

missing=0

# A column: 200 means it's selectable, 400 means PostgREST parsed it and Postgres
# said no such column.
col() {
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "$URL/rest/v1/$1?select=$2&limit=1" -H "apikey: $KEY")
  if [ "$code" = "200" ]; then green "  ok      $3"; else red "  MISSING $3"; missing=1; fi
}

# A table: 404 means it isn't there. 401/403 means it exists and is private-read,
# which several of ours deliberately are (blocks, reports) — that's a pass.
tbl() {
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "$URL/rest/v1/$1?select=*&limit=1" -H "apikey: $KEY")
  if [ "$code" = "404" ]; then red "  MISSING $2"; missing=1; else green "  ok      $2"; fi
}

# A function: 404 means it doesn't exist. Anything else (401/403 permission
# denied, 400 bad args) means it's there and the grants are doing their job.
fn() {
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$URL/rest/v1/rpc/$1" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{}')
  if [ "$code" = "404" ]; then red "  MISSING $2"; missing=1; else green "  ok      $2"; fi
}

# A storage bucket.
#
# NOT via /storage/v1/bucket/<name>: that's the admin endpoint, it refuses the
# anon key, and — the trap — it phrases the refusal as "Bucket not found". So it
# reports every bucket as missing whether or not it exists, and this script's
# first version duly told me avatar upload was broken when it was perfectly fine.
#
# Asking for a public object that cannot exist distinguishes properly, because
# storage answers "Bucket not found" and "Object not found" differently. Works
# only for public buckets — which avatars is (0015), by design.
bucket() {
  body=$(curl -s "$URL/storage/v1/object/public/$1/__probe_that_cannot_exist__")
  if printf '%s' "$body" | grep -qi 'bucket not found'; then
    red "  MISSING $2"; missing=1
  else
    green "  ok      $2"
  fi
}

echo "Probing $URL"
echo
col    profiles      handle              "0014  profiles.handle / bio / avatar_url"
bucket avatars                           "0015  avatars storage bucket"
col    comments      parent_id           "0016  comments.parent_id (threads)"
col    concerts      status              "0017  concerts.status (wishlist)"
col    concerts      lat                 "0018  concerts.lat/lng (map)"
tbl    blocks                            "0019  blocks"
tbl    reports                           "0019  reports"
fn     delete_own_account                "0020  delete_own_account()"
col    concert_tags  created_at          "0021  concert_tags.created_at (rate limits)"
fn     is_admin                          "0023  is_admin()"
col    reports       reviewed_by         "0023  reports.reviewed_by (admin triage)"
fn     browse_items                      "0024  browse_items()"
tbl    analytics_events                  "0027  analytics_events"
fn     analytics_funnel                  "0027  analytics_funnel()"
tbl    invites                           "0028  invites"
fn     my_invites                        "0028  my_invites()"

echo
if [ "$missing" = "0" ]; then
  green "The live schema has every migration this script knows about."
else
  red "Some migrations have not been applied. Run the missing ones in the SQL editor, in order."
  exit 1
fi
