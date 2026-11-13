export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

/** Deterministic pseudo-random generator so every run of a phase is fair. */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Cubic hermite spline through control points, used for smooth clinical curves. */
export function sampleSpline(points: { x: number; y: number }[], x: number): number {
  const n = points.length;
  if (n === 0) return 0;
  if (x <= points[0].x) return points[0].y;
  if (x >= points[n - 1].x) return points[n - 1].y;
  let i = 0;
  while (i < n - 2 && points[i + 1].x < x) i++;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[i + 1];
  const p3 = points[Math.min(n - 1, i + 2)];
  const t = (x - p1.x) / (p2.x - p1.x);
  const t2 = t * t;
  const t3 = t2 * t;
  const y =
    0.5 *
    (2 * p1.y +
      (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return y;
}

export function formatDb(db: number): string {
  return `${db > 0 ? '+' : ''}${db.toFixed(0)} dB`;
}

export function formatDaPa(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(0)} daPa`;
}
