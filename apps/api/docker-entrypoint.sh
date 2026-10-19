#!/bin/sh
set -e
# Migrations and seed are idempotent, so every start brings the database up to date.
(cd /app/packages/db && ./node_modules/.bin/prisma migrate deploy)
node /app/apps/api/dist/cli/seed.js
exec node /app/apps/api/dist/main.js
