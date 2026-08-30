import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://revayat.shop'),
  title: {
    default: 'روایت شاپ | Revayat Shop',
    template: '%s | روایت شاپ',
  },
  description: 'روایت شاپ — پوشاک الهام‌گرفته از میراث و طبیعت ایران.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
