// Local-time date helpers. Days are the user's local calendar days.

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for a local date (matches Postgres `date` columns). */
export const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** The last `n` local days ending today, oldest first. */
export const lastDays = (n: number, today = new Date()) =>
  Array.from({ length: n }, (_, i) => addDays(startOfDay(today), i - (n - 1)));

/** "Tuesday, Oct 13" */
export const formatHeaderDate = (d: Date) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(d);

export const weekdayName = (d: Date) => new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d);

export const weekdayLetter = (d: Date) => weekdayName(d).charAt(0);
