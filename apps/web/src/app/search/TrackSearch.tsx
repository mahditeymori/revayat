'use client';

// The search page is a server component; this records the executed query
// without turning the whole page into client code.
import { useEffect } from 'react';
import { trackEvent } from '@/components/Track';

export function TrackSearch({ query }: { query: string }) {
  useEffect(() => {
    if (query) trackEvent('search', { query });
  }, [query]);

  return null;
}
