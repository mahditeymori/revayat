type Props = {
  action: (formData: FormData) => Promise<void>;
  defaultValues?: { slug: string; title: string; bodyHtml: string };
};

export default function SupportPageForm({ action, defaultValues }: Props) {
  return (
    <form action={action} className="max-w-lg space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="title" className="mb-1 block text-sm text-slate-600">
          عنوان
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={defaultValues?.title}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="slug" className="mb-1 block text-sm text-slate-600">
          اسلاگ (انگلیسی، مثال: shipping)
        </label>
        <input
          id="slug"
          name="slug"
          required
          defaultValue={defaultValues?.slug}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="bodyHtml" className="mb-1 block text-sm text-slate-600">
          محتوا (HTML)
        </label>
        <textarea
          id="bodyHtml"
          name="bodyHtml"
          defaultValue={defaultValues?.bodyHtml}
          rows={10}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>
      <button type="submit" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
        ذخیره
      </button>
    </form>
  );
}
