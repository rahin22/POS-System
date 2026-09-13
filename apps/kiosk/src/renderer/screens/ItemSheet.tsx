import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import type { CartLine, Modifier, ModifierGroup, Product } from '../types';
import { displayName, money } from '../lib/format';
import { MAX_LINE_QUANTITY } from '../lib/limits';
import { normaliseGroups } from '../lib/modifiers';

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

/**
 * How many options a group genuinely demands before the order can proceed.
 *
 * The expression below does TWO different jobs, and they should not be confused
 * when someone next tidies this:
 *
 * 1. Math.max(1, minSelections) is SEMANTIC, and it is a deliberate fork from the
 *    POS, which reads the same field and trusts minSelections as written.
 *
 *    Salad is flagged isRequired with minSelections 0 and sits on 52 products.
 *    The shop owner was shown both readings for that field and chose that the POS
 *    must NOT prompt: staff can read a customer, and a prompt on every kebab slows
 *    the counter. The kiosk has nobody to ask, the group carries an explicit
 *    "No Salad" option, and an unanswered salad question becomes a guess in the
 *    kitchen - so here it asks.
 *
 *    Do not "fix" this by setting minSelections to 1 in the POS to make the two
 *    surfaces agree. That reverses a decision the owner made about their own
 *    counter workflow in order to tidy a fork.
 *
 *    Known cost, accepted: the two surfaces can drift, and this comment is the
 *    only thing preventing it. The real fix is a field that can express "optional
 *    but prompt anyway", which the data model has no way to say today. Until that
 *    exists, this fork is the honest encoding of two different rooms.
 *
 * 2. Math.min(..., modifiers.length) is DEFENSIVE, and carries no intent. A
 *    required min of 3 on a group with 2 options is otherwise permanently unmet
 *    and the item can never be added.
 */
function requiredCount(group: ModifierGroup): number {
  if (!group.isRequired) return 0;
  return Math.min(Math.max(1, group.minSelections), group.modifiers.length);
}

export function ItemSheet({
  product,
  currencySymbol,
  editingLine,
  onAdd,
  onUpdate,
  onClose,
}: ItemSheetProps) {
  // See normaliseGroups: drops groups no customer could satisfy, so everything
  // below can assume at least one modifier and a sane ceiling.
  const groups = useMemo(() => normaliseGroups(product), [product]);

  const [quantity, setQuantity] = useState(editingLine?.quantity ?? 1);
  const [imageFailed, setImageFailed] = useState(false);
  /** The group the customer was just sent to, flashed so the jump explains itself */
  const [flaggedGroupId, setFlaggedGroupId] = useState<string | null>(null);
  /** Set when a tap was refused for hitting the group's ceiling */
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const flagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flagTimer.current) clearTimeout(flagTimer.current);
      if (limitTimer.current) clearTimeout(limitTimer.current);
    },
    []
  );
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

  const flashLimit = (group: ModifierGroup) => {
    // No group name interpolated: "That's 3 sauce already" is what that produced
    // against the real data, and this is customer-facing text at the exact moment
    // a control has just refused them.
    setLimitNotice(`That's ${group.maxSelections} already — tap one you've chosen to swap it out.`);
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = setTimeout(() => setLimitNotice(null), 2600);
  };

  /**
   * The decision lives in the handler, not inside the setSelected updater.
   *
   * Updaters must be pure: React may run one more than once per dispatch, and
   * StrictMode does so by contract, so flashing the refusal from inside it could
   * fire at a moment the customer did not tap anything.
   */
  const toggleModifier = (group: ModifierGroup, modifier: Modifier) => {
    const current = selected[group.id] || [];
    const alreadyOn = current.includes(modifier.id);
    const isSwapFree = alreadyOn || isExclusive(modifier) || group.maxSelections === 1;

    if (!isSwapFree) {
      const withoutExclusive = current.filter((id) => {
        const existing = group.modifiers.find((m) => m.id === id);
        return existing ? !isExclusive(existing) : true;
      });

      if (withoutExclusive.length >= group.maxSelections) {
        // Refusing in silence is the sold-out-card mistake again: "nothing
        // happened" reads as broken and the next move is to tap harder.
        flashLimit(group);
        return;
      }
    }

    setSelected((prev) => {
      const prevCurrent = prev[group.id] || [];

      if (prevCurrent.includes(modifier.id)) {
        return { ...prev, [group.id]: prevCurrent.filter((id) => id !== modifier.id) };
      }

      if (isExclusive(modifier) || group.maxSelections === 1) {
        return { ...prev, [group.id]: [modifier.id] };
      }

      // Picking a real option clears any "No ..." choice in the same group
      const withoutExclusive = prevCurrent.filter((id) => {
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
  // Staff-uploaded URLs: a dead link must not leave a broken-image icon in a
  // 340px header block, the way it did before ProductCard's guard was copied here.
  const image = imageFailed ? undefined : product.imageUrl || product.image;

  /**
   * Scoped to this sheet rather than document.getElementById: the ids are derived
   * from modifier-group ids, which also appear on the cart's edit sheet, so a
   * document-wide lookup can resolve to another instance's node.
   */
  const jumpToGroup = (groupId: string) => {
    const container = scrollRef.current;
    const section = container?.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);
    if (!container || !section) return;

    container.scrollTo({
      top: container.scrollTop + section.getBoundingClientRect().top - container.getBoundingClientRect().top - 16,
      behavior: 'smooth',
    });

    // Scrolling alone does not say WHY you were moved; the group flashes so the
    // customer connects "Next: choose Sauce" with the thing now in front of them.
    setFlaggedGroupId(groupId);
    if (flagTimer.current) clearTimeout(flagTimer.current);
    flagTimer.current = setTimeout(() => setFlaggedGroupId(null), 1600);
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
      <div className="animate-fade-up relative flex h-[95%] flex-col overflow-hidden rounded-t-[2.5rem] bg-cream-100">
        {/* Title bar; only carries a photo when the product actually has one */}
        <div className="shrink-0 border-b border-cream-400 bg-cream-50">
          {image && (
            <div className="h-[340px] w-full overflow-hidden bg-cream-200">
              <img
                src={image}
                alt=""
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
              />
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-12 pb-10">
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
              <section
                key={group.id}
                data-group-id={group.id}
                className={`-mx-5 rounded-kiosk px-5 pb-6 pt-8 transition-colors duration-300 ${
                  flaggedGroupId === group.id ? 'bg-brand-100' : ''
                }`}
              >
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
                </p>


                {/* Always two-up: a single long option name must not double the
                    scroll for the whole group. Labels wrap instead. */}
                <div className="mt-5 grid grid-cols-2 gap-4">
                  {group.modifiers.map((modifier) => {
                    const isSelected = chosen.includes(modifier.id);
                    /*
                     * Exclusive options ("No Salad") are handled before the max
                     * check in toggleModifier, so they still work at the ceiling.
                     * Greying the one option that functions, alongside identical
                     * ones that do not, inverts the signal.
                     */
                    const blocked =
                      !isSelected && atMax && group.maxSelections > 1 && !isExclusive(modifier);

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
                          {/*
                            !== 0, not > 0. A negative modifier price is applied to
                            unitPrice and charged either way, so hiding it let the
                            option on screen disagree with the amount taken.
                          */}
                          {modifier.price !== 0 && (
                            <span
                              className={`text-kiosk-base font-extrabold ${
                                modifier.price > 0 ? 'text-brand-800' : 'text-success'
                              }`}
                            >
                              {modifier.price > 0 ? '+' : '−'}
                              {money(Math.abs(modifier.price), currencySymbol)}
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

        {/*
          Floats over the sheet rather than sitting in the flow.
          Inserted above the grid it pushed the option rows ~78px down — most of a
          96px row — under the finger of the one customer most likely to tap again
          immediately. That second tap could land on an existing selection and
          silently deselect it, changing the price, while the message telling them
          to swap was still on screen. The fix must not move the targets.
        */}
        {limitNotice && (
          <div className="pointer-events-none absolute inset-x-12 bottom-[176px] z-10 flex justify-center">
            <p className="animate-scale-in rounded-full bg-ink-900 px-10 py-5 text-kiosk-xs font-extrabold text-white shadow-lifted">
              {limitNotice}
            </p>
          </div>
        )}

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
                onClick={() => setQuantity((q) => Math.min(MAX_LINE_QUANTITY, q + 1))}
                disabled={quantity >= MAX_LINE_QUANTITY}
                aria-label="Increase quantity"
                className="touchable focus-ring flex h-[88px] w-[88px] items-center justify-center rounded-2xl text-ink-800 hover:bg-cream-200 disabled:opacity-30"
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
