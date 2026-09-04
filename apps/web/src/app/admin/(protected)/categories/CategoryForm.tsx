type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: {
    slug: string;
    name: string;
    description: string;
    imageUrl: string | null;
    sortOrder: number;
  };
};

export default function CategoryForm({ action, defaultValues }: Props) {
  return (
    <form action={action} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <Field label="نام" name="name" defaultValue={defaultValues?.name} required />
      <Field label="اسلاگ (انگلیسی)" name="slug" defaultValue={defaultValues?.slug} required />
      <Field label="توضیحات" name="description" defaultValue={defaultValues?.description} textarea />
      <input type="hidden" name="imageUrl" value={defaultValues?.imageUrl ?? ''} />
      <Field label="ترتیب نمایش" name="sortOrder" type="number" defaultValue={String(defaultValues?.sortOrder ?? 0)} />

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
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      )}
    </div>
  );
}
