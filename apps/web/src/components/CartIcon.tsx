'use client';

import { useRef } from 'react';
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react';

/** Header cart icon: plays the brand animation once on hover, resets on mouse-leave. */
export function CartIcon() {
  const dotLottie = useRef<DotLottie | null>(null);
  return (
    <span
      className="block h-6 w-6"
      onMouseEnter={() => dotLottie.current?.play()}
      onMouseLeave={() => dotLottie.current?.stop()}
    >
      <DotLottieReact
        src="/cart-icon.lottie"
        autoplay={false}
        loop
        dotLottieRefCallback={(instance) => {
          dotLottie.current = instance;
        }}
        className="h-6 w-6"
      />
    </span>
  );
}
