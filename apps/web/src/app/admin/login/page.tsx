export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/admin/session';
import { loginAction } from './actions';

const ERRORS: Record<string, string> = {
  invalid: 'ایمیل یا رمز عبور نادرست است.',
  locked: 'به دلیل تلاش‌های ناموفق مکرر، این حساب موقتاً قفل شده است.',
  'rate-limited': 'تعداد تلاش‌ها بیش از حد مجاز بود. لطفاً کمی بعد دوباره تلاش کنید.',
};

type Props = { searchParams: Promise<{ error?: string }> };

export default async function AdminLoginPage({ searchParams }: Props) {
  if (await getSession()) redirect('/admin');
  const { error } = await searchParams;

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        action={loginAction}
        className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-lg font-medium text-slate-900">ورود به پنل مدیریت روایت</h1>

        {error && (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {ERRORS[error] ?? 'خطایی رخ داد. دوباره تلاش کنید.'}
          </p>
        )}

        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-slate-600">
            ایمیل
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-slate-600">
            رمز عبور
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          ورود
        </button>
      </form>
    </div>
  );
}
