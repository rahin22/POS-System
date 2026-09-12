/** Words the shop writes in caps that should survive title-casing */
const KEEP_UPPER = new Set(['HSP', 'BBQ', 'XL', 'BLT']);

/**
 * Menu data is typed by staff, so casing is inconsistent ("large chips",
 * "Combo Kebabs"). Normalise for display only — never rewrite the stored name.
 */
export function displayName(name: string): string {
  return name
    .split(' ')
    .map((word) => {
      const bare = word.replace(/[^A-Za-z]/g, '');
      if (KEEP_UPPER.has(bare.toUpperCase()) && bare.length > 1) {
        return word.toUpperCase();
      }
      if (word.length === 0) return word;
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function money(value: number, symbol: string): string {
  return `${symbol}${value.toFixed(2)}`;
}
