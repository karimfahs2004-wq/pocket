import { useEffect, useRef, useState } from 'react';

/**
 * Counts from the last shown value up (or down) to `target`, so numbers feel alive when the
 * screen opens or a total changes. Skipped when the phone asks for reduced motion.
 */
export function useCountUp(target: number, ms = 600): { value: number; settled: boolean } {
  const [value, setValue] = useState(0);
  const shown = useRef(0);

  useEffect(() => {
    const from = shown.current;
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (still || from === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(Math.max((now - start) / ms, 0), 1);
      const eased = 1 - (1 - t) ** 3;
      shown.current = Math.round(from + (target - from) * eased);
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  return { value, settled: value === target };
}
