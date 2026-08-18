'use client';

import { useActionState, useState } from 'react';
import Image from 'next/image';
import { saveProductAction, type AdminActionState } from '@/app/admin/actions';
import { rialToToman } from '@/lib/format';
import type { Product, Category } from '@/lib/catalog';

const INITIAL: AdminActionState = { error: null };

const input =
  'w-full border border-cream-200 bg-transparent px-4 py-3 text-sm focus:border-ink focus:outline-none';

/** `product` is undefined when creating. */
export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const [state, action, pending] = useActionState(saveProductAction, INITIAL);
  const [images, setImages] = useState<string[]>(product?.images ?? []);

  return (
    <form action={action} className="mt-8 grid gap-5 sm:grid-cols-2">
      <input type="hidden" name="id" value={product?.id ?? 0} />

      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs text-ink-60" htmlFor="name">نام محصول</label>
        <input id="name" name="name" defaultValue={product?.name} required className={input} />
      </div>

      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs text-ink-60" htmlFor="subtitle">زیرعنوان</label>
        <input id="subtitle" name="subtitle" defaultValue={product?.subtitle} className={input} />
      </div>

      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="priceToman">قیمت (تومان)</label>
        <input
          id="priceToman"
          name="priceToman"
          type="number"
          min={0}
          dir="ltr"
          defaultValue={product ? rialToToman(product.priceRial) : ''}
          required
          className={input}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="salePriceToman">
          قیمت تخفیف‌دار (تومان — خالی یعنی بدون تخفیف)
        </label>
        <input
          id="salePriceToman"
          name="salePriceToman"
          type="number"
          min={0}
          dir="ltr"
          defaultValue={product?.salePriceRial ? rialToToman(product.salePriceRial) : ''}
          className={input}
        />
      </div>

      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="category">دسته‌بندی</label>
        <select id="category" name="category" defaultValue={product?.category} className={input}>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-xs text-ink-60" htmlFor="sizes">سایزها (با ، جدا کنید)</label>
        <input id="sizes" name="sizes" defaultValue={product?.sizes.join('، ')} className={input} />
      </div>

      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs text-ink-60" htmlFor="colors">رنگ‌ها (با ، جدا کنید)</label>
        <input id="colors" name="colors" defaultValue={product?.colors.join('، ')} className={input} />
      </div>

      <div className="sm:col-span-2">
        <p className="mb-2 text-xs text-ink-60">تصاویر</p>
        {images.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-3">
            {images.map((src) => (
              <li key={src} className="relative">
                <input type="hidden" name="existingImages" value={src} />
                <div className="relative h-24 w-20 overflow-hidden bg-cream-200">
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((s) => s !== src))}
                  aria-label="حذف تصویر"
                  className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-cream"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id="images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          className="block w-full text-xs file:ml-3 file:border-0 file:bg-ink file:px-4 file:py-2 file:text-xs file:text-cream"
        />
        <p className="mt-2 text-[11px] text-ink-60">JPG، PNG، WebP یا AVIF — حداکثر ۵ مگابایت.</p>
      </div>

      <div className="sm:col-span-2">
        <label className="mb-2 block text-xs text-ink-60" htmlFor="description">داستان طرح</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={product?.description}
          className={input}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="inStock" defaultChecked={product?.inStock ?? true} />
        موجود است
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="featured" defaultChecked={product?.featured ?? false} />
        منتخب صفحه اول
      </label>

      <button
        type="submit"
        disabled={pending}
        className="bg-ink py-4 text-sm text-cream hover:bg-sand-dark disabled:opacity-50 sm:col-span-2"
      >
        {pending ? 'در حال ذخیره…' : product ? 'ذخیره تغییرات' : 'ایجاد محصول'}
      </button>

      {state.error && <p role="alert" className="text-xs text-clay sm:col-span-2">{state.error}</p>}
      {state.ok && <p role="status" className="text-xs text-ink sm:col-span-2">ذخیره شد.</p>}
    </form>
  );
}
