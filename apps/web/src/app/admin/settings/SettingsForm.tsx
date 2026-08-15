'use client';

import { useActionState } from 'react';
import { saveSettingsAction, type AdminActionState } from '@/app/admin/actions';
import type { Settings } from '@/lib/catalog';

const INITIAL: AdminActionState = { error: null };

const input =
  'w-full border border-cream-200 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none';

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettingsAction, INITIAL);

  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="announcement">
          نوار اعلان بالای سایت (خالی یعنی مخفی)
        </label>
        <input id="announcement" name="announcement" defaultValue={settings.announcement} className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="heroTitle">عنوان اصلی صفحه اول</label>
        <input id="heroTitle" name="heroTitle" defaultValue={settings.heroTitle} required className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="heroSubtitle">زیرعنوان صفحه اول</label>
        <input id="heroSubtitle" name="heroSubtitle" defaultValue={settings.heroSubtitle} className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="heroImage">
          تصویر صفحه اول (مسیر داخل سایت، مثلاً ‎/products/damavand/1.png)
        </label>
        <input id="heroImage" name="heroImage" defaultValue={settings.heroImage} dir="ltr" className={input} />
      </div>
      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="footerText">متن فوتر</label>
        <textarea id="footerText" name="footerText" rows={3} defaultValue={settings.footerText} className={input} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-ink py-4 text-sm text-cream hover:bg-sand-dark disabled:opacity-50"
      >
        {pending ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}
      </button>

      {state.error && <p role="alert" className="text-xs text-clay">{state.error}</p>}
      {state.ok && <p role="status" className="text-xs text-ink">ذخیره شد.</p>}
    </form>
  );
}
