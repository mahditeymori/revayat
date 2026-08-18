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
  createProduct,
  deleteProduct,
  uniqueSlug,
  type OrderStatus,
  type Product,
} from '@/lib/catalog';
import { saveUpload, deleteUploadDir } from '@/lib/uploads';
import { normalizeDigits, slugifyPersian } from '@/lib/format';

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

const list = (v: FormDataEntryValue | null): string[] =>
  String(v ?? '')
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** id 0 (or absent) creates a new product; any other id edits that product. */
export async function saveProductAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const id = num(formData.get('id'));
  const catalog = await getCatalog();
  const existing = id ? catalog.products.find((p) => p.id === id) : undefined;
  if (id && !existing) return { error: 'محصول پیدا نشد.' };

  const name = String(formData.get('name') ?? '').trim();
  const priceRial = num(formData.get('priceToman')) * 10;
  const saleToman = num(formData.get('salePriceToman'));
  if (!name || name.length > 120) return { error: 'نام محصول را درست وارد کنید.' };
  if (!Number.isInteger(priceRial) || priceRial <= 0) return { error: 'قیمت باید عددی مثبت باشد.' };
  const salePriceRial = saleToman > 0 ? saleToman * 10 : null;
  if (salePriceRial !== null && salePriceRial >= priceRial)
    return { error: 'قیمت تخفیف‌دار باید کمتر از قیمت اصلی باشد.' };

  const sizes = list(formData.get('sizes'));
  if (sizes.length === 0) return { error: 'حداقل یک سایز وارد کنید.' };

  const category = String(formData.get('category') ?? existing?.category ?? '');
  if (!catalog.categories.some((c) => c.slug === category))
    return { error: 'دسته‌بندی نامعتبر است.' };

  const slug = existing?.slug ?? (await uniqueSlug(slugifyPersian(name) || 'product'));

  // Images kept = whatever the form still lists, plus any newly uploaded files.
  const kept = formData.getAll('existingImages').map(String).filter(Boolean);
  const uploads = formData.getAll('images').filter((f): f is File => f instanceof File && f.size > 0);
  const added: string[] = [];
  for (const [i, file] of uploads.entries()) {
    const result = await saveUpload(file, slug, kept.length + i);
    if (!result.ok) return { error: result.error };
    added.push(result.url);
  }
  const images = [...kept, ...added];
  if (images.length === 0) return { error: 'حداقل یک تصویر لازم است.' };

  const fields = {
    name,
    slug,
    subtitle: String(formData.get('subtitle') ?? '').trim().slice(0, 200),
    description: String(formData.get('description') ?? '').trim().slice(0, 2000),
    priceRial,
    salePriceRial,
    images,
    sizes,
    colors: list(formData.get('colors')),
    category,
    inStock: formData.get('inStock') === 'on',
    featured: formData.get('featured') === 'on',
  };

  if (!existing) {
    const created = await createProduct(fields);
    revalidateStore();
    redirect(`/admin/products/${created.id}`);
  }

  await saveCatalog({
    ...catalog,
    products: catalog.products.map((p) => (p.id === id ? ({ ...p, ...fields } as Product) : p)),
  });
  revalidateStore();
  return { error: null, ok: true };
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const removed = await deleteProduct(num(formData.get('id')));
  if (removed) await deleteUploadDir(removed.slug);
  revalidateStore();
  revalidatePath('/admin/products');
  redirect('/admin');
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
