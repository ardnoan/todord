/**
 * Formats a Date object as YYYY-MM-DD in the user's local timezone.
 * Avoids UTC midnight shift (e.g. 00:00–06:59 WIB appearing as yesterday in UTC).
 */
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date as YYYY-MM-DD in the user's local timezone.
 */
export function getLocalDateString(now: Date = new Date()): string {
  return formatLocalDateString(now);
}
