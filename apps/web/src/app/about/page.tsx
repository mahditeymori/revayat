import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'درباره روایت',
  description: site.description,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-medium">درباره روایت</h1>
      <div className="mt-8 space-y-4 text-sm leading-8 text-ink-60">
        <p>
          روایت از یک ایده ساده شروع شد: اسطوره‌ها، معماری و نقش‌های میراث ایران آن‌قدر زنده‌اند که
          جای‌شان فقط موزه نیست.
        </p>
        <p>
          هر طرح روایت از یک داستان می‌آید — از دماوند تا نبرد رستم و گردآفرید — و با طراحی اختصاصی
          روی پارچه‌ی پنبه‌ی درجه‌یک با دوخت اورسایز اجرا می‌شود.
        </p>
        <p>
          ما محدود تولید می‌کنیم تا کیفیت هر دوخت کنترل‌شده بماند. ارسال به سراسر ایران انجام می‌شود.
        </p>
      </div>
    </div>
  );
}
