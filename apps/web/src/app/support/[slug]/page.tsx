import { notFound } from 'next/navigation';
import { getSupportPage } from '@/lib/commerce/support';

export default async function SupportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getSupportPage(slug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="wordmark text-2xl text-ink">{page.title}</h1>
      <div className="prose prose-sm mt-8 max-w-none text-ink-60" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
    </article>
  );
}
