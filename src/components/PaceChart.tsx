/**
 * Spending so far this month, day by day, against the month before. Drawn as plain SVG so
 * Home stays light. The sentence above it carries the takeaway; the chart shows the shape.
 */
const W = 320, H = 96, PAD = 4, DAYS = 31;

export function PaceChart({ current, previous, currentName, previousName, money }: {
  /** Running total for each day so far (index 0 is day 1). */
  current: number[];
  /** Running total for every day of the month before. */
  previous: number[];
  currentName: string;
  previousName: string;
  money: (c: number) => string;
}) {
  const max = Math.max(current.at(-1) ?? 0, previous.at(-1) ?? 0, 1);
  const x = (i: number) => PAD + (i / (DAYS - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2 - 6);
  const line = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  const day = current.length;
  const now = current.at(-1) ?? 0;
  const then = previous.length ? previous[Math.min(day, previous.length) - 1] : 0;
  const hasPrev = (previous.at(-1) ?? 0) > 0;
  const diff = now - then;

  return (
    <div className="pace">
      <p className="pace-line">
        {!hasPrev ? `No spending in ${previousName} to compare with.`
          : diff === 0 ? `The same as at this point in ${previousName}.`
          : <><strong>{money(Math.abs(diff))} {diff > 0 ? 'more' : 'less'}</strong> than at this point in {previousName}.</>}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`${currentName}: ${money(now)} spent by day ${day}. ${hasPrev ? `${previousName}: ${money(then)} by the same day.` : ''}`}>
        <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="pace-base" />
        {hasPrev && <path d={line(previous)} className="pace-prev" />}
        {day > 0 && <path d={line(current)} className="pace-cur" pathLength={1} />}
        {day > 0 && <circle cx={x(day - 1)} cy={y(now)} r={4.5} className="pace-dot" />}
      </svg>
      <div className="pace-legend">
        <span><i className="pace-key cur" />{currentName}</span>
        {hasPrev && <span><i className="pace-key prev" />{previousName}</span>}
      </div>
    </div>
  );
}
