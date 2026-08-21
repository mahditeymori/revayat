import { getSupportContent } from '@/lib/catalog';
import { SupportContentForm } from './SupportContentForm';

export default async function AdminSupportPage() {
  const content = await getSupportContent();

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-medium">محتوای پشتیبانی</h1>
      <p className="mt-2 text-xs text-ink-60">
        این متن‌ها روی ویجت گفتگوی پشتیبانی در همه صفحات سایت نمایش داده می‌شوند.
      </p>
      <SupportContentForm content={content} />
    </div>
  );
}
