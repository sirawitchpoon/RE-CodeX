// Winner selection. Fisher-Yates shuffle over eligible entries; deterministic
// pure function so it can be unit-tested with a seeded RNG. The route handler
// does the DB transaction (mark isWinner=true) — this stays pure.

export interface DrawableEntry {
  id: bigint;
  userId: string;
}

export interface DrawOptions {
  /** Number of winners to pick. Capped at entries.length. */
  n: number;
  /** Optional RNG; defaults to Math.random for prod. */
  rng?: () => number;
}

export function drawWinners<E extends DrawableEntry>(
  entries: readonly E[],
  { n, rng = Math.random }: DrawOptions,
): E[] {
  const k = Math.min(n, entries.length);
  if (k <= 0) return [];

  const arr = entries.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr.slice(0, k);
}
