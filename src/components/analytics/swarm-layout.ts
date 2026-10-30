// Beeswarm placement for pillar-beeswarm.tsx, kept free of React so the placement rules run under node:test.

const PAD = 12;
const MAX_BAND = 130;
const RADII = [3, 2.5, 2, 1.6, 1.25];

/**
 * x is fixed by the score. y is the smallest offset from the center line that keeps every dot
 * at least one diameter from the dots already placed. xs must be sorted ascending.
 */
export function placeSwarm(xs: number[], radius: number) {
  const gap = radius * 2 + 0.6;
  const gapSquared = gap * gap - 0.01;
  const ys = new Array<number>(xs.length).fill(0);
  let start = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const x = xs[i];
    while (start < i && x - xs[start] >= gap) start += 1;
    const isFree = (y: number) => {
      for (let j = start; j < i; j += 1) {
        const dx = x - xs[j];
        const dy = y - ys[j];
        if (dx * dx + dy * dy < gapSquared) return false;
      }
      return true;
    };

    if (isFree(0)) continue;
    const candidates: number[] = [];
    for (let j = start; j < i; j += 1) {
      const dx = x - xs[j];
      const dy = Math.sqrt(Math.max(0, gap * gap - dx * dx));
      candidates.push(ys[j] + dy, ys[j] - dy);
    }
    candidates.sort((a, b) => Math.abs(a) - Math.abs(b));
    ys[i] = candidates.find(isFree) ?? candidates[candidates.length - 1];
  }
  return ys;
}

export type SwarmDot<T> = T & {
  x: number;
  /** Offset from the center line, in pixels. */
  y: number;
  /** 1 is the highest score. Ties share a rank. */
  rank: number;
};

export type SwarmLayout<T> = {
  /** Sorted by score, lowest first, so x is ascending. */
  dots: SwarmDot<T>[];
  radius: number;
  /** Half the band height: the farthest dot from the center line, plus its radius. */
  half: number;
  toX: (value: number) => number;
};

/**
 * Places one dot per score on a 0 to 100 axis `width` pixels wide. Tries the largest dot radius
 * first and shrinks it until the band fits `maxBand` pixels. If even the smallest radius does not
 * fit, dots past the band fold back into it and may overlap.
 */
export function layoutSwarm<T extends { value: number }>(
  points: T[],
  width: number,
  maxBand = MAX_BAND,
): SwarmLayout<T> {
  const toX = (value: number) => PAD + (Math.min(100, Math.max(0, value)) / 100) * (width - PAD * 2);
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const xs = sorted.map((point) => toX(point.value));

  let radius = RADII[RADII.length - 1];
  let ys: number[] = [];
  let extent = 0;
  for (const candidate of RADII) {
    radius = candidate;
    ys = placeSwarm(xs, candidate);
    extent = ys.reduce((max, y) => Math.max(max, Math.abs(y)), 0);
    if ((extent + candidate) * 2 <= maxBand) break;
  }

  // A pile of identical scores can need more height than any radius gives. Fold the overflow back
  // into the band so the row keeps its height; the pile then reads as one dense column.
  const limit = maxBand / 2 - radius;
  if (extent > limit) {
    const span = limit * 2;
    ys = ys.map((y) => (Math.abs(y) <= limit ? y : ((((y + limit) % span) + span) % span) - limit));
    extent = limit;
  }

  const total = sorted.length;
  const ranks = new Array<number>(total);
  let rank = 1;
  for (let i = total - 1; i >= 0; i -= 1) {
    if (i < total - 1 && sorted[i].value !== sorted[i + 1].value) rank = total - i;
    ranks[i] = rank;
  }

  const dots = sorted.map((point, index) => ({
    ...point,
    x: Math.round(xs[index] * 100) / 100,
    y: Math.round(ys[index] * 100) / 100,
    rank: ranks[index],
  }));
  return { dots, radius, half: extent + radius, toX };
}

/**
 * The dot closest to (x, y) within `maxDistance`, or null. `dots` must be sorted by x, as
 * layoutSwarm returns them; y is measured from the same center line as the dots' y.
 */
export function nearestDot<T extends { x: number; y: number }>(
  dots: T[],
  x: number,
  y: number,
  maxDistance: number,
): T | null {
  let low = 0;
  let high = dots.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (dots[middle].x < x) low = middle + 1;
    else high = middle;
  }

  let best: T | null = null;
  let bestSquared = maxDistance * maxDistance;
  // Walk outward from the insertion point in both directions, stopping once x alone is too far.
  for (const step of [1, -1]) {
    for (let i = step === 1 ? low : low - 1; i >= 0 && i < dots.length; i += step) {
      const dx = dots[i].x - x;
      if (dx * dx > bestSquared) break;
      const dy = dots[i].y - y;
      const squared = dx * dx + dy * dy;
      if (squared <= bestSquared) {
        bestSquared = squared;
        best = dots[i];
      }
    }
  }
  return best;
}
