import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Category {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { products: number };
}

export function CategoriesPage() {
  const { fetchApi } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const loadData = async () => {
    try {
      const res = await fetchApi<{ success: boolean; data: Category[] }>('/api/categories');
      if (res.success) setCategories(res.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [fetchApi]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? Categories with products cannot be deleted.')) return;

    try {
      await fetchApi(`/api/categories/${id}`, { method: 'DELETE' });
      setCategories(categories.filter((c) => c.id !== id));
    } catch (error: any) {
      alert(error.message || 'Failed to delete category');
    }
  };

  const handleSave = async (data: Partial<Category>) => {
    try {
      if (editingCategory) {
        const res = await fetchApi<{ success: boolean; data: Category }>(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        });
        if (res.success) {
          setCategories(categories.map((c) => (c.id === editingCategory.id ? { ...c, ...res.data } : c)));
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
      setShowModal(false);
      setEditingCategory(null);
    } catch (error: any) {
      alert(error.message || 'Failed to save category');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Categories</h1>
        <button
          onClick={() => {
            setEditingCategory(null);
            setShowModal(true);
          }}
          className="btn-primary"
        >
          + Add Category
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Products</th>
              <th>Sort Order</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="font-medium">{category.name}</td>
                <td className="text-gray-500">{category.description || '-'}</td>
                <td>{category._count?.products || 0}</td>
                <td>{category.sortOrder}</td>
                <td>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      category.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {category.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingCategory(category);
                        setShowModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <CategoryModal
          category={editingCategory}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  onSave,
  onClose,
}: {
  category: Category | null;
  onSave: (data: Partial<Category>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name || '');
  const [description, setDescription] = useState(category?.description || '');
  const [sortOrder, setSortOrder] = useState(category?.sortOrder?.toString() || '0');
  const [isActive, setIsActive] = useState(category?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      description: description || undefined,
      sortOrder: parseInt(sortOrder) || 0,
      isActive,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {category ? 'Edit Category' : 'Add Category'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="input"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
