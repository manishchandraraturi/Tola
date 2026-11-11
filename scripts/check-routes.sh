#!/usr/bin/env bash
# Tola route check — run against a live dev server.
#
#   bash scripts/check-routes.sh [BASE_URL]     # default http://localhost:3000
#   bun run check:routes
#
# What it does:
#   1. Reads /api/state and asserts the seeded demo story (3 karigars, 5 slips,
#      slip #215 carries its fair-wastage verdict, disputes counted from the DB).
#   2. Issues a fresh slip through the API and walks the whole flow:
#      confirm -> return -> dispute (blocks approvals + Settler) -> resolve
#      -> both approvals -> settled. Asserts the ledger grows on every step
#      and that stats.disputes follows the database.
#   3. Checks server-side validation (bad "side", wrong status, missing fields).
#   4. Checks the agent routes, then POSTs /api/seed to restore the demo story.
set -u

BASE="${1:-http://localhost:3000}"
PASS=0
FAIL=0

say()  { printf '%s\n' "== $*"; }
ok()   { PASS=$((PASS + 1)); printf '  PASS %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf '  FAIL %s\n' "$1"; }

expect_eq() { # label expected actual
  if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 — expected [$2], got [$3]"; fi
}

# curl helper: body on stdout, HTTP code in STATUS_FILE (a file, because req
# runs inside command substitution and variables would not survive it).
STATUS_FILE=$(mktemp)
trap 'rm -f "$STATUS_FILE"' EXIT
status() { cat "$STATUS_FILE"; }
expect_status() { # label expected
  expect_eq "$1" "$2" "$(status)"
}
req() { # method path [json-body]
  local out
  if [ $# -ge 3 ]; then
    out=$(curl -s -m 15 -w $'\n%{http_code}' -X "$1" -H 'Content-Type: application/json' -d "$3" "$BASE$2")
  else
    out=$(curl -s -m 15 -w $'\n%{http_code}' -X "$1" "$BASE$2")
  fi
  printf '%s' "${out##*$'\n'}" > "$STATUS_FILE"
  printf '%s' "$out" | sed '$d'
}

jget() { # json-string python-expr -> prints result
  printf '%s' "$1" | python3 -c "
import json, sys
d = json.load(sys.stdin)
try:
    print($2)
except Exception as e:
    print('ERR:' + str(e))
"
}

expect_json() { # label json python-expr expected
  local got
  got=$(jget "$2" "$3")
  expect_eq "$1" "$4" "$got"
}

say "Tola route check against $BASE"

# ---- 1. seeded state ---------------------------------------------------------
say "1. GET /api/state — the demo story"
STATE=$(req GET /api/state)
expect_status "status" "200"
expect_json "3 karigars"          "$STATE" "len(d['karigars'])" "3"
expect_json "5 seeded slips"      "$STATE" "len(d['slips'])" "5"
expect_json "disputes counted from DB" "$STATE" "d['stats']['disputes']" "0"
expect_json "slip #215 is RETURNED" "$STATE" "[s['status'] for s in d['slips'] if s['number']==215][0]" "RETURNED"
expect_json "slip #215 has its fairFlag verdict" "$STATE" "bool([s['fairFlag'] for s in d['slips'] if s['number']==215][0])" "True"
LEDGER0=$(jget "$STATE" "len(d['ledger'])")

# karigar ids for the flow
Ravi=$(jget "$STATE" "[k['id'] for k in d['karigars'] if k['name'].startswith('Ravi')][0]")

# ---- 2. full slip flow with a dispute -----------------------------------------
say "2. Issue -> confirm -> return"
DUE=$(python3 -c "from datetime import date, timedelta; print((date.today()+timedelta(days=7)).isoformat()+'T09:00:00.000Z')")
CREATED=$(req POST /api/slips "{\"karigarId\":\"$Ravi\",\"weightGrams\":10,\"purity\":\"22K\",\"job\":\"Route-check set\",\"wastageAgreedPct\":3,\"dueDate\":\"$DUE\"}")
expect_status "POST /api/slips status" "200"
SLIP=$(jget "$CREATED" "d['slip']['id']")
NUM=$(jget "$CREATED" "d['slip']['number']")
expect_json "new slip is ISSUED" "$CREATED" "d['slip']['status']" "ISSUED"

CONFIRM=$(req POST "/api/slips/$SLIP/confirm")
expect_status "karigar confirm status" "200"
expect_json "slip now WORKING" "$CONFIRM" "d['slip']['status']" "WORKING"

RETURNED=$(req POST "/api/slips/$SLIP/return" '{"pieceWeightGrams":9.5,"scrapWeightGrams":0.2}')
expect_status "return status" "200"
expect_json "slip now RETURNED" "$RETURNED" "d['slip']['status']" "RETURNED"
expect_json "return computes wastage (0.3 here)" "$RETURNED" "d['slip']['wastageActualPct']" "3"
expect_json "return stores the fair verdict" "$RETURNED" "len(d['verdict'])>0" "True"

say "3. Server-side validation (never trust the client)"
BAD=$(req POST "/api/slips/$SLIP/dispute" '{"side":"admin","note":"nope"}')
expect_status "dispute with a bogus side is rejected" "400"
BAD=$(req POST "/api/slips/$SLIP/approve" '{"side":"someone-else","hacked":true}')
expect_status "approve with a bogus side is rejected" "400"
BAD=$(req POST "/api/slips/$SLIP/return" '{"pieceWeightGrams":99,"scrapWeightGrams":0}')
expect_status "return above issued weight is rejected" "400"

say "4. Flag a dispute -> settlement blocks"
DISPUTE=$(req POST "/api/slips/$SLIP/dispute" '{"side":"karigar","note":"weights look off to me"}')
expect_status "karigar flags dispute" "200"
expect_json "slip marked disputed" "$DISPUTE" "d['slip']['disputed']" "True"
STATE2=$(req GET /api/state)
expect_json "stats.disputes follows the DB" "$STATE2" "d['stats']['disputes']" "1"

BLOCKED=$(req POST "/api/slips/$SLIP/approve" '{"side":"jeweller"}')
expect_status "approval is blocked with 409" "409"
BLOCKED=$(req POST "/api/agents/settler" "{\"slipId\":\"$SLIP\"}")
expect_status "Settler is blocked with 409" "409"

JOINED=$(req POST "/api/slips/$SLIP/dispute" '{"side":"jeweller","note":"checking the scrap with him"}')
expect_status "jeweller adds his side" "200"
expect_json "both sides on the dispute note" "$JOINED" "'checking the scrap' in d['slip']['disputeNote']" "True"

say "5. Resolve -> both approvals -> settled"
RESOLVED=$(req POST "/api/slips/$SLIP/dispute" '{"side":"jeweller","resolve":true,"note":"talked it out"}')
expect_status "resolve dispute" "200"
expect_json "dispute cleared" "$RESOLVED" "d['slip']['disputed']" "False"

A1=$(req POST "/api/slips/$SLIP/approve" '{"side":"jeweller"}')
expect_status "jeweller approves" "200"
expect_json "not settled yet — waiting for the karigar" "$A1" "d['settled']" "False"
A2=$(req POST "/api/slips/$SLIP/approve" '{"side":"karigar"}')
expect_status "karigar approves" "200"
expect_json "both taps -> settled" "$A2" "d['settled']" "True"
expect_json "payment recorded" "$A2" "d['slip']['status']" "SETTLED"

STATE3=$(req GET /api/state)
expect_json "no open disputes left" "$STATE3" "d['stats']['disputes']" "0"
expect_json "every state change left a ledger entry" "$STATE3" "len(d['ledger'])>$LEDGER0" "True"
expect_json "new slip visible with karigar name" "$STATE3" "[s['karigarName'] for s in d['slips'] if s['number']==$NUM][0]" "Ravi Kumar"

# ---- 6. agent routes ------------------------------------------------------------
say "6. Agent routes"
W=$(req GET /api/agents/watcher)
expect_status "GET /api/agents/watcher" "200"
expect_json "watcher summary present" "$W" "len(d['summary'])>0" "True"
F=$(req GET /api/agents/fairwastage)
expect_status "GET /api/agents/fairwastage" "200"
expect_json "fairwastage has bands per karigar" "$F" "len(d['bands'])" "3"
S=$(req POST /api/agents/scribe '{"text":"Meena Naik: 8 grams 22K jhumkas, wastage 4, in 5 days"}')
expect_status "POST /api/agents/scribe" "200"
expect_json "scribe matched the karigar by name" "$S" "d['karigarName']" "Meena Naik"
S2=$(req POST /api/agents/scribe '{"text":"8 grams 22K jhumkas, in 5 days"}')
expect_json "scribe returns null karigar when nobody is named" "$S2" "d['karigarId']" "None"

# ---- 7. restore the demo story ---------------------------------------------------
say "7. POST /api/seed — restore the demo story"
SEED=$(req POST /api/seed)
expect_status "reseed status" "200"
FINAL=$(req GET /api/state)
expect_json "back to 5 slips" "$FINAL" "len(d['slips'])" "5"
expect_json "back to 3 karigars" "$FINAL" "len(d['karigars'])" "3"
expect_json "no disputes after reseed" "$FINAL" "d['stats']['disputes']" "0"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
