import type { StaffAttendanceEntry } from '../api/types';

/** Staff marked present (or late / half day - they are in the building) today. */
export function staffPresentCount(entries: readonly StaffAttendanceEntry[]): number {
  return entries.filter((e) => e.status === 'PRESENT' || e.status === 'LATE' || e.status === 'HALF_DAY').length;
}

/**
 * A rupee amount short enough for a stat tile: ₹0 … ₹99,999 as is (no paise), then ₹1.2L,
 * ₹18.4L, ₹2.3Cr. Negative amounts keep their sign.
 */
export function compactInr(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  const rupees = Math.round(abs);
  const text = String(rupees);
  const lastThree = text.slice(-3);
  const rest = text.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  return `${sign}₹${grouped}`;
}

function trim(n: number): string {
  const one = Math.round(n * 10) / 10;
  return Number.isInteger(one) ? String(one) : one.toFixed(1);
}

/** "Monday, 19 October" in the app language (Hindi gets the Devanagari day and month names). */
export function longDate(date: Date, language: string): string {
  try {
    return date.toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return date.toDateString();
  }
}
