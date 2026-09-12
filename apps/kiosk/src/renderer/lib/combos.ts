import type { CartLine, Product } from '../types';

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
  /** Per-item cost of upgrading, which is what the customer is actually deciding on */
  upgradeCost: number;
}

/**
 * Every cart line that could be upgraded. Lines already holding a combo product will
 * not match, because "X Combo Combo" does not exist.
 */
export function findComboOffers(lines: CartLine[], products: Product[]): ComboOffer[] {
  const offers: ComboOffer[] = [];

  for (const line of lines) {
    const combo = findComboVariant(line.product, products);
    if (!combo) continue;

    offers.push({
      line,
      combo,
      upgradeCost: combo.price - line.product.price,
    });
  }

  return offers;
}
