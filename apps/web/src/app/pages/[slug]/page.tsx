import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { staticPages, getStaticPage } from '@/lib/pages';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return staticPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getStaticPage(slug);
  if (!page) return {};
  return {
    title: page.title,
    description: page.body[0],
    alternates: { canonical: `/pages/${page.slug}` },
  };
}

export default async function StaticContentPage({ params }: Props) {
  const { slug } = await params;
  const page = getStaticPage(slug);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-medium">{page.title}</h1>
      <div className="mt-8 space-y-4 text-sm leading-8 text-ink-60">
        {page.body.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  );
}
