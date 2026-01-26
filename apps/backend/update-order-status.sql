-- Update OrderStatus enum to simplified workflow
-- IMPORTANT: Run these statements ONE AT A TIME in Supabase SQL Editor
-- PostgreSQL requires enum values to be committed before use

-- STEP 1: Add 'received' to the existing enum (RUN THIS FIRST, THEN WAIT)
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'received';

-- STEP 2: Update existing orders to new status values (RUN THIS SECOND)
-- UPDATE "Order" SET status = 'received' WHERE status IN ('pending', 'confirmed');

-- STEP 3: Rename old enum and create new one (RUN THIS THIRD)
-- ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
-- CREATE TYPE "OrderStatus" AS ENUM ('received', 'preparing', 'ready', 'completed', 'cancelled');

-- STEP 4: Update the Order table to use the new enum (RUN THIS FOURTH)
ALTER TABLE "Order" ALTER COLUMN status DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN status TYPE "OrderStatus" USING status::text::"OrderStatus";
ALTER TABLE "Order" ALTER COLUMN status SET DEFAULT 'received'::"OrderStatus";

-- STEP 5: Drop the old enum (RUN THIS LAST)
DROP TYPE "OrderStatus_old";
