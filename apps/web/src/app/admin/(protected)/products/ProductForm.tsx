'use client';

import { useState } from 'react';

type Variant = {
  id?: string;
  size: string;
  color: string;
  sku: string;
  priceRial: string;
  compareAtPriceRial: string;
  stock: string;
  active: boolean;
};

type Category = { id: string; name: string };

type Props = {
  action: (formData: FormData) => Promise<void>;
  categories: Category[];
  defaultValues?: {
    slug: string;
    name: string;
    subtitle: string;
    description: string;
    priceRial: number;
    salePriceRial: number | null;
    categoryId: string | null;
    featured: boolean;
    active: boolean;
    material: string | null;
    fabricType: string | null;
    weight: string | null;
    additionalNotes: string | null;
    variants: {
      id: string;
      size: string | null;
      color: string | null;
      sku: string | null;
      priceRial: number | null;
      compareAtPriceRial: number | null;
      stock: number;
      active: boolean;
    }[];
  };
};

function emptyVariant(): Variant {
  return { size: '', color: '', sku: '', priceRial: '', compareAtPriceRial: '', stock: '0', active: true };
}

export default function ProductForm({ action, categories, defaultValues }: Props) {
  const [variants, setVariants] = useState<Variant[]>(
    defaultValues?.variants.map((v) => ({
      id: v.id,
      size: v.size ?? '',
      color: v.color ?? '',
      sku: v.sku ?? '',
      priceRial: v.priceRial != null ? String(v.priceRial) : '',
      compareAtPriceRial: v.compareAtPriceRial != null ? String(v.compareAtPriceRial) : '',
      stock: String(v.stock),
      active: v.active,
    })) ?? [emptyVariant()],
  );

  const variantsJson = JSON.stringify(
    variants.map((v) => ({
      id: v.id,
      size: v.size || null,
      color: v.color || null,
      sku: v.sku || null,
      priceRial: v.priceRial || null,
      compareAtPriceRial: v.compareAtPriceRial || null,
      stock: v.stock || 0,
      active: v.active,
    })),
  );

  function updateVariant(index: number, patch: Partial<Variant>) {
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  return (
    <form action={action} className="max-w-3xl space-y-6">
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <Field label="نام محصول" name="name" defaultValue={defaultValues?.name} required />
        <Field label="اسلاگ (انگلیسی)" name="slug" defaultValue={defaultValues?.slug} required />
        <Field label="زیرعنوان" name="subtitle" defaultValue={defaultValues?.subtitle} />
        <div>
          <label htmlFor="categoryId" className="mb-1 block text-sm text-slate-600">
            دسته‌بندی
          </label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={defaultValues?.categoryId ?? ''}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">بدون دسته‌بندی</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <Field label="قیمت (ریال)" name="priceRial" type="number" defaultValue={String(defaultValues?.priceRial ?? '')} required />
        <Field
          label="قیمت تخفیف‌خورده (ریال)"
          name="salePriceRial"
          type="number"
          defaultValue={defaultValues?.salePriceRial != null ? String(defaultValues.salePriceRial) : ''}
        />
        <div className="col-span-2">
          <Field label="توضیحات" name="description" defaultValue={defaultValues?.description} textarea />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="featured" defaultChecked={defaultValues?.featured} /> ویژه
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="active" defaultChecked={defaultValues?.active ?? true} /> فعال
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="col-span-2 text-sm font-medium text-slate-900">مشخصات</h2>
        <Field label="جنس" name="material" defaultValue={defaultValues?.material ?? ''} />
        <Field label="نوع پارچه" name="fabricType" defaultValue={defaultValues?.fabricType ?? ''} />
        <Field label="وزن" name="weight" defaultValue={defaultValues?.weight ?? ''} />
        <div className="col-span-2">
          <Field label="توضیحات تکمیلی" name="additionalNotes" defaultValue={defaultValues?.additionalNotes ?? ''} textarea />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-900">تنوع‌ها</h2>
          <button
            type="button"
            onClick={() => setVariants((prev) => [...prev, emptyVariant()])}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            + افزودن تنوع
          </button>
        </div>

        <div className="space-y-3">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-7 items-end gap-2 border-b border-slate-100 pb-3">
              <MiniField label="سایز" value={v.size} onChange={(val) => updateVariant(i, { size: val })} />
              <MiniField label="رنگ" value={v.color} onChange={(val) => updateVariant(i, { color: val })} />
              <MiniField label="SKU" value={v.sku} onChange={(val) => updateVariant(i, { sku: val })} />
              <MiniField label="قیمت ویژه" value={v.priceRial} onChange={(val) => updateVariant(i, { priceRial: val })} />
              <MiniField
                label="قیمت قبل تخفیف"
                value={v.compareAtPriceRial}
                onChange={(val) => updateVariant(i, { compareAtPriceRial: val })}
              />
              <MiniField label="موجودی" value={v.stock} onChange={(val) => updateVariant(i, { stock: val })} />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input type="checkbox" checked={v.active} onChange={(e) => updateVariant(i, { active: e.target.checked })} />
                  فعال
                </label>
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVariants((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-600 hover:underline"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name="variantsJson" value={variantsJson} />

      <button type="submit" className="rounded bg-slate-900 px-6 py-2.5 text-sm font-medium text-white">
        ذخیره
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  textarea,
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  textarea?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-slate-600">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          rows={4}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
      )}
    </div>
  );
}

function MiniField({ label, value, onChange }: { label: string; value: string; onChange: (val: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
    </div>
  );
}
