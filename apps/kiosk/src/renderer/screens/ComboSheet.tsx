import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import type { ComboOffer } from '../lib/combos';
import { displayName, money } from '../lib/format';

interface ComboSheetProps {
  offers: ComboOffer[];
  currencySymbol: string;
  /** Line ids the customer chose to upgrade */
  onConfirm: (lineIds: string[]) => void;
  onSkip: () => void;
}

/**
 * Offered once, on the way to payment, for any cart line that has a "<item> Combo"
 * sibling on the menu.
 *
 * Nothing is pre-selected. A kiosk upsell that arrives pre-ticked charges people who
 * tapped straight through, which is the kind of thing they notice at the counter and
 * not before.
 */
export function ComboSheet({ offers, currencySymbol, onConfirm, onSkip }: ComboSheetProps) {
  const [chosen, setChosen] = useState<string[]>([]);
  // Staff-uploaded URLs, same guard as every other image surface in the app
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const toggle = (lineId: string) => {
    setChosen((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId]
    );
  };

  const extra = offers
    .filter((offer) => chosen.includes(offer.line.lineId))
    .reduce((sum, offer) => sum + offer.upgradeCost * offer.line.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink-900/60">
      <div className="animate-fade-up flex max-h-[92%] flex-col overflow-hidden rounded-t-[2.5rem] bg-cream-100">
        <div className="shrink-0 border-b border-cream-400 bg-cream-50 px-12 py-8 text-center">
          <h2 className="text-kiosk-xl font-extrabold text-ink-900">Make it a combo?</h2>
          <p className="mt-3 text-kiosk-xs text-ink-600">
            {offers.length === 1
              ? 'Upgrade your item before you pay.'
              : 'Upgrade any of these before you pay.'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-12 py-8">
          <ul className="space-y-6">
            {offers.map((offer) => {
              const isChosen = chosen.includes(offer.line.lineId);
              const image = offer.combo.imageUrl || offer.combo.image;

              return (
                <li key={offer.line.lineId}>
                  <button
                    type="button"
                    onClick={() => toggle(offer.line.lineId)}
                    aria-pressed={isChosen}
                    className={`touchable focus-ring flex w-full items-center gap-7 rounded-kiosk border-2 p-6 text-left ${
                      isChosen
                        ? 'border-brand-500 bg-brand-100'
                        : 'border-cream-400 bg-white hover:border-brand-300'
                    }`}
                  >
                    <span
                      className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ${
                        isChosen ? 'border-brand-600 bg-brand-500' : 'border-cream-400 bg-cream-100'
                      }`}
                    >
                      {isChosen ? (
                        <Check className="h-10 w-10 text-ink-900" strokeWidth={3} aria-hidden="true" />
                      ) : (
                        <Plus className="h-10 w-10 text-ink-600" strokeWidth={3} aria-hidden="true" />
                      )}
                    </span>

                    {image && !failedImages[offer.combo.id] && (
                      <img
                        src={image}
                        alt=""
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [offer.combo.id]: true }))
                        }
                        className="h-32 w-32 shrink-0 rounded-2xl bg-cream-200 object-cover"
                      />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block text-kiosk-base font-extrabold leading-tight text-ink-900">
                        {displayName(offer.combo.name)}
                      </span>
                      <span className="mt-2 block text-kiosk-xs text-ink-600">
                        instead of {displayName(offer.line.product.name)}
                        {offer.line.quantity > 1 && ` · ${offer.line.quantity} of them`}
                      </span>
                    </span>

                    <span className="shrink-0 text-kiosk-lg font-extrabold text-brand-800">
                      +{money(offer.upgradeCost * offer.line.quantity, currencySymbol)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="shrink-0 bg-cream-50 px-12 py-7 shadow-bar">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={onSkip}
              className="btn-secondary flex-1 text-kiosk-base"
            >
              No thanks
            </button>
            <button
              type="button"
              onClick={() => onConfirm(chosen)}
              disabled={chosen.length === 0}
              className="btn-primary flex-[2] justify-between text-kiosk-base"
            >
              <span>Add to my order</span>
              <span>+{money(extra, currencySymbol)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
