// Money and Persian text formatting.
//
// Rule enforced everywhere: prices are stored and passed around as INTEGER RIAL
// (see lib/commerce/types.ts's Money type). Never floats — 1/10 is not
// representable in binary and Iranian order totals are large enough that float
// drift shows up in real invoices.
// Display is Toman (Rial / 10); Schema.org / analytics use ISO 4217 "IRR" (Rial).

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** 123 -> ۱۲۳ */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

export const rialToToman = (rial: number): number => Math.round(rial / 10);

/** 4_500_000 rial -> "۴۵۰٬۰۰۰ تومان" */
export function formatToman(rial: number, opts: { suffix?: boolean } = {}): string {
  const toman = rialToToman(rial);
  const grouped = toPersianDigits(Math.abs(toman).toLocaleString('en-US')).replace(/,/g, '٬');
  const signed = toman < 0 ? '‏-' + grouped : grouped;
  return opts.suffix === false ? signed : `${signed} تومان`;
}

/** Percent off, floored — never overstate a discount. */
export function discountPercent(regularRial: number, saleRial: number): number {
  if (regularRial <= 0 || saleRial >= regularRial) return 0;
  return Math.floor(((regularRial - saleRial) / regularRial) * 100);
}
