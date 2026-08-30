import type { Metadata } from 'next';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'درباره روایت',
  description: site.description,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-medium">درباره {site.nameFa}</h1>
      <div className="mt-8 space-y-4 text-sm leading-8 text-ink-60">
        <p>{site.tagline}</p>
        <p>{site.description}</p>
      </div>
    </div>
  );
}
