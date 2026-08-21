'use client';

import { useActionState, useState } from 'react';
import { saveSupportContentAction, type AdminActionState } from '@/app/admin/actions';
import type { SupportContent, FaqEntry } from '@/lib/faq';

const INITIAL: AdminActionState = { error: null };

const input =
  'w-full border border-cream-200 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none';

let nextRowId = 0;

export function SupportContentForm({ content }: { content: SupportContent }) {
  const [state, action, pending] = useActionState(saveSupportContentAction, INITIAL);
  const [rows, setRows] = useState(() => content.faqs.map((f) => ({ rowId: nextRowId++, faq: f })));

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="title">عنوان ویجت پشتیبانی</label>
        <input id="title" name="title" defaultValue={content.title} required className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="description">توضیح کوتاه</label>
        <input id="description" name="description" defaultValue={content.description} className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="greeting">پیام خوش‌آمدگویی</label>
        <textarea id="greeting" name="greeting" rows={2} defaultValue={content.greeting} required className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="fallback">پیام زمانی که پاسخی پیدا نشود</label>
        <textarea id="fallback" name="fallback" rows={2} defaultValue={content.fallback} required className={input} />
      </div>

      <div className="border-t border-cream-200 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">پرسش‌های متداول</p>
          <button
            type="button"
            onClick={() => setRows((r) => [...r, { rowId: nextRowId++, faq: { id: '', question: '', keywords: [], answer: '' } }])}
            className="text-xs text-ink-60 underline hover:text-ink"
          >
            + افزودن پرسش
          </button>
        </div>

        <div className="mt-4 space-y-6">
          {rows.map((row, i) => (
            <FaqRow
              key={row.rowId}
              faq={row.faq}
              onRemove={rows.length > 1 ? () => setRows((r) => r.filter((x) => x.rowId !== row.rowId)) : undefined}
            />
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink py-4 text-sm text-cream hover:bg-sand-dark disabled:opacity-50"
      >
        {pending ? 'در حال ذخیره…' : 'ذخیره محتوای پشتیبانی'}
      </button>

      {state.error && <p role="alert" className="text-xs text-clay">{state.error}</p>}
      {state.ok && <p role="status" className="text-xs text-ink">ذخیره شد.</p>}
    </form>
  );
}

function FaqRow({ faq, onRemove }: { faq: FaqEntry; onRemove?: () => void }) {
  return (
    <div className="space-y-2 border border-cream-200 p-4">
      <div className="flex items-center justify-between">
        <label className="text-xs text-ink-60">پرسش</label>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-clay hover:underline">
            حذف
          </button>
        )}
      </div>
      <input name="faqQuestion" defaultValue={faq.question} placeholder="مثلاً: ارسال چقدر طول می‌کشد؟" className={input} />
      <label className="mb-1 block text-xs text-ink-60">کلمات کلیدی (با ویرگول جدا کنید)</label>
      <input name="faqKeywords" defaultValue={faq.keywords.join('، ')} dir="rtl" className={input} />
      <label className="mb-1 block text-xs text-ink-60">پاسخ</label>
      <textarea name="faqAnswer" rows={3} defaultValue={faq.answer} className={input} />
    </div>
  );
}
