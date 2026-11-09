export const COLOR_SLOTS = 12;

/** The least-used colour, lowest first, so each category gets its own until all 12 are taken. */
export function freeSlot(used: number[]): number {
  const count = (s: number) => used.filter((u) => u === s).length;
  return Array.from({ length: COLOR_SLOTS }, (_, i) => i).sort((a, b) => count(a) - count(b) || a - b)[0];
}

/** Gives duplicate colours a free one. The first category with a colour keeps it. */
export function dedupeSlots<T extends { id: string; colorSlot: number }>(cats: T[]): { id: string; colorSlot: number }[] {
  const taken = new Set<number>();
  const changes: { id: string; colorSlot: number }[] = [];
  const dupes: T[] = [];
  for (const c of cats) {
    if (taken.has(c.colorSlot) || c.colorSlot >= COLOR_SLOTS) dupes.push(c);
    else taken.add(c.colorSlot);
  }
  for (const c of dupes) {
    const free = Array.from({ length: COLOR_SLOTS }, (_, i) => i).find((i) => !taken.has(i));
    if (free === undefined) break;
    taken.add(free);
    changes.push({ id: c.id, colorSlot: free });
  }
  return changes;
}
