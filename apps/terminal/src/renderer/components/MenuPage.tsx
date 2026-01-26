import { useState, useEffect } from 'react';
import { useApi } from '../context/ApiContext';
import { supabase } from '../lib/supabase';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  categoryId: string;
  isAvailable: boolean;
  category?: { name: string };
}

interface Modifier {
  id: string;
  name: string;
  price: number;
  groupId: string;
  isAvailable: boolean;
  group?: { name: string };
}

interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers?: Modifier[];
}

interface MenuPageProps {
  currencySymbol: string;
}

type TabType = 'products' | 'categories' | 'modifiers' | 'modifier-groups';

export function MenuPage({ currencySymbol }: MenuPageProps) {
  const { fetchApi } = useApi();
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);

  // Modal states
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [showModifierGroupModal, setShowModifierGroupModal] = useState(false);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');

  const [editingItem, setEditingItem] = useState<any>(null);

  const filteredModifiers = selectedGroupFilter === 'all'
    ? modifiers
    : modifiers.filter(m => m.groupId === selectedGroupFilter);

  const formatPrice = (price: number) => `${currencySymbol}${price.toFixed(2)}`;

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [productsRes, categoriesRes, modifiersRes, modifierGroupsRes] = await Promise.all([
        fetchApi<{ success: boolean; data: Product[] }>('/api/products'),
        fetchApi<{ success: boolean; data: Category[] }>('/api/categories'),
        fetchApi<{ success: boolean; data: Modifier[] }>('/api/modifiers'),
        fetchApi<{ success: boolean; data: ModifierGroup[] }>('/api/modifier-groups'),
      ]);

      if (productsRes.success) setProducts(productsRes.data);
      if (categoriesRes.success) setCategories(categoriesRes.data);
      if (modifiersRes.success) setModifiers(modifiersRes.data);
      if (modifierGroupsRes.success) setModifierGroups(modifierGroupsRes.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingItem(null);
    setShowProductModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingItem(product);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const response = await fetchApi<{ success: boolean }>(`/api/products/${id}`, { method: 'DELETE' });
      if (response.success) {
        loadData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveProduct = async (data: any) => {
    try {
      if (editingItem) {
        const res = await fetchApi<{ success: boolean; data: Product }>(`/api/products/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setProducts(products.map((p) => (p.id === editingItem.id ? res.data : p)));
        }
      } else {
        const res = await fetchApi<{ success: boolean; data: Product }>('/api/products', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setProducts([...products, res.data]);
        }
      }
      setShowProductModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    }
  };

  const handleToggleProductAvailability = async (product: Product) => {
    try {
      const res = await fetchApi<{ success: boolean; data: Product }>(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      });
      if (res.success) {
        setProducts(products.map((p) => (p.id === product.id ? res.data : p)));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update product availability');
    }
  };

  // Category handlers
  const handleAddCategory = () => {
    setEditingItem(null);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingItem(category);
    setShowCategoryModal(true);
  };

  const handleDeleteCategory = async (id: string) => {
    const productsInCategory = products.filter(p => p.categoryId === id).length;
    if (productsInCategory > 0) {
      alert(`Cannot delete category with ${productsInCategory} products. Please reassign or delete the products first.`);
      return;
    }
    
    if (!confirm('Are you sure you want to delete this category?')) return;
    
    try {
      const response = await fetchApi<{ success: boolean }>(`/api/categories/${id}`, { method: 'DELETE' });
      if (response.success) {
        loadData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveCategory = async (data: any) => {
    try {
      if (editingItem) {
        const res = await fetchApi<{ success: boolean; data: Category }>(`/api/categories/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setCategories(categories.map((c) => (c.id === editingItem.id ? res.data : c)));
        }
      } else {
        const res = await fetchApi<{ success: boolean; data: Category }>('/api/categories', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setCategories([...categories, res.data]);
        }
      }
      setShowCategoryModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    }
  };

  // Modifier Group handlers
  const handleAddModifierGroup = () => {
    setEditingItem(null);
    setShowModifierGroupModal(true);
  };

  const handleEditModifierGroup = (group: ModifierGroup) => {
    setEditingItem(group);
    setShowModifierGroupModal(true);
  };

  const handleDeleteModifierGroup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this modifier group?')) return;
    
    try {
      const res = await fetchApi<{ success: boolean }>(`/api/modifier-groups/${id}`, { method: 'DELETE' });
      if (res.success) {
        setModifierGroups(modifierGroups.filter((g) => g.id !== id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete modifier group');
    }
  };

  const handleSaveModifierGroup = async (data: any) => {
    try {
      if (editingItem) {
        const res = await fetchApi<{ success: boolean; data: ModifierGroup }>(`/api/modifier-groups/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setModifierGroups(modifierGroups.map((g) => (g.id === editingItem.id ? res.data : g)));
        }
      } else {
        const res = await fetchApi<{ success: boolean; data: ModifierGroup }>('/api/modifier-groups', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setModifierGroups([...modifierGroups, res.data]);
        }
      }
      setShowModifierGroupModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save modifier group');
    }
  };

  // Modifier handlers
  const handleAddModifier = () => {
    setEditingItem(null);
    setShowModifierModal(true);
  };

  const handleEditModifier = (modifier: Modifier) => {
    setEditingItem(modifier);
    setShowModifierModal(true);
  };

  const handleDeleteModifier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this modifier?')) return;
    
    try {
      const res = await fetchApi<{ success: boolean }>(`/api/modifiers/${id}`, { method: 'DELETE' });
      if (res.success) {
        setModifiers(modifiers.filter((m) => m.id !== id));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete modifier');
    }
  };

  const handleSaveModifier = async (data: any) => {
    try {
      if (editingItem) {
        const res = await fetchApi<{ success: boolean; data: Modifier }>(`/api/modifiers/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setModifiers(modifiers.map((m) => (m.id === editingItem.id ? res.data : m)));
        }
      } else {
        const res = await fetchApi<{ success: boolean; data: Modifier }>('/api/modifiers', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setModifiers([...modifiers, res.data]);
        }
      }
      setShowModifierModal(false);
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save modifier');
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Menu Management</h1>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'categories'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Categories
          </button>
          <button
            onClick={() => setActiveTab('modifiers')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'modifiers'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Modifiers
          </button>
          <button
            onClick={() => setActiveTab('modifier-groups')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'modifier-groups'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Modifier Groups
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-3">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'products' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Products ({products.length})</h2>
              <button
                onClick={handleAddProduct}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                + Add Product
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
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
                      <span className="text-lg font-bold text-primary-600">{formatPrice(product.price)}</span>
                    </div>
                    
                    {product.description && (
                      <p className="text-sm text-gray-600 mb-3">{product.description}</p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleProductAvailability(product)}
                        className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm ${
                          product.isAvailable
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {product.isAvailable ? 'Available' : 'Unavailable'}
                      </button>
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'categories' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Categories ({categories.length})</h2>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                + Add Category
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Display Order</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Products</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">{category.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{category.sortOrder}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {products.filter(p => p.categoryId === category.id).length}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleEditCategory(category)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm font-medium mr-2"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteCategory(category.id)}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'modifier-groups' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Modifier Groups ({modifierGroups.length})</h2>
              <button
                onClick={handleAddModifierGroup}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                + Add Group
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Required</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Min/Max</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Modifiers</th>
                    <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {modifierGroups.map((group) => (
                    <tr key={group.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{group.name}</div>
                        {group.description && (
                          <div className="text-sm text-gray-600">{group.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {group.isRequired ? 'Yes' : 'No'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {group.minSelections} - {group.maxSelections}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {group.modifiers?.length || 0}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleEditModifierGroup(group)}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm font-medium mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteModifierGroup(group.id)}
                          className="px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'modifiers' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-gray-900">Modifiers ({filteredModifiers.length})</h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Group:</label>
                  <select
                    value={selectedGroupFilter}
                    onChange={(e) => setSelectedGroupFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="all">All Groups</option>
                    {modifierGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddModifier}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                + Add Modifier
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredModifiers.map((modifier) => (
                <div
                  key={modifier.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-gray-900">{modifier.name}</h3>
                      <p className="text-sm text-gray-600">{modifier.group?.name}</p>
                    </div>
                    <span className="text-lg font-bold text-primary-600">{formatPrice(modifier.price)}</span>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <span
                      className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm text-center ${
                        modifier.isAvailable
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {modifier.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                    <button
                      onClick={() => handleEditModifier(modifier)}
                      className="px-3 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 font-medium text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteModifier(modifier.id)}
                      className="px-3 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 font-medium text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <ProductModal
          product={editingItem}
          categories={categories}
          currencySymbol={currencySymbol}
          onSave={handleSaveProduct}
          onClose={() => setShowProductModal(false)}
        />
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <CategoryModal
          category={editingItem}
          onSave={handleSaveCategory}
          onClose={() => setShowCategoryModal(false)}
        />
      )}

      {/* Modifier Group Modal */}
      {showModifierGroupModal && (
        <ModifierGroupModal
          group={editingItem}
          onSave={handleSaveModifierGroup}
          onClose={() => setShowModifierGroupModal(false)}
        />
      )}

      {/* Modifier Modal */}
      {showModifierModal && (
        <ModifierModal
          modifier={editingItem}
          groups={modifierGroups}
          currencySymbol={currencySymbol}
          onSave={handleSaveModifier}
          onClose={() => setShowModifierModal(false)}
        />
      )}
    </div>
  );
}

interface ProductModalProps {
  product: Product | null;
  categories: Category[];
  currencySymbol: string;
  onSave: (data: any) => void;
  onClose: () => void;
}

function ProductModal({ product, categories, currencySymbol, onSave, onClose }: ProductModalProps) {
  const [name, setName] = useState(product?.name || '');
  const [description, setDescription] = useState(product?.description || '');
  const [price, setPrice] = useState(product?.price?.toString() || '');
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || '');
  const [isAvailable, setIsAvailable] = useState(product?.isAvailable ?? true);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl || null);
  const [uploading, setUploading] = useState(false);

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

      const { error } = await supabase.storage
        .from('product-images')
        .upload(fileName, imageFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
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
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        finalImageUrl = uploadedUrl;
      }
    }

    onSave({
      name,
      description: description || undefined,
      price: parseFloat(price),
      categoryId,
      isAvailable,
      imageUrl: finalImageUrl || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700"
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ({currencySymbol}) *</label>
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

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAvailable"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isAvailable" className="ml-2 text-sm text-gray-700">
              Available for sale
            </label>
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

interface CategoryModalProps {
  category: Category | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

function CategoryModal({ category, onSave, onClose }: CategoryModalProps) {
  const [name, setName] = useState(category?.name || '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder?.toString() || '0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      sortOrder: parseInt(sortOrder),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {category ? 'Edit Category' : 'Add Category'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order *</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
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
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              {category ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modifier Group Modal
interface ModifierGroupModalProps {
  group: ModifierGroup | null;
  onSave: (data: any) => void;
  onClose: () => void;
}

function ModifierGroupModal({ group, onSave, onClose }: ModifierGroupModalProps) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [isRequired, setIsRequired] = useState(group?.isRequired ?? false);
  const [minSelections, setMinSelections] = useState(group?.minSelections?.toString() || '0');
  const [maxSelections, setMaxSelections] = useState(group?.maxSelections?.toString() || '1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description: description || undefined,
      isRequired,
      minSelections: parseInt(minSelections),
      maxSelections: parseInt(maxSelections),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {group ? 'Edit Modifier Group' : 'Add Modifier Group'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequired"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="isRequired" className="text-sm font-medium text-gray-700">
              Required Selection
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Selections *</label>
              <input
                type="number"
                value={minSelections}
                onChange={(e) => setMinSelections(e.target.value)}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Selections *</label>
              <input
                type="number"
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value)}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
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
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              {group ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modifier Modal
interface ModifierModalProps {
  modifier: Modifier | null;
  groups: ModifierGroup[];
  currencySymbol: string;
  onSave: (data: any) => void;
  onClose: () => void;
}

function ModifierModal({ modifier, groups, currencySymbol, onSave, onClose }: ModifierModalProps) {
  const [name, setName] = useState(modifier?.name || '');
  const [price, setPrice] = useState(modifier?.price?.toString() || '');
  const [groupId, setGroupId] = useState(modifier?.groupId || groups[0]?.id || '');
  const [isAvailable, setIsAvailable] = useState(modifier?.isAvailable ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      price: parseFloat(price),
      groupId,
      isAvailable,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {modifier ? 'Edit Modifier' : 'Add Modifier'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Price ({currencySymbol}) *</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modifier Group *</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAvailable"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700">
              Available
            </label>
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
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              {modifier ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
