import type { CartLine, Product } from '../types';
import { normaliseGroups } from './modifiers';

/**
 * Combo variants are modelled as separate products named "<item> Combo" rather than
 * as a modifier group, so they are found by name. Matching the exact suffix keeps it
 * predictable: "Chicken Kebab" finds "Chicken Kebab Combo", and nothing else.
 *
 * Renaming a product in the admin panel is therefore all it takes to add or remove an
 * upsell, with no code change.
 */
export function findComboVariant(product: Product, products: Product[]): Product | null {
  const target = `${product.name.trim().toLowerCase()} combo`;

  return (
    products.find(
      (candidate) =>
        candidate.isAvailable &&
        candidate.id !== product.id &&
        candidate.name.trim().toLowerCase() === target
    ) ?? null
  );
}

export interface ComboOffer {
  line: CartLine;
  combo: Product;
  /**
   * PER ITEM, not per line. ComboSheet multiplies by line.quantity for both the
   * row figure and the footer total — removing that multiplication on the belief
   * this were a line total would show +$4.00 and charge +$12.00 on a quantity of 3.
   */
  upgradeCost: number;
}

/** Every modifier id the combo product can legitimately carry */
function modifierIdsOf(product: Product): Set<string> {
  return new Set(
    normaliseGroups(product).flatMap((group) => group.modifiers.map((modifier) => modifier.id))
  );
}

/**
 * Would swapping this line onto the combo silently change what the customer gets?
 *
 * Two ways it can, both invisible at the moment of confirming:
 *
 *  1. The combo does not carry a modifier the customer already chose. The upgrade
 *     drops it, so a kebab ordered with garlic sauce becomes a combo with none.
 *     Do NOT assume the backend would catch this: orders.ts looks modifiers up by
 *     id with no product-membership check, so a foreign id is accepted and priced.
 *  2. The combo carries a REQUIRED group the base did not, which the line has no
 *     selection for. The upgrade then produces a line that skipped a question the
 *     item sheet would have forced, and the kitchen gets an under-specified
 *     docket. "mix kebab" is exactly this shape today: no groups on the base,
 *     three on the combo, one of them a required Sauce.
 *
 * Either way the honest move is not to offer the upgrade. Silently changing an
 * order the customer already assembled is worse than not upselling them.
 */
function isCleanUpgrade(line: CartLine, combo: Product): boolean {
  const comboModifierIds = modifierIdsOf(combo);

  const dropsAChoice = line.modifiers.some((modifier) => !comboModifierIds.has(modifier.id));
  if (dropsAChoice) return false;

  const chosenIds = new Set(line.modifiers.map((modifier) => modifier.id));
  const leavesRequiredUnanswered = normaliseGroups(combo).some(
    (group) =>
      group.isRequired && !group.modifiers.some((modifier) => chosenIds.has(modifier.id))
  );

  return !leavesRequiredUnanswered;
}

/** Price of this line once swapped onto the combo, keeping the same modifiers */
function upgradedUnitPrice(line: CartLine, combo: Product): number {
  return combo.price + line.modifiers.reduce((sum, modifier) => sum + modifier.price, 0);
}

/**
 * Every cart line that can be safely upgraded. Lines already holding a combo
 * product will not match, because "X Combo Combo" does not exist.
 */
export function findComboOffers(lines: CartLine[], products: Product[]): ComboOffer[] {
  const offers: ComboOffer[] = [];

  for (const line of lines) {
    const combo = findComboVariant(line.product, products);
    if (!combo || !isCleanUpgrade(line, combo)) continue;

    // Derived from the line's actual unit price, not the bare product prices, so
    // the number on the button is always the number that hits the card.
    const perItem = upgradedUnitPrice(line, combo) - line.unitPrice;
    if (perItem <= 0) continue; // never present a "saving" as a paid upgrade

    offers.push({ line, combo, upgradeCost: perItem });
  }

  return offers;
}
