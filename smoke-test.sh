#!/usr/bin/env bash
# Read-only HTTP smoke check — the automatable subset of
# docs/CUTOVER-CHECKLIST.md §5. Every other checklist item needs a human
# clicking through the real UI; this only confirms the routes respond.
#
#   BASE_URL=https://revayat.shop ./smoke-test.sh    # only once DNS/TLS are live
#   BASE_URL=http://localhost:3002 ./smoke-test.sh    # local/staging
set -u
BASE_URL="${BASE_URL:-http://localhost:3002}"
fail=0

check() {
  local path="$1" expect="${2:-200}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${BASE_URL}${path}")
  if [ "$code" = "$expect" ]; then
    echo "OK   $code  $path"
  else
    echo "FAIL $code  $path  (expected $expect)"
    fail=1
  fi
}

check "/"
check "/collections"
check "/search?q=test"
check "/sitemap.xml"
check "/robots.txt"
check "/admin/login"
check "/cart"

if [ "$fail" -ne 0 ]; then
  echo "smoke test FAILED"
  exit 1
fi
echo "smoke test passed — all routes responded as expected"
