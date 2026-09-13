import { ChevronLeft, CreditCard, Minus, Pencil, Plus, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react';
import type { CartLine, OrderType, Product } from '../types';
import { displayName, money } from '../lib/format';
import { hasChoosableGroups } from '../lib/modifiers';
import { MAX_LINE_QUANTITY } from '../lib/limits';

interface CartScreenProps {
  lines: CartLine[];
  currencySymbol: string;
  orderType: OrderType;
  tax: number;
  total: number;
  suggestions: Product[];
  onSetQuantity: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onEdit: (line: CartLine) => void;
  onQuickAdd: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
  onAddMore: () => void;
  onPay: () => void;
  onCancelOrder: () => void;
  /** False in a takeaway-only shop: the chip must not be a way back in */
  canChangeOrderType: boolean;
  onChangeOrderType: () => void;
}

export function CartScreen({
  lines,
  currencySymbol,
  orderType,
  tax,
  total,
  suggestions,
  onSetQuantity,
  onRemove,
  onEdit,
  onQuickAdd,
  onSelectProduct,
  onAddMore,
  onPay,
  onCancelOrder,
  canChangeOrderType,
  onChangeOrderType,
}: CartScreenProps) {
  return (
    <div className="flex h-full flex-col bg-cream-100">
      <header className="flex shrink-0 items-center justify-between gap-4 bg-cream-50 px-12 py-6 shadow-card">
        <button type="button" onClick={onAddMore} className="btn-quiet text-kiosk-xs">
          <ChevronLeft className="h-9 w-9" aria-hidden="true" />
          Back to menu
        </button>

        <h1 className="text-kiosk-lg font-extrabold text-ink-900">Your order</h1>

        <button type="button" onClick={onCancelOrder} className="btn-quiet text-kiosk-xs text-danger">
          Cancel
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-12 py-8">
        {canChangeOrderType ? (
          <button
            type="button"
            onClick={onChangeOrderType}
            className="touchable focus-ring mb-7 flex items-center gap-4 rounded-full border-2 border-cream-400 bg-white px-7 py-4"
          >
            {orderType === 'dine-in' ? (
              <UtensilsCrossed className="h-8 w-8 text-brand-700" aria-hidden="true" />
            ) : (
              <ShoppingBag className="h-8 w-8 text-brand-700" aria-hidden="true" />
            )}
            <span className="text-kiosk-xs font-bold text-ink-800">
              {orderType === 'dine-in' ? 'Eat In' : 'Take Away'}
            </span>
            <span className="text-kiosk-xs font-bold text-brand-700">Change</span>
          </button>
        ) : (
          <span className="mb-7 flex items-center gap-4 rounded-full border-2 border-cream-400 bg-cream-200 px-7 py-4">
            {orderType === 'dine-in' ? (
              <UtensilsCrossed className="h-8 w-8 text-ink-600" aria-hidden="true" />
            ) : (
              <ShoppingBag className="h-8 w-8 text-ink-600" aria-hidden="true" />
            )}
            <span className="text-kiosk-xs font-bold text-ink-800">
              {orderType === 'dine-in' ? 'Eat In' : 'Take Away'}
            </span>
          </span>
        )}

        {/*
          Reachable by removing the last line from here: the order bar that opens
          this screen only appears once something is in the basket, but nothing
          stops the customer emptying it once they arrive. Without this they were
          left staring at a blank panel with a dead Pay button.
        */}
        {lines.length === 0 && (
          <div className="flex flex-col items-center gap-7 py-24 text-center">
            <ShoppingBag className="h-24 w-24 text-ink-400" aria-hidden="true" />
            <p className="text-kiosk-lg font-extrabold text-ink-900">Your order is empty</p>
            <p className="max-w-[720px] text-kiosk-base text-ink-700">
              Add something from the menu to get started.
            </p>
            <button type="button" onClick={onAddMore} className="btn-primary mt-2 px-14 text-kiosk-base">
              <Plus className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
              Back to the menu
            </button>
          </div>
        )}

        <ul className="space-y-6">
          {lines.map((line) => (
            <li key={line.lineId} className="card animate-fade-up p-7">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <h2 className="text-kiosk-base font-extrabold text-ink-900">
                    {displayName(line.product.name)}
                  </h2>

                  {line.modifiers.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {line.modifiers.map((modifier) => (
                        <li key={modifier.id} className="text-kiosk-xs text-ink-700">
                          + {modifier.name}
                          {/* !== 0, not > 0: a negative modifier price is charged
                              either way, so hiding it let the line disagree with
                              the total. Same fix as ItemSheet. */}
                          {modifier.price !== 0 &&
                            ` (${modifier.price > 0 ? '' : '−'}${money(
                              Math.abs(modifier.price),
                              currencySymbol
                            )})`}
                        </li>
                      ))}
                    </ul>
                  )}

                  {line.quantity > 1 && (
                    <p className="mt-3 text-kiosk-xs text-ink-600">
                      {money(line.unitPrice, currencySymbol)} each
                    </p>
                  )}
                </div>

                <span className="text-kiosk-lg font-extrabold text-brand-800">
                  {money(line.unitPrice * line.quantity, currencySymbol)}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-2xl border-2 border-cream-400 bg-white p-1.5">
                  <button
                    type="button"
                    onClick={() => onSetQuantity(line.lineId, line.quantity - 1)}
                    disabled={line.quantity <= 1}
                    aria-label={`Decrease quantity of ${line.product.name}`}
                    className="touchable focus-ring flex h-[72px] w-[72px] items-center justify-center rounded-xl text-ink-800 hover:bg-cream-200 disabled:opacity-30"
                  >
                    <Minus className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
                  </button>
                  <span className="w-14 text-center text-kiosk-base font-extrabold text-ink-900">
                    {line.quantity}
                  </span>
                  {/* Capped to the same ceiling the item sheet enforces: this
                      button had none, so a line could be pushed past a limit the
                      sheet had just applied to the same item. */}
                  <button
                    type="button"
                    onClick={() =>
                      onSetQuantity(line.lineId, Math.min(MAX_LINE_QUANTITY, line.quantity + 1))
                    }
                    disabled={line.quantity >= MAX_LINE_QUANTITY}
                    aria-label={`Increase quantity of ${line.product.name}`}
                    className="touchable focus-ring flex h-[72px] w-[72px] items-center justify-center rounded-xl text-ink-800 hover:bg-cream-200 disabled:opacity-30"
                  >
                    <Plus className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  {hasChoosableGroups(line.product) && (
                    <button
                      type="button"
                      onClick={() => onEdit(line)}
                      className="touchable focus-ring flex items-center gap-3 rounded-2xl border-2 border-cream-400 bg-white px-6 py-4 text-ink-800"
                    >
                      <Pencil className="h-7 w-7" aria-hidden="true" />
                      <span className="text-kiosk-xs font-bold">Edit</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onRemove(line.lineId)}
                    className="touchable focus-ring flex items-center gap-3 rounded-2xl border-2 border-danger/30 bg-white px-6 py-4 text-danger"
                  >
                    <Trash2 className="h-7 w-7" aria-hidden="true" />
                    <span className="text-kiosk-xs font-bold">Remove</span>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {/* Not on an empty cart: "Your order is empty" and "Anything else?" on the
            same screen is the kind of contradiction customers read twice. */}
        {lines.length > 0 && suggestions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-kiosk-base font-extrabold text-ink-900">Anything else?</h2>
            <div className="mt-6 grid grid-cols-3 gap-6">
              {suggestions.map((product) => {
                const hasOptions = hasChoosableGroups(product);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => (hasOptions ? onSelectProduct(product) : onQuickAdd(product))}
                    className="touchable focus-ring flex min-h-[220px] flex-col items-center justify-between gap-5 rounded-kiosk bg-white p-7 text-center shadow-card hover:ring-4 hover:ring-brand-500"
                  >
                    <span className="text-kiosk-base font-extrabold leading-tight text-ink-900 line-clamp-2">
                      {displayName(product.name)}
                    </span>
                    <span className="flex items-center gap-4">
                      <span className="text-kiosk-base font-extrabold text-brand-800">
                        {money(product.price, currencySymbol)}
                      </span>
                      <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-brand-500 text-ink-900">
                        <Plus className="h-10 w-10" strokeWidth={3} aria-hidden="true" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {lines.length > 0 && (
          <button type="button" onClick={onAddMore} className="btn-secondary mt-8 w-full text-kiosk-base">
            <Plus className="h-9 w-9" strokeWidth={3} aria-hidden="true" />
            Add more items
          </button>
        )}
      </div>

      {/* The whole footer goes with the items. Leaving it up on an empty cart put a
          120px grey "Pay $0.00" bar — the largest element on the screen — directly
          under the "Your order is empty" panel that exists to replace it. */}
      {lines.length > 0 && (
        <footer className="shrink-0 bg-cream-50 px-12 py-7 shadow-bar">
          {/* Menu prices are GST-inclusive, so GST is a component, not an addition.
              The amount itself lives on the Pay button rather than being stated twice. */}
          <p className="text-center text-kiosk-xs text-ink-600">
            Total {money(total, currencySymbol)} &middot; includes GST {money(tax, currencySymbol)}
          </p>

          <button
            type="button"
            onClick={onPay}
            className="btn-primary mt-6 w-full justify-center gap-5 text-kiosk-lg"
            style={{ minHeight: '120px' }}
          >
            <CreditCard className="h-11 w-11" aria-hidden="true" />
            Pay {money(total, currencySymbol)}
          </button>
        </footer>
      )}
    </div>
  );
}
