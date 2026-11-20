#!/bin/bash
# Run by cPanel Cron Jobs in place of vercel.json's crons:
#   bash /home/USER/errandspot/cron.sh reconcile-payments
#   bash /home/USER/errandspot/cron.sh digest
# Reads CRON_SECRET from .env here, so the secret never has to be pasted into the cron screen.
cd "$(dirname "$0")" || exit 1
SECRET=$(grep '^CRON_SECRET=' .env | cut -d= -f2- | tr -d '"')
curl -fsS -m 120 -H "Authorization: Bearer $SECRET" "https://errandspot.com/api/cron/$1" > /dev/null
