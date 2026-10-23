/** Formatting helpers shared by the Today, Plan, and Reality Check screens. */

/** "45m", "1h", "2h 10m" - always short enough for a stat tile. */
export function formatMinutes(minutes: number): string {
  const value = Math.max(0, Math.round(minutes));
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Turn a stored due value into a label. Handles the coarse buckets the planner
 * emits ("today", "tomorrow", "next-week") as well as ISO dates from the due
 * picker.
 */
export function formatDueLabel(due: string): string {
  switch (due) {
    case 'today':
      return 'today';
    case 'tomorrow':
      return 'tomorrow';
    case 'next-week':
      return 'next week';
  }

  const parsed = new Date(`${due}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return due;

  const days = Math.round((startOfDay(parsed).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Local-time greeting, so the header is never a hardcoded "Good afternoon". */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function todayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
