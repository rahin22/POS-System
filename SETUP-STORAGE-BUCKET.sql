-- ============================================
-- Supabase Storage Setup for Product Images
-- ============================================
-- 
-- STEP 1: Create the storage bucket
-- Go to: https://supabase.com/dashboard/project/vwoxhvowfcgxcnslxaua/storage/buckets
-- Click "New Bucket" and configure:
--   - Name: product-images
--   - Public bucket: YES (check the box)
--   - File size limit: 5242880 (5MB)
--   - Allowed MIME types: image/jpeg,image/png,image/webp,image/gif
--
-- ============================================
-- STEP 2: Set up storage policies (RLS)
-- Run the following SQL in Supabase SQL Editor
-- ============================================

-- Allow anyone to view product images (public read access)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update images
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( 
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated' 
);

-- Allow authenticated users to delete images
CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( 
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated' 
);

-- ============================================
-- NOTES
-- ============================================
-- 
-- Image URLs will follow this format:
-- https://vwoxhvowfcgxcnslxaua.supabase.co/storage/v1/object/public/product-images/{filename}
--
-- The imageUrl column has already been added to the Product table.
-- 
-- To test the upload:
-- 1. Make sure the bucket is created
-- 2. Run the storage policies above
-- 3. Open MenuPage in the terminal app
-- 4. Click "Add Product" or "Edit" on an existing product
-- 5. Click the image upload area to select a file
-- 6. The image will be uploaded when you save the product
