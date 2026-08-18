// Inline-SVG charts. No chart library: next.config.mjs ships a strict CSP with
// no third-party origins, and every chart here is one series over time or one
// ranked list — a library would be more bytes than the drawing code.
//
// All of these are server components. Hover tooltips are native SVG <title>,
// so there is no client JS on the admin dashboard at all.
import { formatJalali, toPersianDigits } from '@/lib/format';
import type { Point, Ranked } from '@/lib/reports';

const BAR = 'var(--color-sand-dark)'; // 3.9:1 on cream — passes contrast vs surface
const GRID = 'var(--color-cream-200)';

/** Round a max up to 1/2/5 × 10^k so axis ticks land on readable numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

const fa = (n: number) => toPersianDigits(Math.round(n).toLocaleString('en-US')).replace(/,/g, '٬');
const shortDay = (day: string) => formatJalali(day).split(' ').slice(0, 2).join(' ');

/**
 * Daily column chart. Time runs right → left: a Persian reader starts at the
 * right edge, so the oldest day belongs there and today sits at the left.
 */
export function DayColumns({
  data,
  title,
  unit,
  scale = 1,
}: {
  data: Point[];
  title: string;
  /** Axis unit, named in the subtitle instead of abbreviated on every tick. */
  unit: string;
  /** Divides raw values for display (e.g. Rial → thousand Toman). */
  scale?: number;
}) {
  const W = 640;
  const H = 200;
  const padR = 52; // y-axis labels sit on the right in RTL
  const padL = 8;
  const padT = 14;
  const padB = 24;
  const plotW = W - padR - padL;
  const plotH = H - padT - padB;
  const base = H - padB;

  const values = data.map((d) => d.value / scale);
  const max = niceMax(Math.max(...values, 0));
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, Math.max(2, band - 2)); // 2px surface gap between neighbours
  const y = (v: number) => base - (v / max) * plotH;

  const peak = values.indexOf(Math.max(...values));
  // Oldest on the right: index 0 starts at the right edge and walks left.
  const xOf = (i: number) => W - padR - (i + 1) * band + (band - barW) / 2;

  const ticks = [0, max / 2, max];
  const dayTicks = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i && v >= 0,
  );

  return (
    <figure className="border border-cream-200 p-5">
      <figcaption className="text-sm font-medium">
        {title}
        <span className="mt-1 block text-xs font-normal text-ink-60">{unit}</span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 h-auto w-full"
        role="img"
        aria-label={`${title} — بیشترین ${fa(max)} در روز`}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text
              x={W - padR + 6}
              y={y(t) + 4}
              fontSize={11}
              fill="var(--color-ink-60)"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {fa(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const v = values[i];
          const h = base - y(v);
          const x = xOf(i);
          const label = `${shortDay(d.day)}: ${fa(v)}`;
          return (
            <g key={d.day}>
              {/* Full-band hit target so hovering a 4px bar still works. */}
              <rect x={W - padR - (i + 1) * band} y={padT} width={band} height={plotH} fill="transparent">
                <title>{label}</title>
              </rect>
              {h > 0 && (
                <path
                  // 4px rounded cap, square at the baseline
                  d={
                    h <= 4
                      ? `M${x},${base - h}h${barW}v${h}h${-barW}z`
                      : `M${x},${base}V${base - h + 4}q0,-4 4,-4h${barW - 8}q4,0 4,4V${base}z`
                  }
                  fill={BAR}
                >
                  <title>{label}</title>
                </path>
              )}
            </g>
          );
        })}

        {/* Only the peak is labelled — a number on every column goes unread. */}
        {values[peak] > 0 && (
          <text
            x={xOf(peak) + barW / 2}
            y={y(values[peak]) - 6}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-ink)"
          >
            {fa(values[peak])}
          </text>
        )}

        {dayTicks.map((i) => (
          <text
            key={i}
            x={xOf(i) + barW / 2}
            y={H - 6}
            fontSize={11}
            textAnchor="middle"
            fill="var(--color-ink-60)"
          >
            {shortDay(data[i].day)}
          </text>
        ))}
      </svg>
    </figure>
  );
}

/** Ranked list: the bar is the magnitude, the number stays readable beside it. */
export function RankedList({
  title,
  rows,
  empty = 'داده‌ای ثبت نشده است.',
  format = fa,
  ltr = false,
}: {
  title: string;
  rows: Ranked[];
  empty?: string;
  format?: (n: number) => string;
  /** Paths and hostnames read left-to-right even inside an RTL page. */
  ltr?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <section className="border border-cream-200 p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-xs text-ink-60">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate" dir={ltr ? 'ltr' : undefined} title={r.label}>
                  {r.label}
                </span>
                <span className="shrink-0 text-ink-60" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {format(r.count)}
                </span>
              </div>
              <div className="mt-1 h-1.5 bg-cream-200">
                <div className="h-full" style={{ width: `${(r.count / max) * 100}%`, background: BAR }} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Stat tile: label, value, optional one-line note. */
export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-cream-200 p-4">
      <p className="text-xs text-ink-60">{label}</p>
      <p className="mt-2 text-2xl font-medium">{value}</p>
      {note && <p className="mt-1 text-xs text-ink-60">{note}</p>}
    </div>
  );
}
