// Persian/Arabic text normalization for search. Populates
// products.normalized_search_text, which both the tsvector column and the
// pg_trgm index are built over — plain tsvector alone under-serves Persian
// morphology (Arabic-style ي/ك variants, half-space compounds, mixed digits),
// and this same function must run on a user's query at search time so the
// two sides compare on equal footing.
const ARABIC_TO_PERSIAN: Record<string, string> = {
  'ي': 'ی', // ي -> ی
  'ك': 'ک', // ك -> ک
  'ة': 'ه', // ة -> ه
  'ى': 'ی', // ى -> ی
};

const PERSIAN_DIGITS: Record<string, string> = {
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

const DIGIT_MAP: Record<string, string> = { ...PERSIAN_DIGITS, ...ARABIC_DIGITS };

// U+200C ZERO WIDTH NON-JOINER — the "half-space" used in compounds like
// می‌خواهم. Collapsed to a plain space so "می خواهم" and "می‌خواهم" match
// the same way.
const HALF_SPACE = '‌';

// Arabic/Persian diacritics (tashkeel/harakat) — stripped entirely, they
// carry no distinguishing weight for storefront search.
const DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;

export function normalizePersian(input: string): string {
  let text = input;

  for (const [from, to] of Object.entries(ARABIC_TO_PERSIAN)) {
    text = text.split(from).join(to);
  }
  for (const [from, to] of Object.entries(DIGIT_MAP)) {
    text = text.split(from).join(to);
  }

  text = text.replace(DIACRITICS, '');
  text = text.split(HALF_SPACE).join(' ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.toLowerCase();

  return text;
}
