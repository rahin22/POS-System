-- Add imageUrl column to products table
ALTER TABLE "Product" 
ADD COLUMN "imageUrl" TEXT;

-- Optional: Add comment for documentation
COMMENT ON COLUMN "Product"."imageUrl" IS 'URL to product image in Supabase storage';
