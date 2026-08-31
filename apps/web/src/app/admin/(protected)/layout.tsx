export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import { requireAdmin } from '@/lib/admin/session';
import { hasPermission, type Permission } from '@/lib/admin/rbac';

// Nav visibility below is cosmetic only. Every linked page independently
// calls requireAdmin()/requirePermission() — this list never substitutes
// for that check.
const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: '/admin', label: 'داشبورد', permission: 'dashboard.view' },
  { href: '/admin/products', label: 'محصولات', permission: 'products.manage' },
  { href: '/admin/categories', label: 'دسته‌بندی‌ها', permission: 'categories.manage' },
  { href: '/admin/inventory', label: 'موجودی', permission: 'inventory.manage' },
  { href: '/admin/orders', label: 'سفارش‌ها', permission: 'orders.view' },
  { href: '/admin/payments', label: 'پرداخت‌ها', permission: 'payments.view' },
  { href: '/admin/coupons', label: 'کد تخفیف', permission: 'coupons.view' },
  { href: '/admin/settings', label: 'تنظیمات سایت', permission: 'settings.manage' },
  { href: '/admin/support', label: 'محتوای پشتیبانی', permission: 'support.manage' },
  { href: '/admin/admins', label: 'مدیران', permission: 'admins.manage' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { admin } = await requireAdmin();
  const links = NAV.filter((item) => hasPermission(admin.role, item.permission));

  return (
    <div dir="rtl" className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="w-56 shrink-0 border-l border-slate-200 bg-white p-4">
        <p className="mb-6 text-sm font-medium text-slate-900">پنل مدیریت روایت</p>
        <nav className="space-y-1">
          {links.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="block rounded px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <span className="text-sm text-slate-500">{admin.email} · {ROLE_LABELS[admin.role]}</span>
          <form action="/admin/logout" method="post">
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
              خروج
            </button>
          </form>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالک',
  admin: 'مدیر',
  editor: 'ویرایشگر',
  support: 'پشتیبانی',
};
