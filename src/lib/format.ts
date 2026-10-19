const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDp = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** 1420 -> "1,420" */
export const formatInt = (n: number) => int.format(Math.round(n));

/** 5.25 -> "5.3", 12 -> "12" */
export const formatDecimal = (n: number) => oneDp.format(n);

export const plural = (n: number, one: string, many = `${one}s`) => `${formatInt(n)} ${n === 1 ? one : many}`;
