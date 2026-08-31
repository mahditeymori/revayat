import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { getSupportPage } from '@/lib/commerce/support';

export default async function SupportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getSupportPage(slug);
  if (!page) notFound();

  // Sanitized again here even though createSupportPage/updateSupportPage
  // already sanitize on write — a second pass at the one render call site
  // means a row written before that guard existed, or by any future write
  // path that forgets it, still can't execute script.
  const bodyHtml = DOMPurify.sanitize(page.bodyHtml);

  return (
    <article className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="wordmark text-2xl text-ink">{page.title}</h1>
      <div className="prose prose-sm mt-8 max-w-none text-ink-60" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </article>
  );
}
