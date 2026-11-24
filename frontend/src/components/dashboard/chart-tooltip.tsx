'use client';

/**
 * Shared Recharts tooltip styled with the design tokens.
 * Typed loosely on purpose: Recharts' TooltipContentProps is tied to the
 * generic chart payload, and the tooltip only reads `active`/`payload`/`label`.
 */
interface TooltipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: string | number;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
}

export const ChartTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 shadow-raised">
      {label !== undefined && label !== '' ? (
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">{String(label)}</p>
      ) : null}
      {payload.map((entry, index) => (
        <p key={`${entry.dataKey ?? index}`} className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color ?? 'var(--color-primary)' }}
          />
          {String(entry.name ?? entry.dataKey)}: {entry.value}
        </p>
      ))}
    </div>
  );
};
