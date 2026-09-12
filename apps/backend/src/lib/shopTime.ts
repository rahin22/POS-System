/**
 * Shop-local calendar helpers.
 *
 * The shop trades past midnight, so "which day does this order belong to" has to be
 * answered in the shop's own timezone, not the server's (Railway runs in UTC).
 *
 * Offsets are read from the IANA database via Intl rather than hardcoded, so the
 * AEST/AEDT changeover is handled automatically. The previous code assumed a fixed
 * UTC+11, which was wrong from April to October and shifted the daily rollover to
 * 23:00 local for half the year.
 */

export const SHOP_TIME_ZONE = 'Australia/Sydney';

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The shop-local wall clock reading at a given instant. */
function wallClockAt(at: Date): WallClock {
  const fields: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(at)) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value);
  }
  return fields as unknown as WallClock;
}

/** How far ahead of UTC the shop's timezone is at `at`, in milliseconds. */
function offsetMsAt(at: Date): number {
  const w = wallClockAt(at);
  const asIfUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  // Both sides are truncated to whole seconds so the difference is a clean offset.
  return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** 'YYYY-MM-DD' for the shop-local calendar day containing `at`. */
export function shopDayKey(at: Date = new Date()): string {
  const w = wallClockAt(at);
  return `${w.year}-${pad(w.month)}-${pad(w.day)}`;
}

/** Shift a 'YYYY-MM-DD' key by whole days. */
export function addDays(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** The UTC instant at which shop-local `dayKey` begins. */
export function shopMidnightUtc(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  // Two passes: the offset that matters is the one in effect at the answer, which is
  // not always the one at the initial guess on the two DST changeover days each year.
  let ts = wallAsUtc - offsetMsAt(new Date(wallAsUtc));
  ts = wallAsUtc - offsetMsAt(new Date(ts));
  return new Date(ts);
}

/**
 * Half-open [start, end) UTC range covering one shop-local day. Half-open rather than
 * an inclusive 23:59:59.999 end so no instant can fall between two consecutive days.
 */
export function shopDayRange(dayKey: string = shopDayKey()): { start: Date; end: Date } {
  return {
    start: shopMidnightUtc(dayKey),
    end: shopMidnightUtc(addDays(dayKey, 1)),
  };
}

/**
 * A small stable integer identifying a shop-local day, for use as a Postgres advisory
 * lock key. Days since the epoch, so it comfortably fits in an int4.
 */
export function shopDayLockId(dayKey: string): number {
  const [y, m, d] = dayKey.split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}
