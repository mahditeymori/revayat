'use client';

import { usePathname } from 'next/navigation';

// Hides the shared site-wide <Header /> on "/" only, where HomeHeader takes
// over instead. Every other route (including /admin/**) renders children
// unchanged — layout.tsx's Header()/Footer() bodies are never touched.
export function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <>{children}</>;
}
