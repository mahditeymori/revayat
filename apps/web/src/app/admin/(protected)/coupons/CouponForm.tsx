type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    maxUsesTotal: number | null;
    maxUsesPerCustomer: number;
    minSubtotalRial: number;
    active: boolean;
    expiresAt: string;
    assignedPhone: string;
  };
};

export default function CouponForm({ action, defaultValues }: Props) {
  return (
    <form action={action} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <Field label="کد تخفیف" name="code" defaultValue={defaultValues?.code} required />

      <div>
        <label htmlFor="type" className="mb-1 block text-sm text-slate-600">
          نوع تخفیف
        </label>
        <select
          id="type"
          name="type"
          defaultValue={defaultValues?.type ?? 'percentage'}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        >
          <option value="percentage">درصدی</option>
          <option value="fixed">مبلغ ثابت (ریال)</option>
        </select>
      </div>

      <Field label="مقدار" name="value" type="number" defaultValue={String(defaultValues?.value ?? '')} required />
      <Field
        label="سقف کل استفاده (خالی = نامحدود)"
        name="maxUsesTotal"
        type="number"
        defaultValue={defaultValues?.maxUsesTotal != null ? String(defaultValues.maxUsesTotal) : ''}
      />
      <Field
        label="سقف استفاده هر مشتری"
        name="maxUsesPerCustomer"
        type="number"
        defaultValue={String(defaultValues?.maxUsesPerCustomer ?? 1)}
      />
      <Field
        label="حداقل مبلغ سبد خرید (ریال)"
        name="minSubtotalRial"
        type="number"
        defaultValue={String(defaultValues?.minSubtotalRial ?? 0)}
      />
      <Field
        label="مختص شماره موبایل (خالی = برای همه)"
        name="assignedPhone"
        defaultValue={defaultValues?.assignedPhone ?? ''}
        placeholder="09123456789"
      />
      <Field
        label="تاریخ انقضا (خالی = بدون انقضا)"
        name="expiresAt"
        type="date"
        defaultValue={defaultValues?.expiresAt ?? ''}
      />

      <div className="flex items-center gap-2">
        <input id="active" name="active" type="checkbox" defaultChecked={defaultValues?.active ?? true} />
        <label htmlFor="active" className="text-sm text-slate-600">
          فعال
        </label>
      </div>

      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
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
  type = 'text',
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm text-slate-600">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </div>
  );
}
