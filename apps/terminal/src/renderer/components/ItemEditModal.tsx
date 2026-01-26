import { useState, useEffect } from 'react';
import { CartItem } from '../hooks/useCart';
import { useApi } from '../context/ApiContext';

interface Modifier {
  id: string;
  name: string;
  price: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelections: number;
  modifiers: Modifier[];
}

interface Product {
  id: string;
  name: string;
  price: number;
  modifierGroups: ModifierGroup[];
}

interface ItemEditModalProps {
  item: CartItem;
  onSave: (itemId: string, modifiers: Array<{ id: string; name: string; price: number }>, notes: string) => void;
  onClose: () => void;
}

export default function ItemEditModal({ item, onSave, onClose }: ItemEditModalProps) {
  const { fetchApi } = useApi();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedModifiers, setSelectedModifiers] = useState<Map<string, Modifier[]>>(new Map());
  const [notes, setNotes] = useState(item.notes || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch product details with modifier groups
    fetchApi<{ success: boolean; data: Product }>(`/api/products/${item.productId}`)
      .then(response => {
        if (response.success) {
          const data = response.data;
          setProduct(data);
          
          // Initialize selectedModifiers from current item modifiers
          const initialModifiers = new Map<string, Modifier[]>();
          if (data.modifierGroups) {
            data.modifierGroups.forEach((group: ModifierGroup) => {
              const groupModifiers = item.modifiers.filter(m => 
                group.modifiers.some(gm => gm.id === m.id)
              );
              if (groupModifiers.length > 0) {
                initialModifiers.set(group.id, groupModifiers);
              }
            });
          }
          setSelectedModifiers(initialModifiers);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch product:', err);
        setLoading(false);
      });
  }, [item.productId, item.modifiers, fetchApi]);

  const toggleModifier = (groupId: string, modifier: Modifier, maxSelections: number) => {
    setSelectedModifiers(prev => {
      const newMap = new Map(prev);
      const groupMods = [...(newMap.get(groupId) || [])]; // Create a copy of the array
      
      const index = groupMods.findIndex(m => m.id === modifier.id);
      if (index >= 0) {
        // Remove modifier
        groupMods.splice(index, 1);
        newMap.set(groupId, groupMods);
      } else {
        // Add modifier (check maxSelections)
        if (maxSelections === 1) {
          // Radio behavior - replace existing
          newMap.set(groupId, [modifier]);
        } else {
          // Checkbox behavior - add if under limit
          if (groupMods.length < maxSelections) {
            groupMods.push(modifier);
            newMap.set(groupId, groupMods);
          } else {
            return prev; // Can't add more
          }
        }
      }
      
      return newMap;
    });
  };

  const isModifierSelected = (groupId: string, modifierId: string) => {
    const groupMods = selectedModifiers.get(groupId) || [];
    return groupMods.some(m => m.id === modifierId);
  };

  const handleSave = () => {
    // Flatten all selected modifiers
    const allModifiers: Array<{ id: string; name: string; price: number }> = [];
    selectedModifiers.forEach(mods => {
      allModifiers.push(...mods);
    });
    
    onSave(item.id, allModifiers, notes);
    onClose();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(price);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4">
          <div className="text-center py-8">Loading...</div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4">
          <div className="text-center py-8">
            <p>Failed to load product details</p>
            <button onClick={onClose} className="mt-4 py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Edit: {item.productName}</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full hover:bg-gray-200 flex items-center justify-center text-2xl"
          >
            ×
          </button>
        </div>

        {/* Modifier Groups */}
        {product.modifierGroups && product.modifierGroups.length > 0 && (
          <div className="space-y-4 mb-6">
            {product.modifierGroups.map((group) => {
              const groupMods = selectedModifiers.get(group.id) || [];
              const canSelectMore = groupMods.length < group.maxSelections;
              
              console.log(`Group: ${group.name}, maxSelections: ${group.maxSelections}, currentCount: ${groupMods.length}, canSelectMore: ${canSelectMore}`);
              
              return (
                <div key={group.id}>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    {group.name}
                    {group.minSelect > 0 && (
                      <span className="text-red-600 ml-2">
                        (Required: {group.minSelect})
                      </span>
                    )}
                    {group.maxSelections < 999 && (
                      <span className="text-gray-500 ml-2">
                        (Max: {group.maxSelections})
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {group.modifiers.map((modifier) => {
                      const isSelected = isModifierSelected(group.id, modifier.id);
                      const isDisabled = !isSelected && !canSelectMore;
                      
                      return (
                        <button
                          key={modifier.id}
                          onClick={() => toggleModifier(group.id, modifier, group.maxSelections)}
                          disabled={isDisabled}
                          className={`
                            p-3 rounded-lg border-2 text-left transition-all
                            ${isSelected 
                              ? 'border-primary-500 bg-primary-50 text-primary-700' 
                              : isDisabled
                              ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                              : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
                            }
                          `}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{modifier.name}</span>
                            {modifier.price > 0 && (
                              <span className="text-sm">
                                +{formatPrice(modifier.price)}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Instructions
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any special requests..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:outline-none resize-none"
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
