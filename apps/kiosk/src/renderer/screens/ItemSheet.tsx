import { useMemo, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import type { CartLine, Modifier, ModifierGroup, Product } from '../types';
import { displayName, money } from '../lib/format';

interface ItemSheetProps {
  product: Product;
  currencySymbol: string;
  /** Set when reopened from the cart to change an existing line */
  editingLine?: CartLine | null;
  onAdd: (product: Product, quantity: number, modifiers: Modifier[]) => void;
  onUpdate?: (lineId: string, quantity: number, modifiers: Modifier[]) => void;
  onClose: () => void;
}

/** "No Sauce" style options clear the rest of their group rather than stacking */
function isExclusive(modifier: Modifier): boolean {
  return /^(no|none|plain)\b/i.test(modifier.name.trim());
}

/** A group only blocks the order when it is genuinely marked required */
function requiredCount(group: ModifierGroup): number {
  return group.isRequired ? Math.max(1, group.minSelections) : 0;
}

export function ItemSheet({
  product,
  currencySymbol,
  editingLine,
  onAdd,
  onUpdate,
  onClose,
}: ItemSheetProps) {
  const groups = product.modifierGroups || [];
  const [quantity, setQuantity] = useState(editingLine?.quantity ?? 1);
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    if (!editingLine) return {};
    const initial: Record<string, string[]> = {};
    groups.forEach((group) => {
      initial[group.id] = group.modifiers
        .filter((modifier) => editingLine.modifiers.some((m) => m.id === modifier.id))
        .map((modifier) => modifier.id);
    });
    return initial;
  });

  const toggleModifier = (group: ModifierGroup, modifier: Modifier) => {
    setSelected((prev) => {
      const current = prev[group.id] || [];
      const alreadyOn = current.includes(modifier.id);

      if (alreadyOn) {
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

  const chosenModifiers = useMemo<Modifier[]>(
    () =>
      groups.flatMap((group) =>
        (selected[group.id] || [])
          .map((id) => group.modifiers.find((modifier) => modifier.id === id))
          .filter((modifier): modifier is Modifier => Boolean(modifier))
      ),
    [groups, selected]
  );

  const unmetGroups = groups.filter(
    (group) => (selected[group.id] || []).length < requiredCount(group)
  );
  const nextUnmet = unmetGroups[0];

  const requiredGroups = groups.filter((group) => requiredCount(group) > 0);
  const completedRequired = requiredGroups.length - unmetGroups.length;

  const unitPrice = product.price + chosenModifiers.reduce((sum, modifier) => sum + modifier.price, 0);
  const lineTotal = unitPrice * quantity;
  const image = product.imageUrl || product.image;

  const jumpToGroup = (groupId: string) => {
    document.getElementById(`group-${groupId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePrimary = () => {
    if (nextUnmet) {
      jumpToGroup(nextUnmet.id);
      return;
    }
    if (editingLine && onUpdate) {
      onUpdate(editingLine.lineId, quantity, chosenModifiers);
    } else {
      onAdd(product, quantity, chosenModifiers);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink-900/60">
      <div className="animate-fade-up flex h-[95%] flex-col overflow-hidden rounded-t-[2.5rem] bg-cream-100">
        {/* Title bar; only carries a photo when the product actually has one */}
        <div className="shrink-0 border-b border-cream-400 bg-cream-50">
          {image && (
            <div className="h-[340px] w-full overflow-hidden">
              <img src={image} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="flex items-start justify-between gap-6 px-12 py-6">
            <div>
              <h2 className="text-kiosk-xl font-extrabold text-ink-900">
                {displayName(product.name)}
              </h2>
              {product.description && (
                <p className="mt-2 max-w-[820px] text-kiosk-xs text-ink-600">{product.description}</p>
              )}
              <p className="mt-3 text-kiosk-lg font-extrabold text-brand-800">
                {money(unitPrice, currencySymbol)}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="touchable focus-ring flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full border-2 border-cream-400 bg-white text-ink-700"
            >
              <X className="h-11 w-11" strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>

          {requiredGroups.length > 0 && (
            <div className="flex items-center gap-4 px-12 pb-5">
              <span className="text-kiosk-xs font-bold text-ink-600">
                {completedRequired} of {requiredGroups.length} choices made
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-cream-300">
                <span
                  className="block h-full rounded-full bg-brand-500 transition-all duration-300"
                  style={{ width: `${(completedRequired / requiredGroups.length) * 100}%` }}
                />
              </span>
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex-1 overflow-y-auto px-12 pb-10">
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
              <section key={group.id} id={`group-${group.id}`} className="scroll-mt-4 pt-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="text-kiosk-lg font-extrabold text-ink-900">{group.name}</h3>
                  <span
                    className={`rounded-full px-5 py-2 text-kiosk-xs font-extrabold uppercase tracking-wide ${
                      min > 0
                        ? isUnmet
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-success/10 text-success'
                        : 'bg-cream-300 text-ink-600'
                    }`}
                  >
                    {min > 0 ? (isUnmet ? 'Required' : 'Done') : 'Optional'}
                  </span>
                </div>

                <p className="mt-2 text-kiosk-xs font-semibold text-ink-600">
                  {instruction}
                  {chosen.length > 0 && ` · ${chosen.length} chosen`}
                  {atMax && group.maxSelections > 1 && ' · remove one to swap'}
                </p>

                {/* Always two-up: a single long option name must not double the
                    scroll for the whole group. Labels wrap instead. */}
                <div className="mt-5 grid grid-cols-2 gap-4">
                  {group.modifiers.map((modifier) => {
                    const isSelected = chosen.includes(modifier.id);
                    const blocked = !isSelected && atMax && group.maxSelections > 1;

                    return (
                      <button
                        key={modifier.id}
                        type="button"
                        onClick={() => toggleModifier(group, modifier)}
                        aria-pressed={isSelected}
                        className={`touchable focus-ring flex w-full items-center justify-between gap-5 rounded-kiosk border-2 px-7 text-left ${
                          isSelected
                            ? 'border-brand-500 bg-brand-100'
                            : blocked
                              ? 'border-cream-400 bg-cream-200'
                              : 'border-cream-400 bg-white hover:border-brand-300'
                        }`}
                        style={{ minHeight: '96px' }}
                      >
                        <span className="flex items-center gap-5">
                          <span
                            className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 ${
                              group.maxSelections === 1 ? 'rounded-full' : 'rounded-xl'
                            } ${
                              isSelected
                                ? 'border-brand-600 bg-brand-500'
                                : 'border-cream-400 bg-cream-100'
                            }`}
                          >
                            {isSelected && (
                              <Check className="h-8 w-8 text-ink-900" strokeWidth={3} aria-hidden="true" />
                            )}
                          </span>
                          <span className="text-kiosk-base font-bold leading-tight text-ink-900 line-clamp-2">
                            {modifier.name}
                          </span>
                        </span>

                        <span className="flex items-center gap-4">
                          {modifier.price > 0 && (
                            <span className="text-kiosk-base font-extrabold text-brand-800">
                              +{money(modifier.price, currencySymbol)}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-cream-50 px-12 py-6 shadow-bar">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-kiosk border-2 border-cream-400 bg-white p-2">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="touchable focus-ring flex h-[88px] w-[88px] items-center justify-center rounded-2xl text-ink-800 hover:bg-cream-200 disabled:opacity-30"
              >
                <Minus className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
              </button>
              <span
                className="w-16 text-center text-kiosk-lg font-extrabold text-ink-900"
                aria-live="polite"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                aria-label="Increase quantity"
                className="touchable focus-ring flex h-[88px] w-[88px] items-center justify-center rounded-2xl text-ink-800 hover:bg-cream-200"
              >
                <Plus className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={handlePrimary}
              className={`flex-1 justify-between text-kiosk-base ${
                nextUnmet ? 'btn-secondary border-brand-500 bg-brand-100 text-ink-900' : 'btn-primary'
              }`}
            >
              {nextUnmet ? (
                <>
                  <span>Next: choose {nextUnmet.name}</span>
                  <span aria-hidden="true">→</span>
                </>
              ) : (
                <>
                  <span>{editingLine ? 'Update order' : 'Add to order'}</span>
                  <span>{money(lineTotal, currencySymbol)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
