import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

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

export function ModifiersPage() {
  const { fetchApi } = useAuth();
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'groups' | 'modifiers'>('groups');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showModifierModal, setShowModifierModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');

  const filteredModifiers = selectedGroupId === 'all' 
    ? modifiers 
    : modifiers.filter(m => m.groupId === selectedGroupId);

  const loadData = async () => {
    try {
      const [groupsRes, modifiersRes] = await Promise.all([
        fetchApi<{ success: boolean; data: ModifierGroup[] }>('/api/modifier-groups'),
        fetchApi<{ success: boolean; data: Modifier[] }>('/api/modifiers'),
      ]);

      if (groupsRes.success) setModifierGroups(groupsRes.data);
      if (modifiersRes.success) setModifiers(modifiersRes.data);
    } catch (error) {
      console.error('Failed to load modifiers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveGroup = async (data: Partial<ModifierGroup>) => {
    try {
      if (editingGroup) {
        const res = await fetchApi<{ success: boolean; data: ModifierGroup }>(
          `/api/modifier-groups/${editingGroup.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        );
        if (res.success) {
          setModifierGroups(modifierGroups.map((g) => (g.id === editingGroup.id ? res.data : g)));
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
      setShowGroupModal(false);
      setEditingGroup(null);
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to save modifier group');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm('Are you sure you want to delete this modifier group?')) return;

    try {
      await fetchApi(`/api/modifier-groups/${id}`, { method: 'DELETE' });
      setModifierGroups(modifierGroups.filter((g) => g.id !== id));
    } catch (error: any) {
      alert(error.message || 'Failed to delete modifier group');
    }
  };

  const handleSaveModifier = async (data: Partial<Modifier>) => {
    try {
      if (editingModifier) {
        const res = await fetchApi<{ success: boolean; data: Modifier }>(
          `/api/modifiers/${editingModifier.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(data),
          }
        );
        if (res.success) {
          setModifiers(modifiers.map((m) => (m.id === editingModifier.id ? res.data : m)));
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
      setEditingModifier(null);
      await loadData();
    } catch (error: any) {
      alert(error.message || 'Failed to save modifier');
    }
  };

  const handleDeleteModifier = async (id: string) => {
    if (!confirm('Are you sure you want to delete this modifier?')) return;

    try {
      await fetchApi(`/api/modifiers/${id}`, { method: 'DELETE' });
      setModifiers(modifiers.filter((m) => m.id !== id));
    } catch (error: any) {
      alert(error.message || 'Failed to delete modifier');
    }
  };

  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Product Modifiers</h1>
        
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('groups')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'groups'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Modifier Groups ({modifierGroups.length})
          </button>
          <button
            onClick={() => setActiveTab('modifiers')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'modifiers'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Modifiers ({modifiers.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'groups' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Modifier Groups</h2>
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
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
                          onClick={() => {
                            setEditingGroup(group);
                            setShowGroupModal(true);
                          }}
                          className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 text-sm font-medium mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
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
                <h2 className="text-xl font-bold text-gray-900">Modifiers</h2>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Group:</label>
                  <select
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
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
                onClick={() => {
                  setEditingModifier(null);
                  setShowModifierModal(true);
                }}
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
                    <span className="text-lg font-bold text-primary-600">${modifier.price.toFixed(2)}</span>
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
                      onClick={() => {
                        setEditingModifier(modifier);
                        setShowModifierModal(true);
                      }}
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

      {showGroupModal && (
        <ModifierGroupModal
          group={editingGroup}
          onSave={handleSaveGroup}
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
        />
      )}

      {showModifierModal && (
        <ModifierModal
          modifier={editingModifier}
          groups={modifierGroups}
          onSave={handleSaveModifier}
          onClose={() => {
            setShowModifierModal(false);
            setEditingModifier(null);
          }}
        />
      )}
    </div>
  );
}

function ModifierGroupModal({
  group,
  onSave,
  onClose,
}: {
  group: ModifierGroup | null;
  onSave: (data: Partial<ModifierGroup>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name || '');
  const [description, setDescription] = useState(group?.description || '');
  const [isRequired, setIsRequired] = useState(group?.isRequired || false);
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
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {group ? 'Edit Modifier Group' : 'Add Modifier Group'}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isRequired"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isRequired" className="ml-2 text-sm text-gray-700">
              Required selection
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Selections</label>
              <input
                type="number"
                min="0"
                value={minSelections}
                onChange={(e) => setMinSelections(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Selections</label>
              <input
                type="number"
                min="1"
                value={maxSelections}
                onChange={(e) => setMaxSelections(e.target.value)}
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

function ModifierModal({
  modifier,
  groups,
  onSave,
  onClose,
}: {
  modifier: Modifier | null;
  groups: ModifierGroup[];
  onSave: (data: Partial<Modifier>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(modifier?.name || '');
  const [price, setPrice] = useState(modifier?.price?.toString() || '0');
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
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {modifier ? 'Edit Modifier' : 'Add Modifier'}
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
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
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

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isAvailable"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isAvailable" className="ml-2 text-sm text-gray-700">
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
