'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

/** Two-step confirm — product deletion also removes its uploaded images. */
export function DeleteButton() {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();

  if (!armed) {
    return (
      <button
        type="button"
        onClick={() => setArmed(true)}
        className="border border-clay px-5 py-3 text-xs text-clay hover:bg-clay hover:text-cream"
      >
        حذف محصول
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-xs text-ink-60">این محصول و تصاویرش برای همیشه حذف می‌شوند.</p>
      <button
        type="submit"
        disabled={pending}
        className="bg-clay px-5 py-3 text-xs text-cream disabled:opacity-50"
      >
        {pending ? 'در حال حذف…' : 'حذف قطعی'}
      </button>
      <button
        type="button"
        onClick={() => setArmed(false)}
        className="px-3 py-3 text-xs text-ink-60 hover:text-ink"
      >
        انصراف
      </button>
    </div>
  );
}
