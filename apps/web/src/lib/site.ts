export const site = {
  name: 'REVAYAT',
  nameFa: 'روایت',
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://revayat.shop').replace(/\/+$/, ''),
  tagline: 'روایتی از اسطوره و میراث ایران، بر تن شما',
  description:
    'روایت؛ تی‌شرت‌های الهام‌گرفته از اسطوره‌ها، معماری و میراث ایران. طراحی اختصاصی، پارچه‌ی درجه‌یک، ارسال به سراسر ایران.',
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
