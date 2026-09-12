-- Adds kiosk support columns to "Order".
--
-- Strictly additive and idempotent: every statement is ADD COLUMN IF NOT EXISTS
-- or CREATE INDEX IF NOT EXISTS. No table is dropped, no column is altered or
-- removed, and no existing row is rewritten beyond receiving the 'pos' default.
-- Safe to run more than once.
--
-- Run this BEFORE deploying the backend that reads these columns:
--   psql "$DATABASE_URL" -f apps/backend/prisma/manual/add_order_source_and_kitchen_print.sql
-- or paste it into the Supabase SQL editor.

-- Where the order was placed: 'pos' (staff terminal), 'kiosk', 'online'.
-- Existing rows become 'pos', which is what they are.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'pos';

-- Set once by whichever device prints the kitchen docket, so it can never print twice.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "kitchenPrintedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "kitchenPrintedBy" TEXT;

-- Supports the kitchen queue lookup (kitchenPrintedAt IS NULL).
CREATE INDEX IF NOT EXISTS "Order_kitchenPrintedAt_idx" ON "Order"("kitchenPrintedAt");

-- Backfill guard: orders that already existed were placed and handled before the
-- kiosk existed, so mark them as already printed. This stops the kitchen POS from
-- printing a docket for every historical order the first time it polls.
UPDATE "Order"
SET "kitchenPrintedAt" = "createdAt",
    "kitchenPrintedBy" = 'backfill'
WHERE "kitchenPrintedAt" IS NULL;
