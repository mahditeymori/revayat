import { getFaqs } from '@/lib/commerce/support';
import { safe } from '@/lib/safe';

export default async function FaqPage() {
  const faqs = await safe(getFaqs(), []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="wordmark text-2xl text-ink">سوالات متداول</h1>
      <dl className="mt-8 space-y-6">
        {faqs.map((f) => (
          <div key={f.id}>
            <dt className="font-medium text-ink">{f.question}</dt>
            <dd className="mt-2 text-sm leading-7 text-ink-60">{f.answer}</dd>
          </div>
        ))}
        {faqs.length === 0 && <p className="text-sm text-ink-60">سوالی ثبت نشده است.</p>}
      </dl>
    </div>
  );
}
