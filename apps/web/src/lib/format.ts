// Money and Persian text formatting.
//
// Rule enforced everywhere: prices are stored and passed around as INTEGER RIAL.
// Never floats — 1/10 is not representable in binary and Iranian order totals are
// large enough that float drift shows up in real invoices.
// Display is Toman (Rial / 10); Schema.org / analytics use ISO 4217 "IRR" (Rial).

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** ۱۲۳ / ١٢٣ -> 123. Also normalizes the Arabic decimal separator. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const fa = FA_DIGITS.indexOf(ch);
    if (fa >= 0) {
      out += fa;
      continue;
    }
    const ar = AR_DIGITS.indexOf(ch);
    if (ar >= 0) {
      out += ar;
      continue;
    }
    out += ch === '٫' ? '.' : ch === '٬' ? ',' : ch;
  }
  return out;
}

/** 123 -> ۱۲۳ */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/**
 * Normalizes Persian text for search/slug comparison: Arabic ك/ي -> Persian ک/ی,
 * strips ZWNJ and diacritics, collapses whitespace.
 * ZWNJ matters: "می‌روم" and "میروم" must match the same product.
 */
export function normalizePersian(input: string): string {
  return normalizeDigits(input)
    .replace(/‌/g, '') // ZWNJ
    .replace(/[ً-ٰٟ]/g, '') // harakat
    .replace(/ك/g, 'ک') // ك -> ک
    .replace(/[يى]/g, 'ی') // ي/ى -> ی
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** URL slug from a Persian title. Keeps Persian letters, hyphenates the rest. */
export function slugifyPersian(input: string): string {
  return normalizePersian(input)
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export const rialToToman = (rial: number): number => Math.round(rial / 10);

/** 4_500_000 rial -> "۴۵۰٬۰۰۰ تومان" */
export function formatToman(rial: number, opts: { suffix?: boolean } = {}): string {
  const toman = rialToToman(rial);
  const grouped = toPersianDigits(Math.abs(toman).toLocaleString('en-US')).replace(/,/g, '٬');
  const signed = toman < 0 ? '‏-' + grouped : grouped;
  return opts.suffix === false ? signed : `${signed} تومان`;
}

/**
 * WooCommerce Store API returns prices as integer strings scaled by
 * `currency_minor_unit`: the real amount is Number(price) / 10**minor_unit,
 * denominated in `currency_code`. Iranian Woo stores are configured as either
 * IRR (Rial) or IRT (Toman) — we convert both to integer Rial, our canonical unit.
 */
export function wooPriceToRial(price: string, minorUnit: number, currency = 'IRT'): number {
  const n = Number(price);
  if (!Number.isFinite(n)) return 0;
  const amount = n / 10 ** minorUnit;
  return Math.round(currency === 'IRR' ? amount : amount * 10);
}

/** Percent off, floored — never overstate a discount. */
export function discountPercent(regularRial: number, saleRial: number): number {
  if (regularRial <= 0 || saleRial >= regularRial) return 0;
  return Math.floor(((regularRial - saleRial) / regularRial) * 100);
}

const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/** Jalali date via Intl (ICU ships the persian calendar) -> "۱۵ مرداد ۱۴۰۴". */
export function formatJalali(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const month = JALALI_MONTHS[get('month') - 1] ?? '';
  return `${toPersianDigits(get('day'))} ${month} ${toPersianDigits(get('year'))}`;
}
