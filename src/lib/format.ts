const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** 1420 -> "1,420" */
export const formatInt = (n: number) => int.format(Math.round(n));

const twoDp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

/** 7.25 -> "7.25", 12 -> "12": for typed entries, so the field shows what was entered. */
export const formatDecimal2 = (n: number) => twoDp.format(n);

/** 5.25 -> "5.3", 12 -> "12" */
export const formatDecimal = (n: number) => oneDp.format(n);

export const plural = (n: number, one: string, many = `${one}s`) => `${formatInt(n)} ${n === 1 ? one : many}`;
