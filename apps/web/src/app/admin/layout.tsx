import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdmin } from '@/lib/admin';
import { LoginForm } from './auth';
import { logoutAction } from './actions';

export const metadata: Metadata = { title: 'مدیریت', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/admin', label: 'محصولات' },
  { href: '/admin/orders', label: 'سفارش‌ها' },
  { href: '/admin/payments', label: 'پرداخت‌ها' },
  { href: '/admin/analytics', label: 'آمار' },
  { href: '/admin/settings', label: 'تنظیمات سایت' },
  { href: '/admin/support', label: 'پشتیبانی' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) {
    return (
      <div className="mx-auto max-w-sm px-4 py-32">
        <h1 className="wordmark text-sm text-ink-60">ورود مدیر</h1>
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-cream-200 pb-6">
        <nav className="flex gap-6 text-sm">
          {NAV.map((i) => (
            <Link key={i.href} href={i.href} className="hover:text-sand-dark">
              {i.label}
            </Link>
          ))}
        </nav>
        <form action={logoutAction}>
          <button type="submit" className="text-xs text-ink-60 underline hover:text-clay">
            خروج
          </button>
        </form>
      </div>
      <div className="py-8">{children}</div>
    </div>
  );
}
