import { useMemo, useState } from 'react';
import { Check, Minus, Plus, X, AlertTriangle } from 'lucide-react';

export interface SheetModifier {
  id: string;
  name: string;
  price: number;
}

export interface SheetModifierGroup {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: SheetModifier[];
}

export interface SheetProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  modifierGroups?: SheetModifierGroup[];
}

interface ModifierSheetProps {
  product: SheetProduct;
  currencySymbol: string;
  onAdd: (
    product: SheetProduct,
    quantity: number,
    modifiers: SheetModifier[],
    notes?: string
  ) => void;
  onClose: () => void;
}

/** "No Sauce" / "No Salad" style options clear the rest of their group rather than stacking */
function isExclusive(modifier: SheetModifier): boolean {
  return /^(no|none|plain)\b/i.test(modifier.name.trim());
}

/**
 * How many options a group genuinely demands.
 *
 * Deliberately trusts minSelections rather than forcing 1 whenever isRequired is set:
 * Salad is flagged required but carries minSelections 0, and it sits on 52 products.
 * Treating that as "pick one" would nag staff on nearly every kebab.
 */
function requiredCount(group: SheetModifierGroup): number {
  return group.isRequired ? group.minSelections : 0;
}

export function ModifierSheet({ product, currencySymbol, onAdd, onClose }: ModifierSheetProps) {
  const groups = product.modifierGroups || [];
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  const money = (value: number) => `${currencySymbol}${value.toFixed(2)}`;

  const toggleModifier = (group: SheetModifierGroup, modifier: SheetModifier) => {
    setSelected((prev) => {
      const current = prev[group.id] || [];

      if (current.includes(modifier.id)) {
        return { ...prev, [group.id]: current.filter((id) => id !== modifier.id) };
      }

      if (isExclusive(modifier) || group.maxSelections === 1) {
        return { ...prev, [group.id]: [modifier.id] };
      }

      // Picking a real option clears any "No ..." choice in the same group
      const withoutExclusive = current.filter((id) => {
        const existing = group.modifiers.find((m) => m.id === id);
        return existing ? !isExclusive(existing) : true;
      });

      if (withoutExclusive.length >= group.maxSelections) return prev;

      return { ...prev, [group.id]: [...withoutExclusive, modifier.id] };
    });
  };

  const chosenModifiers = useMemo<SheetModifier[]>(
    () =>
      groups.flatMap((group) =>
        (selected[group.id] || [])
          .map((id) => group.modifiers.find((m) => m.id === id))
          .filter((m): m is SheetModifier => Boolean(m))
      ),
    [groups, selected]
  );

  const unmetGroups = groups.filter(
    (group) => (selected[group.id] || []).length < requiredCount(group)
  );

  const unitPrice = product.price + chosenModifiers.reduce((sum, m) => sum + m.price, 0);
  const lineTotal = unitPrice * quantity;

  // Staff can always push the order through; the button just stops pretending
  // nothing is missing.
  const addLabel =
    unmetGroups.length === 0
      ? 'Add to order'
      : `Add without ${unmetGroups.map((g) => g.name.trim()).join(', ')}`;

  const handleAdd = () => {
    onAdd(product, quantity, chosenModifiers, notes.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-gray-900">{product.name}</h2>
            {product.description && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{product.description}</p>
            )}
            <p className="mt-1 text-lg font-bold text-primary-600">{money(unitPrice)}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="pos-btn h-12 w-12 shrink-0 bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Groups */}
        <div className="touch-scroll flex-1 px-6 py-2">
          {groups.map((group) => {
            const chosen = selected[group.id] || [];
            const min = requiredCount(group);
            const isUnmet = chosen.length < min;
            const atMax = chosen.length >= group.maxSelections;

            const instruction =
              min > 0
                ? group.maxSelections > min
                  ? `Pick at least ${min} — up to ${group.maxSelections}`
                  : `Pick ${min}`
                : group.maxSelections > 1
                  ? `Optional — up to ${group.maxSelections}`
                  : 'Optional';

            return (
              <section key={group.id} className="py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-900">{group.name.trim()}</h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                      min > 0
                        ? isUnmet
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {min > 0 ? (isUnmet ? 'Required' : 'Done') : 'Optional'}
                  </span>
                </div>

                <p className="mt-1 text-xs font-medium text-gray-500">
                  {instruction}
                  {chosen.length > 0 && ` · ${chosen.length} chosen`}
                  {atMax && group.maxSelections > 1 && ' · remove one to swap'}
                </p>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {group.modifiers.map((modifier) => {
                    const isSelected = chosen.includes(modifier.id);
                    const blocked = !isSelected && atMax && group.maxSelections > 1;

                    return (
                      <button
                        key={modifier.id}
                        onClick={() => toggleModifier(group, modifier)}
                        disabled={blocked}
                        aria-pressed={isSelected}
                        className={`pos-btn min-h-[64px] justify-between gap-2 border-2 px-3 text-left ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : blocked
                              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-400'
                              : 'border-gray-300 bg-white text-gray-800'
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center border-2 ${
                              group.maxSelections === 1 ? 'rounded-full' : 'rounded-md'
                            } ${
                              isSelected ? 'border-primary-600 bg-primary-500' : 'border-gray-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                          </span>
                          <span className="truncate text-sm font-semibold leading-tight">
                            {modifier.name}
                          </span>
                        </span>
                        {modifier.price > 0 && (
                          <span className="shrink-0 text-xs font-bold">+{money(modifier.price)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {/* Special instructions, so the sheet fully replaces a trip to the cart editor */}
          <div className="py-4">
            <label className="mb-2 block text-sm font-bold text-gray-700">
              Special instructions
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. no onion, extra crispy"
              rows={2}
              className="w-full resize-none rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
          {unmetGroups.length > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                No {unmetGroups.map((g) => g.name.trim()).join(' or ')} chosen — add anyway if that
                is what the customer wants.
              </span>
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-xl border-2 border-gray-300 bg-white p-1">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="pos-btn h-14 w-14 text-gray-700 disabled:opacity-30"
              >
                <Minus className="h-6 w-6" strokeWidth={3} />
              </button>
              <span className="w-10 text-center text-xl font-bold" aria-live="polite">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                aria-label="Increase quantity"
                className="pos-btn h-14 w-14 text-gray-700"
              >
                <Plus className="h-6 w-6" strokeWidth={3} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              className={`flex-1 justify-between px-6 text-base ${
                unmetGroups.length > 0
                  ? 'pos-btn border-2 border-red-300 bg-red-100 font-bold text-red-800'
                  : 'pos-btn-success'
              }`}
            >
              <span>{addLabel}</span>
              <span>{money(lineTotal)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
