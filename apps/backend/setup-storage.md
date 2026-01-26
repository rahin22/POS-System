# Supabase Storage Setup for Product Images

## 1. Create Storage Bucket in Supabase

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/vwoxhvowfcgxcnslxaua
2. Navigate to **Storage** in the left sidebar
3. Click **New Bucket**
4. Configure the bucket:
   - **Name**: `product-images`
   - **Public bucket**: ✅ Check this (so images are publicly accessible)
   - **File size limit**: 5 MB (or as needed)
   - **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`

## 2. Set Storage Policies (RLS)

After creating the bucket, set up the following policies:

### Policy 1: Public Read Access
```sql
-- Allow anyone to view product images
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'product-images' );
```

### Policy 2: Authenticated Upload
```sql
-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images' 
  AND auth.role() = 'authenticated'
);
```

### Policy 3: Authenticated Update/Delete
```sql
-- Allow authenticated users to update/delete images
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'product-images' AND auth.role() = 'authenticated' );
```

## 3. Add imageUrl Column to Products Table

Run this SQL in Supabase SQL Editor:

```sql
-- Add imageUrl column to products table
ALTER TABLE "Product" 
ADD COLUMN "imageUrl" TEXT;

-- Optional: Add comment for documentation
COMMENT ON COLUMN "Product"."imageUrl" IS 'URL to product image in Supabase storage';
```

## 4. Image URL Format

Once uploaded, your image URLs will follow this format:
```
https://vwoxhvowfcgxcnslxaua.supabase.co/storage/v1/object/public/product-images/{filename}
```

Example:
```
https://vwoxhvowfcgxcnslxaua.supabase.co/storage/v1/object/public/product-images/kebab-plate.jpg
```

## 5. Upload Example (TypeScript)

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function uploadProductImage(file: File, productId: string) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${productId}-${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  return publicUrl;
}
```

## 6. Update Product with Image URL

After uploading, update the product:

```typescript
await fetch(`http://localhost:3001/api/products/${productId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ imageUrl: publicUrl })
});
```

## 7. File Organization (Optional)

You can organize files in folders:
- `product-images/categories/{categoryName}/{productId}.jpg`
- `product-images/{year}/{month}/{productId}.jpg`
- Or keep flat: `product-images/{productId}.jpg`

## Quick Setup Steps

1. ✅ Create `product-images` bucket (public)
2. ✅ Run storage policies SQL
3. ✅ Run ALTER TABLE SQL to add imageUrl column
4. ✅ Update Prisma schema
5. ✅ Run `npx prisma db pull` to sync schema
6. ✅ Run `npx prisma generate` to update client
7. ✅ Add image upload UI to MenuPage
