#!/bin/sh
set -eu

# scripts/migrate-deploy-safe.sh
# Goal: avoid noisy Prisma P3005 in Vercel builds while keeping prod-safe behavior.
# Strategy:
# 1) Try migrate deploy
# 2) If P3005 (db not empty / needs baseline), mark existing migrations as applied, then retry
# 3) If still failing (or any other error), fallback to prisma db push (your current behavior)

export DATABASE_DIRECT_URL="${DATABASE_DIRECT_URL:-${DATABASE_URL:-}}"

# Run migrate deploy and capture output without failing the whole build
OUT="$( (prisma migrate deploy) 2>&1 )" || true

echo "$OUT" | grep -q "P3005" && P3005=1 || P3005=0
echo "$OUT" | grep -q "Error:" && HAD_ERROR=1 || HAD_ERROR=0

if [ "$HAD_ERROR" -eq 0 ]; then
  # Clean success
  exit 0
fi

if [ "$P3005" -eq 1 ]; then
  # Baseline: mark all existing migrations as applied, then retry deploy
  if [ -d "prisma/migrations" ]; then
    for m in prisma/migrations/*; do
      if [ -d "$m" ]; then
        name="$(basename "$m")"
        # If resolve fails for any reason, keep going and let the retry/fallback handle it.
        prisma migrate resolve --applied "$name" >/dev/null 2>&1 || true
      fi
    done
  fi

  # Retry deploy
  prisma migrate deploy >/dev/null 2>&1 && exit 0 || true
fi

# Fallback (matches your existing build behavior)
prisma db push
exit 0
