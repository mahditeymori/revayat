'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { checkPassword, createSession, destroySession, isAdmin } from '@/lib/admin';
import {
  getCatalog,
  saveCatalog,
  getSettings,
  saveSettings,
  updateOrderStatus,
  deleteOrder,
  type OrderStatus,
  type Product,
} from '@/lib/catalog';
import { normalizeDigits } from '@/lib/format';

export type LoginState = { error: string | null };
export type AdminActionState = { error: string | null; ok?: boolean };

// Every mutating action re-checks the session server-side — the layout gate
// only hides UI, it does not protect the actions themselves.
async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect('/admin');
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get('password') ?? '');
  if (!checkPassword(password)) {
    // small fixed delay to slow down guessing
    await new Promise((r) => setTimeout(r, 500));
    return { error: 'رمز عبور اشتباه است.' };
  }
  await createSession();
  redirect('/admin');
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect('/admin');
}

// --- Revalidation: storefront pages cache catalog data (ISR), bust them all ---
function revalidateStore(): void {
  for (const p of ['/', '/collections', '/search', '/sitemap.xml']) revalidatePath(p);
  revalidatePath('/collections/[slug]', 'page');
  revalidatePath('/products/[slug]', 'page');
}

const num = (v: FormDataEntryValue | null): number =>
  Math.trunc(Number(normalizeDigits(String(v ?? '')).replace(/[^\d.-]/g, '')));

export async function saveProductAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const id = num(formData.get('id'));
  const catalog = await getCatalog();
  const existing = catalog.products.find((p) => p.id === id);
  if (!existing) return { error: 'محصول پیدا نشد.' };

  const name = String(formData.get('name') ?? '').trim();
  const priceRial = num(formData.get('priceToman')) * 10;
  const saleToman = num(formData.get('salePriceToman'));
  if (!name || name.length > 120) return { error: 'نام محصول را درست وارد کنید.' };
  if (!Number.isInteger(priceRial) || priceRial <= 0) return { error: 'قیمت باید عددی مثبت باشد.' };
  const salePriceRial = saleToman > 0 ? saleToman * 10 : null;
  if (salePriceRial !== null && salePriceRial >= priceRial)
    return { error: 'قیمت تخفیف‌دار باید کمتر از قیمت اصلی باشد.' };

  const sizes = String(formData.get('sizes') ?? '')
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sizes.length === 0) return { error: 'حداقل یک سایز وارد کنید.' };

  const updated: Product = {
    ...existing,
    name,
    subtitle: String(formData.get('subtitle') ?? '').trim().slice(0, 200),
    description: String(formData.get('description') ?? '').trim().slice(0, 2000),
    priceRial,
    salePriceRial,
    sizes,
    colors: String(formData.get('colors') ?? '')
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean),
    category: String(formData.get('category') ?? existing.category),
    inStock: formData.get('inStock') === 'on',
    featured: formData.get('featured') === 'on',
  };

  await saveCatalog({
    ...catalog,
    products: catalog.products.map((p) => (p.id === id ? updated : p)),
  });
  revalidateStore();
  return { error: null, ok: true };
}

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = num(formData.get('id'));
  const status = String(formData.get('status')) as OrderStatus;
  const valid: OrderStatus[] = ['new', 'processing', 'shipped', 'done', 'canceled'];
  if (id > 0 && valid.includes(status)) {
    await updateOrderStatus(id, status);
    revalidatePath('/admin/orders');
  }
}

export async function deleteOrderAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = num(formData.get('id'));
  if (id > 0) {
    await deleteOrder(id);
    revalidatePath('/admin/orders');
  }
}

export async function saveSettingsAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const current = await getSettings();
  const text = (name: string, max: number) => String(formData.get(name) ?? '').trim().slice(0, max);
  const heroImage = text('heroImage', 300);
  // only allow site-local image paths — no external URLs in the hero
  if (heroImage && !/^\/[\w\-./]+$/.test(heroImage)) return { error: 'مسیر تصویر باید با / شروع شود (مثلاً ‎/products/damavand/1.png).' };

  await saveSettings({
    ...current,
    announcement: text('announcement', 200),
    heroTitle: text('heroTitle', 200) || current.heroTitle,
    heroSubtitle: text('heroSubtitle', 300),
    heroImage: heroImage || current.heroImage,
    footerText: text('footerText', 500),
  });
  revalidateStore();
  return { error: null, ok: true };
}
