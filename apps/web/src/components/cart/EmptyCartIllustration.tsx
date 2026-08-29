'use client';

// Reuses the existing header cart-icon asset/dependency for the drawer's
// empty-cart brand moment — no new binary asset, no new dependency. The
// global prefers-reduced-motion CSS rule collapses ordinary transitions but
// doesn't reach this WASM-rendered canvas, so it gets its own explicit check:
// autoplay/loop stay off and the animation shows only its static first frame.
import { useEffect, useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function EmptyCartIllustration() {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="h-16 w-16 opacity-70" aria-hidden>
      <DotLottieReact
        src="/cart-icon.lottie"
        autoplay={!reduceMotion}
        loop={!reduceMotion}
        className="h-16 w-16"
      />
    </div>
  );
}
