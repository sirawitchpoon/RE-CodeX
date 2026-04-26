// Level math for Re:CodeX.
//
// Curve: cumulative XP required to *reach* a given level
//   xpForLevel(L) = curveLinear * L + curveQuadratic * L^2
//
// Level 0 starts at 0 XP. Examples with defaults (1000, 250):
//   L=1  →  1,250 XP
//   L=10 → 35,000 XP
//   L=30 → 255,000 XP
//   L=50 → 675,000 XP

export interface LevelCurveConfig {
  curveLinear: number;
  curveQuadratic: number;
}

export function xpForLevel(level: number, cfg: LevelCurveConfig): number {
  if (level <= 0) return 0;
  return cfg.curveLinear * level + cfg.curveQuadratic * level * level;
}

/**
 * Highest level L such that xpForLevel(L, cfg) <= xp.
 * Binary search; the curve is strictly increasing for level >= 0.
 */
export function levelForXp(xp: number | bigint, cfg: LevelCurveConfig): number {
  const xpNum = typeof xp === "bigint" ? Number(xp) : xp;
  if (xpNum <= 0) return 0;

  let lo = 0;
  let hi = 1;
  while (xpForLevel(hi, cfg) <= xpNum) {
    hi *= 2;
    if (hi > 1_000_000) break;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (xpForLevel(mid, cfg) <= xpNum) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

export interface LevelProgress {
  level: number;
  xpInto: number;
  xpToNext: number;
  pct: number;
}

export function progressToNext(xp: number | bigint, cfg: LevelCurveConfig): LevelProgress {
  const xpNum = typeof xp === "bigint" ? Number(xp) : xp;
  const level = levelForXp(xpNum, cfg);
  const base = xpForLevel(level, cfg);
  const next = xpForLevel(level + 1, cfg);
  const span = next - base;
  const xpInto = xpNum - base;
  return {
    level,
    xpInto,
    xpToNext: next - xpNum,
    pct: span > 0 ? Math.min(1, xpInto / span) : 0,
  };
}
