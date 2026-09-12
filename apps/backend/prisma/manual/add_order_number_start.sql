-- Adds the configurable daily starting order number.
--
-- Strictly additive and idempotent: one ADD COLUMN IF NOT EXISTS with a default.
-- No table is rewritten (Postgres 11+ stores the default in the catalogue), no
-- existing row is touched, and the default of 1 reproduces today's behaviour
-- exactly, so applying this on its own changes nothing.
--
-- Run this BEFORE deploying the backend that reads the column:
--   psql "$DATABASE_URL" -f apps/backend/prisma/manual/add_order_number_start.sql
-- or paste it into the Supabase SQL editor.

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "orderNumberStart" INTEGER NOT NULL DEFAULT 1;
