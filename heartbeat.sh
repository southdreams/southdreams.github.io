#!/bin/bash
WORKER_ID="4327cbc6-d4c8-44b4-8ee7-808f5a0f8c9e"
SUPABASE_URL="https://uwzecizuypedpxgtuwbx.supabase.co"
ANON_KEY="sb_publishable_Gj4wqAQokZbcsz7k8ukaow_xcQzqmhk"

while true; do
  curl -s -X PATCH "${SUPABASE_URL}/rest/v1/workers?id=eq.${WORKER_ID}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d '{"status": "online", "last_seen": "now()"}'
  echo "[$(date)] heartbeat sent"
  sleep 60
done
