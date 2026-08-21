'use client';

// Instagram-style gallery: swipe on touch, arrows on desktop, click to zoom.
// Paging is native CSS scroll-snap rather than a JS carousel — the browser
// handles momentum, RTL, and reduced-motion for free, and it still works
// before hydration.
import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { toPersianDigits } from '@/lib/format';

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  // Derive the active slide from scroll position so swipe, arrows and dots
  // never disagree about which image is showing.
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    setIndex((prev) => (i !== prev && i >= 0 && i < images.length ? i : prev));
  }, [images.length]);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(i, images.length - 1));
    // RTL layouts scroll negatively — sign the offset to match the direction.
    const dir = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    el.scrollTo({ left: dir * clamped * el.clientWidth, behavior: 'smooth' });
  }, [images.length]);

  // Arrow keys page the gallery; Escape leaves the zoom view.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomed) return setZoomed(false);
      if (!zoomed) return;
      if (e.key === 'ArrowRight') goTo(index - 1); // RTL: right is previous
      if (e.key === 'ArrowLeft') goTo(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed, index, goTo]);

  // Lock body scroll while the zoom overlay is open.
  useEffect(() => {
    if (!zoomed) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [zoomed]);

  if (images.length === 0) return <div className="aspect-[3/4] bg-cream-200" />;

  return (
    <>
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setZoomed(true)}
              aria-label={`بزرگ‌نمایی تصویر ${toPersianDigits(i + 1)}`}
              className="relative aspect-[3/4] w-full shrink-0 snap-center cursor-zoom-in bg-cream-200"
            >
              <Image
                src={src}
                alt={`${name} — تصویر ${i + 1}`}
                fill
                priority={i === 0}
                loading={i === 0 ? undefined : 'lazy'}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>

        {images.length > 1 && (
          <>
            <GalleryArrow side="right" onClick={() => goTo(index - 1)} disabled={index === 0} label="تصویر قبلی" />
            <GalleryArrow side="left" onClick={() => goTo(index + 1)} disabled={index === images.length - 1} label="تصویر بعدی" />

            <div className="mt-4 flex justify-center gap-2">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`رفتن به تصویر ${toPersianDigits(i + 1)}`}
                  aria-current={i === index}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? 'w-6 bg-ink' : 'w-1.5 bg-ink/25 hover:bg-ink/50'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} — نمای بزرگ`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/95 p-4"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="بستن"
            className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-cream/10 text-2xl text-cream backdrop-blur transition-colors hover:bg-cream/20"
          >
            ×
          </button>

          <div className="relative h-full w-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[index]}
              alt={`${name} — تصویر ${index + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          {images.length > 1 && (
            <p className="absolute bottom-6 text-xs text-cream/70">
              {toPersianDigits(index + 1)} / {toPersianDigits(images.length)}
            </p>
          )}
        </div>
      )}
    </>
  );
}

function GalleryArrow({
  side,
  onClick,
  disabled,
  label,
}: {
  side: 'left' | 'right';
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-cream/80 text-ink backdrop-blur transition-opacity hover:bg-cream disabled:pointer-events-none disabled:opacity-0 md:flex ${
        side === 'right' ? 'right-3' : 'left-3'
      }`}
    >
      {side === 'right' ? '‹' : '›'}
    </button>
  );
}
