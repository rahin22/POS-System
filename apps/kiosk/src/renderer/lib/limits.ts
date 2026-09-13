/**
 * Ceiling on a single cart line.
 *
 * Shared so the item sheet and the cart cannot disagree: the sheet capped at 20
 * while the cart's + button had no ceiling at all, so the same line could be
 * pushed past a limit the sheet had just enforced.
 *
 * 20 of one item is already well past anything a walk-up customer orders, and a
 * kiosk has no way to sanity-check a party order the way a person at the counter
 * would. Anything larger belongs at the counter.
 */
export const MAX_LINE_QUANTITY = 20;
