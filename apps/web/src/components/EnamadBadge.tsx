export function EnamadBadge({ size = 96 }: { size?: number }) {
  return (
    <a
      href="https://trustseal.enamad.ir/?id=7309998&Code=KuXSFrNV4gLtk6oWJRveFSxjBZKmjkEk"
      target="_blank"
      rel="noopener"
      referrerPolicy="origin"
      aria-label="نماد اعتماد الکترونیکی — مشاهده گواهی"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Enamad badge must be served unmodified from their domain */}
      <img
        src="https://trustseal.enamad.ir/logo.aspx?id=7309998&Code=KuXSFrNV4gLtk6oWJRveFSxjBZKmjkEk"
        alt="نماد اعتماد الکترونیکی"
        referrerPolicy="origin"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    </a>
  );
}
