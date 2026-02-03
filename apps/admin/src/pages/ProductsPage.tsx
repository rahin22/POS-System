import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  price: number;
  pricePerKg?: number | null;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  category?: { name: string };
  isAvailable: boolean;
  sortOrder: number;
  modifierGroups?: ModifierGroup[];
}

interface Category {
  id: string;
  name: string;
}

interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  modifiers?: Array<{ id: string; name: string; price: number }>;
  _count?: {
    modifiers: number;
  };
}

export function ProductsPage() {
  const { fetchApi } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  const loadData = async () => {
    try {
      const [productsRes, categoriesRes, groupsRes] = await Promise.all([
        fetchApi<{ success: boolean; data: Product[] }>('/api/products'),
        fetchApi<{ success: boolean; data: Category[] }>('/api/categories'),
        fetchApi<{ success: boolean; data: ModifierGroup[] }>('/api/modifier-groups'),
      ]);

      if (productsRes.success) setProducts(productsRes.data);
      if (categoriesRes.success) setCategories(categoriesRes.data);
      if (groupsRes.success) setModifierGroups(groupsRes.data);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fetchApi]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      await fetchApi(`/api/products/${id}`, { method: 'DELETE' });
      setProducts(products.filter((p) => p.id !== id));
    } catch (error) {
      alert('Failed to delete product');
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      await fetchApi(`/api/products/${product.id}/availability`, { method: 'PATCH' });
      setProducts(products.map((p) => 
        p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p
      ));
    } catch (error) {
      alert('Failed to update availability');
    }
  };

  const handleSave = async (data: Partial<Product>, modifierGroupIds: string[]) => {
    try {
      console.log('handleSave received data:', data);
      let savedProduct: Product;
      
      if (editingProduct) {
        console.log('Updating product:', editingProduct.id);
        const res = await fetchApi<{ success: boolean; data: Product }>(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        console.log('Update response:', res);
        if (res.success) {
          savedProduct = res.data;
          setProducts(products.map((p) => (p.id === editingProduct.id ? res.data : p)));
        } else {
          throw new Error('Failed to update product');
        }
      } else {
        console.log('Creating new product');
        const res = await fetchApi<{ success: boolean; data: Product }>('/api/products', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        console.log('Create response:', res);
        if (res.success) {
          savedProduct = res.data;
          setProducts([...products, res.data]);
        } else {
          throw new Error('Failed to create product');
        }
      }
      
      // Update modifier groups if provided
      if (modifierGroupIds && savedProduct) {
        try {
          await fetchApi(`/api/products/${savedProduct.id}/modifier-groups`, {
            method: 'PUT',
            body: JSON.stringify({ modifierGroupIds }),
          });
        } catch (error) {
          console.error('Failed to update modifier groups:', error);
        }
      }
      
      setShowModal(false);
      setEditingProduct(null);
      // Reload data to ensure we have the latest from server
      await loadData();
    } catch (error: any) {
      console.error('Save product error:', error);
      alert(error.message || 'Failed to save product');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  const filteredProducts = useMemo(() => {
    let result = products;

    // Category filter
    if (selectedCategoryId !== 'all') {
      result = result.filter(p => p.categoryId === selectedCategoryId);
    }

    // Availability filter
    if (availabilityFilter === 'available') {
      result = result.filter(p => p.isAvailable);
    } else if (availabilityFilter === 'unavailable') {
      result = result.filter(p => !p.isAvailable);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.category?.name.toLowerCase().includes(query)
      );
    }

    return result;
  }, [products, selectedCategoryId, availabilityFilter, searchQuery]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Products</h1>
            <p className="text-sm text-gray-500 mt-1">
              Showing {filteredProducts.length} of {products.length} products
            </p>
          </div>
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            + Add Product
          </button>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <input
              type="text"
              placeholder="Search by name, description, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Availability Filter */}
          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as 'all' | 'available' | 'unavailable')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Status</option>
            <option value="available">✅ Available</option>
            <option value="unavailable">❌ Unavailable</option>
          </select>

          {/* Clear Filters */}
          {(searchQuery || selectedCategoryId !== 'all' || availabilityFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategoryId('all');
                setAvailabilityFilter('all');
              }}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-2">📦</p>
            <p className="text-gray-500 text-lg">
              {products.length === 0 
                ? 'No products yet' 
                : 'No products match your filters'}
            </p>
            {products.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId('all');
                  setAvailabilityFilter('all');
                }}
                className="text-primary-600 hover:text-primary-700 mt-2"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {product.imageUrl && (
                <div className="w-full h-48 bg-gray-100">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-gray-900">{product.name}</h3>
                    <p className="text-sm text-gray-600">{product.category?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-primary-600">${product.price.toFixed(2)}</span>
                    {product.pricePerKg && (
                      <p className="text-sm text-gray-500">${product.pricePerKg.toFixed(2)}/kg</p>
                    )}
                  </div>
                </div>
                
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleAvailability(product)}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm ${
                      product.isAvailable
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {product.isAvailable ? 'Available' : 'Unavailable'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingProduct(product);
                      setShowModal(true);
                    }}
                    className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>

      {showModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          modifierGroups={modifierGroups}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  categories,
  modifierGroups,
  onSave,
  onClose,
}: {
  product: Product | null;
  categories: Category[];
  modifierGroups: ModifierGroup[];
  onSave: (data: Partial<Product>, modifierGroupIds: string[]) => void;
  onClose: () => void;
}) {
  useAuth();
  const [name, setName] = useState(product?.name || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [pricePerKg, setPricePerKg] = useState(product?.pricePerKg?.toString() || '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || '');
  const [description, setDescription] = useState(product?.description || '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [sortOrder, setSortOrder] = useState((product as any)?.sortOrder?.toString() || '0');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl || null);
  const [uploading, setUploading] = useState(false);
  const [selectedModifierGroups, setSelectedModifierGroups] = useState<string[]>(
    product?.modifierGroups?.map((mg) => mg.id) || []
  );

  const handleModifierGroupToggle = (groupId: string) => {
    setSelectedModifierGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      // Use createObjectURL instead of FileReader to avoid CSP issues
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;

    try {
      setUploading(true);
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      console.log('Uploading to Supabase:', fileName);

      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Supabase upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      console.log('Generated public URL:', publicUrl);
      return publicUrl;
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('Failed to upload image: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalImageUrl = imageUrl;
    if (imageFile) {
      console.log('Uploading image...');
      const uploadedUrl = await uploadImage();
      console.log('Upload result:', uploadedUrl);
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }

    const productData = {
      name,
      price: parseFloat(price),
      pricePerKg: pricePerKg ? parseFloat(pricePerKg) : null,
      categoryId,
      description: description || undefined,
      imageUrl: finalImageUrl || undefined,
      sortOrder: parseInt(sortOrder),
    };
    
    console.log('Saving product with data:', productData);
    
    // Save product and modifier groups together
    onSave(productData, selectedModifierGroups);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {product ? 'Edit Product' : 'Add Product'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per kg ($)</label>
            <input
              type="number"
              step="0.01"
              value={pricePerKg}
              onChange={(e) => setPricePerKg(e.target.value)}
              placeholder="Leave empty if not sold by weight"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">Optional: Set this for items like baklava that can be sold by weight</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
            
            {imagePreview ? (
              <div className="relative">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-48 object-cover rounded-lg border border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleImageChange}
                  className="hidden"
                  id="image-upload"
                />
                <label 
                  htmlFor="image-upload" 
                  className="cursor-pointer block"
                >
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600">Click to upload image</p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG, WEBP or GIF up to 5MB</p>
                </label>
              </div>
            )}
          </div>

          {/* Modifier Groups */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Modifier Groups
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
              {modifierGroups.length === 0 ? (
                <p className="text-sm text-gray-500">No modifier groups available</p>
              ) : (
                modifierGroups.map(group => (
                  <label key={group.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                    <input
                      type="checkbox"
                      checked={selectedModifierGroups.includes(group.id)}
                      onChange={() => handleModifierGroupToggle(group.id)}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 flex-1">{group.name}</span>
                    <span className="text-xs text-gray-500">
                      {group.modifiers?.length || 0} modifier{group.modifiers?.length !== 1 ? 's' : ''}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="0"
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first</p>
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={uploading}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : product ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
