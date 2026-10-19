/**
 * Small, dependency-free, server-rendered charts (single series each).
 *
 * Follows the dataviz rules: one hue for magnitude (brand blue, --chart-series-1,
 * validated against the card surface in light and dark), thin marks (<= 24px)
 * with 4px rounded data-ends and square baselines, a 2px surface gap between
 * adjacent columns, solid hairline grid/axes, values in text ink (never the
 * series color), a hover + keyboard-focus tooltip per mark (value leads, label
 * follows), and the same data in a table on the page so nothing is gated.
 */

export type BarDatum = { id: string; label: string; value: number; display: string; href?: string };

function Caption({ title, description }: { title: string; description?: string }) {
  return (
    <figcaption className="mb-4">
      <span className="block text-[15px] font-semibold tracking-[-0.01em] text-[var(--chart-text)]">{title}</span>
      {description ? <span className="mt-0.5 block text-[13px] text-[var(--chart-muted)]">{description}</span> : null}
    </figcaption>
  );
}

function Tooltip({ value, label, className, style }: { value: string; label: string; className?: string; style?: React.CSSProperties }) {
  return (
    <span
      role="tooltip"
      style={style}
      className={`pointer-events-none absolute z-20 hidden whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left shadow-pop group-hover:block group-focus-visible:block ${className ?? ""}`}
    >
      <span className="tabular block text-[13px] font-semibold text-[var(--chart-text)]">{value}</span>
      <span className="block text-[11px] text-[var(--chart-muted)]">{label}</span>
    </span>
  );
}

export function HorizontalBarChart({ data, title, description }: { data: BarDatum[]; title: string; description?: string }) {
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  return (
    <figure className="w-full">
      <Caption title={title} description={description} />
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--chart-muted)]">No data yet.</p>
      ) : (
        <ol className="space-y-[6px]" aria-label={title}>
          {data.map((d) => (
            <li
              key={d.id}
              tabIndex={0}
              aria-label={`${d.label}: ${d.display}`}
              className="group relative grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-3 rounded-sm text-[13px] outline-none sm:grid-cols-[7.5rem_minmax(0,1fr)]"
            >
              <span className="truncate text-right text-[var(--chart-text)]" aria-hidden>
                {d.label}
              </span>
              <span className="flex h-5 items-center gap-2 border-l border-[var(--chart-axis)]" aria-hidden>
                <span
                  className="h-3.5 rounded-r-[4px] bg-[var(--chart-series-1)] transition-colors group-hover:bg-[var(--chart-series-1-hover)] group-focus-visible:bg-[var(--chart-series-1-hover)]"
                  style={{ width: `${Math.max(0.75, (d.value / max) * 82)}%` }}
                />
                <span className="tabular shrink-0 text-xs text-ink-2">{d.display}</span>
              </span>
              <Tooltip value={d.display} label={d.label} className="left-[7rem] top-[-2.6rem] sm:left-[8rem]" />
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

export type ColumnDatum = { id: string; label: string; value: number };

export function ColumnChart({ data, title, description, unit }: { data: ColumnDatum[]; title: string; description?: string; unit: string }) {
  const max = Math.max(...data.map((d) => d.value), 0) || 1;
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const peak = data.reduce<ColumnDatum | null>((best, d) => (!best || d.value > best.value ? d : best), null);
  const mid = data.length > 2 ? data[Math.floor((data.length - 1) / 2)] : null;
  return (
    <figure className="w-full">
      <Caption title={title} description={description} />
      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--chart-muted)]">No data yet.</p>
      ) : (
        <div className="flex gap-2 pt-2">
          <div className="tabular relative h-44 w-6 shrink-0 text-right text-[11px] text-[var(--chart-muted)]" aria-hidden>
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-44">
              {ticks.map((t) => (
                <div key={t} className="absolute inset-x-0 border-t border-[var(--chart-grid)]" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden />
              ))}
              <ol className="absolute inset-0 flex items-end justify-between gap-[2px] border-b border-[var(--chart-axis)]" aria-label={title}>
                {data.map((d) => {
                  const h = (d.value / top) * 100;
                  return (
                    <li
                      key={d.id}
                      tabIndex={0}
                      aria-label={`${d.label}: ${d.value} ${unit}`}
                      className="group relative flex h-full max-w-6 flex-1 items-end justify-center rounded-t-[4px] outline-none"
                    >
                      {d.id === peak?.id ? (
                        <span className="tabular absolute left-1/2 -translate-x-1/2 text-[11px] font-medium text-ink-2" style={{ bottom: `calc(${h}% + 4px)` }} aria-hidden>
                          {d.value}
                        </span>
                      ) : null}
                      <span
                        className="w-full rounded-t-[4px] bg-[var(--chart-series-1)] transition-colors group-hover:bg-[var(--chart-series-1-hover)] group-focus-visible:bg-[var(--chart-series-1-hover)]"
                        style={{ height: `${h}%`, minHeight: d.value > 0 ? 2 : 0 }}
                        aria-hidden
                      />
                      <Tooltip value={`${d.value} ${unit}`} label={d.label} className="left-1/2 -translate-x-1/2" style={{ bottom: `calc(${h}% + 8px)` }} />
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="relative mt-1.5 flex justify-between text-[11px] text-[var(--chart-muted)]" aria-hidden>
              <span>{data[0]?.label}</span>
              {mid ? <span className="absolute left-1/2 -translate-x-1/2">{mid.label}</span> : null}
              {data.length > 1 ? <span>{data[data.length - 1]?.label}</span> : null}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}

function niceTicks(max: number): number[] {
  const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10;
  const out: number[] = [];
  for (let t = 0; t < max + step; t += step) out.push(t);
  return out;
}
