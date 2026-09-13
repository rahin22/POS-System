import type { ModifierGroup, Product } from '../types';

/**
 * Menu data is maintained by shop staff through the POS, which can produce groups
 * no customer is able to satisfy. Each of these would otherwise leave the item
 * sheet reading "Next: choose X" forever with no way to add the item:
 *
 *   - required with an empty modifier list (a group created before its options)
 *   - maxSelections 0 (a field nobody filled in), where every option renders as a
 *     normal tappable button that silently refuses every tap
 *   - minSelections greater than the number of options that exist
 *
 * Normalising here, in one place, is what lets everything downstream assume
 * `modifiers.length >= 1` and a sane ceiling. A group that cannot be satisfied
 * must never be able to block the order.
 */
export function normaliseGroups(product: Product): ModifierGroup[] {
  return (product.modifierGroups || [])
    .filter((group) => (group.modifiers?.length ?? 0) > 0)
    .map((group) => ({
      ...group,
      maxSelections: Math.max(1, group.maxSelections || 1),
    }));
}

/**
 * Whether tapping this product should open the options sheet.
 *
 * Shared with the card grids so they cannot disagree with the sheet: reading the
 * raw groups meant a product whose only group was empty still opened a sheet that
 * then rendered no groups at all and a bare "Add to order".
 */
export function hasChoosableGroups(product: Product): boolean {
  return normaliseGroups(product).length > 0;
}
