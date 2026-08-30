export const site = {
  name: 'REVAYAT',
  // Full Persian brand name for Organization/WebSite schema — the string we
  // want Google to resolve to this site in search ("روایت شاپ").
  nameFa: 'روایت شاپ',
  // Latin transliteration of the brand as a whole ("روایت شاپ" = "Revayat
  // Shop"), distinct from the bare wordmark above — this is the string used
  // as Organization/WebSite alternateName so a "revayat shop" search also
  // resolves to this entity.
  nameEn: 'Revayat Shop',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://revayat.shop').replace(/\/+$/, ''),
  tagline: 'روایتی از اسطوره و میراث ایران، بر تن شما',
  description:
    'روایت شاپ؛ تی‌شرت‌های الهام‌گرفته از اسطوره‌ها، معماری و میراث ایران. طراحی اختصاصی، پارچه‌ی درجه‌یک، ارسال به سراسر ایران.',
  logo: '/logo.jpg',
  locale: 'fa_IR',
  enamadCode: process.env.NEXT_PUBLIC_ENAMAD_CODE ?? '',
  socials: { instagram: 'https://instagram.com/revayat.shop' },
} as const;

export const nav = [
  { href: '/collections', label: 'مجموعه‌ها' },
  { href: '/collections/new', label: 'جدیدترین‌ها' },
  { href: '/collections/sale', label: 'تخفیف‌ها' },
  { href: '/about', label: 'درباره روایت' },
] as const;
