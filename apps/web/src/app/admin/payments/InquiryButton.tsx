'use client';

import { useFormStatus } from 'react-dom';
import { inquirePaymentAction } from '../actions';

export function InquiryButton({ trackId }: { trackId: string }) {
  return (
    <form action={inquirePaymentAction}>
      <input type="hidden" name="trackId" value={trackId} />
      <Submit />
    </form>
  );
}

// The inquiry is a live round-trip to Zibal — without a pending state an admin
// clicking on a slow connection has no idea whether it registered.
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-cream-200 px-4 py-2 text-xs hover:border-ink disabled:opacity-50"
    >
      {pending ? 'در حال استعلام…' : 'استعلام از درگاه'}
    </button>
  );
}
