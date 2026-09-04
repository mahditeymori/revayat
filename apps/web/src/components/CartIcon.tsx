/** Header cart icon: plain inline SVG (previously a Lottie animation blocked by CSP). */
export function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6 transition-transform group-hover:scale-110"
      aria-hidden
    >
      <path d="M6 8V6a6 6 0 1 1 12 0v2" />
      <path d="M4.5 8h15l-1 12.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4.5 8Z" />
    </svg>
  );
}
