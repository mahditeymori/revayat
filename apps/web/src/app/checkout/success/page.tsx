// Kept as a redirect only. Before the Zibal gateway this was the end of the
// checkout flow ("we will call you about payment"); the receipt now lives at
// /payment/result, driven by the verified payment row rather than by an order
// id in the URL. Old links and bookmarks land here and are forwarded.
import { redirect } from 'next/navigation';
import { getOrder } from '@/lib/catalog';
import { normalizeDigits } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: param } = await searchParams;
  const id = Number(normalizeDigits(param ?? ''));
  const order = Number.isInteger(id) && id > 0 ? await getOrder(id) : null;

  if (order?.paidTrackId) {
    redirect(`/payment/result?trackId=${encodeURIComponent(order.paidTrackId)}`);
  }
  redirect(order ? `/payment/failed?order=${order.id}` : '/cart');
}
