import type { Category } from '../domain/types';

const MAX_SEGMENTS = 5;

/**
 * Your month as one strip: its full length is your income, and each category
 * takes a share of it. The open part on the right is what's left.
 */
export function MonthStrip({ incomeCents, expenseCents, spend, categoryById, money }: {
  incomeCents: number; expenseCents: number; spend: Map<string, number>;
  categoryById: Map<string, Category>; money: (c: number) => string;
}) {
  const sorted = [...spend.entries()].sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, MAX_SEGMENTS);
  const rest = sorted.slice(MAX_SEGMENTS).reduce((s, [, v]) => s + v, 0);
  const whole = Math.max(incomeCents, expenseCents, 1);
  const left = Math.max(incomeCents - expenseCents, 0);

  const segments = [
    ...head.map(([id, cents]) => {
      const c = categoryById.get(id);
      return { id, name: c?.name ?? 'Uncategorized', cents, color: `var(--series-${(c?.colorSlot ?? 6) + 1})` };
    }),
    ...(rest > 0 ? [{ id: 'rest', name: 'Everything else', cents: rest, color: 'var(--muted)' }] : []),
  ];

  return (
    <div>
      <div
        className="strip"
        role="img"
        aria-label={`Spent ${money(expenseCents)} of ${money(incomeCents)} income`}
      >
        {segments.map((s) => (
          <span key={s.id} style={{ flexGrow: s.cents / whole, background: s.color }} title={`${s.name}: ${money(s.cents)}`} />
        ))}
        {left > 0 && <span className="strip-left" style={{ flexGrow: left / whole }} />}
        {!segments.length && !left && <span className="strip-left" style={{ flexGrow: 1 }} />}
      </div>
      {segments.length > 0 && (
        <ul className="legend">
          {segments.map((s) => (
            <li key={s.id}>
              <span className="dot" style={{ background: s.color }} aria-hidden />
              {s.name} <span className="num muted">{money(s.cents)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
