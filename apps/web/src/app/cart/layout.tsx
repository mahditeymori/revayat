import type { Metadata } from 'next';

// Segment-level metadata: page.tsx itself is a client component (it reads
// live cart state from CartProvider), so the noindex directive and title
// live here instead.
export const metadata: Metadata = { title: 'سبد خرید', robots: { index: false, follow: false } };

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
