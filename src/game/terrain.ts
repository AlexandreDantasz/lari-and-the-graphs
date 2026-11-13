import { Marker } from './types';
import { makeRng, sampleSpline, clamp } from './utils';

export interface Gap {
  start: number;
  end: number;
}

export interface Terrain {
  length: number;
  yAt: (x: number) => number;
  slopeAt: (x: number) => number;
  markers: Marker[];
  labelAt: (x: number) => string;
  gaps: Gap[];
  minY: number;
  maxY: number;
}

interface ControlPoint {
  x: number;
  y: number;
}

function buildTerrain(
  length: number,
  controls: ControlPoint[],
  markers: Marker[],
  labelAt: (x: number) => string,
  gaps: Gap[] = [],
  lutStep = 8,
): Terrain {
  const lut: number[] = [];
  const raw = (x: number): number => sampleSpline(controls, x);
  for (let x = 0; x <= length + lutStep; x += lutStep) {
    lut.push(raw(x));
  }
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of lut) {
    minY = Math.min(minY, v);
    maxY = Math.max(maxY, v);
  }
  const yAt = (x: number): number => {
    const cx = clamp(x, 0, length);
    const idx = cx / lutStep;
    const i = Math.floor(idx);
    const f = idx - i;
    return lut[i] * (1 - f) + lut[Math.min(i + 1, lut.length - 1)] * f;
  };
  const slopeAt = (x: number): number => (yAt(x + 6) - yAt(x - 6)) / 12;
  return { length, yAt, slopeAt, markers, labelAt, gaps, minY, maxY };
}

const dbToY = (db: number): number => (95 - clamp(db, -10, 120)) * 1.7;

/** Fase 1 — audiograma: limiares OD (O) / OE (X) de 250Hz a 8000Hz. */
/**
 * Um obstáculo de ruído só é justo se a Lari estiver no chão com controle total:
 * terreno plano/gentil, longe da zona de pouso após abismos e quedas bruscas e
 * longe dos marcadores de limiar (para não conflitar com o salto do impulso).
 */
export function isSafeObstacleSpot(terrain: Terrain, x: number): boolean {
  for (const dx of [-70, -35, 0, 35, 70]) {
    if (Math.abs(terrain.slopeAt(x + dx)) > 0.5) return false;
  }
  for (const g of terrain.gaps) {
    if (x > g.start - 520 && x < g.end + 420) return false;
  }
  for (const m of terrain.markers) {
    if (Math.abs(x - m.x) < 240) return false;
  }
  return true;
}

export function createAudiometryTerrain(seed: number, length: number): Terrain {
  const rng = makeRng(seed);
  const freqs = [250, 500, 1000, 2000, 4000, 8000];
  const x0 = 420;
  const spacing = (length - x0 - 260) / (freqs.length - 1);
  const controls: ControlPoint[] = [{ x: 0, y: dbToY(10) }];
  const markers: Marker[] = [];
  const gaps: Gap[] = [];
  let db = 10;
  freqs.forEach((_hz, i) => {
    const x = x0 + i * spacing;
    const roll = rng();
    let delta = 0;
    if (i >= 3) {
      delta = roll < 0.45 ? 30 + rng() * 25 : roll < 0.7 ? 10 : -5;
    } else {
      delta = roll < 0.25 ? 15 : roll < 0.5 ? -10 : 0;
    }
    db = clamp(db + delta, 0, 90);
    if (i > 0) db = Math.max(db, 5);
    if (i > 0 && delta >= 25) {
      gaps.push({ start: x - spacing * 0.22, end: x - spacing * 0.08 });
    }
    controls.push({ x: x - spacing * 0.45, y: dbToY(db) + (rng() - 0.5) * 8 });
    controls.push({ x, y: dbToY(db) });
    markers.push({
      x,
      y: dbToY(db),
      label: i % 2 === 0 ? 'O' : 'X',
      kind: 'threshold',
      hit: false,
      missed: false,
      signaled: false,
      window: spacing * 0.12,
    });
  });
  controls.push({ x: length, y: dbToY(5) });
  return buildTerrain(length, controls, markers, (x) => {
    const i = clamp(Math.round((x - x0) / spacing), 0, freqs.length - 1);
    return `${freqs[i]} Hz`;
  }, gaps);
}

const TYPANO_TYPES = [
  { id: 'A', height: 1.0, peakAt: 0 },
  { id: 'As', height: 0.38, peakAt: 0 },
  { id: 'Ad', height: 1.65, peakAt: 0 },
  { id: 'B', height: 0.06, peakAt: -100 },
  { id: 'C', height: 1.05, peakAt: -200 },
] as const;

const pressureToY = (daPa: number): number => 30 + clamp(daPa, -400, 200) * 0.06;

/** Fase 2 — timpanograma: tipos A, As, Ad, B e C entre -400 e +200 daPa. */
export function createTympanometryTerrain(seed: number, length: number): Terrain {
  const rng = makeRng(seed);
  const order = ['A', 'As', 'Ad', 'B', 'C'] as const;
  const start = 380;
  const segLen = (length - start - 240) / order.length;
  const controls: ControlPoint[] = [{ x: 0, y: pressureToY(-320) }];
  const markers: Marker[] = [];
  const gaps: Gap[] = [];

  order.forEach((id, i) => {
    const type = TYPANO_TYPES.find((t) => t.id === id)!;
    const sx = start + i * segLen;
    const jitter = (rng() - 0.5) * 30;
    const steps = 10;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const pressure = -400 + t * 600;
      const dist = (pressure - type.peakAt) / 150;
      const compliance = type.height * Math.exp(-dist * dist);
      const y = pressureToY(pressure) + compliance * 78 + jitter * (1 - Math.abs(t - 0.5));
      controls.push({ x: sx + t * segLen, y });
    }
    const peakPressure = type.peakAt;
    const peakT = (peakPressure + 400) / 600;
    markers.push({
      x: sx + peakT * segLen,
      y: pressureToY(peakPressure) + type.height * 78 + jitter * 0.5,
      label: `Tipo ${id}`,
      kind: 'peak',
      hit: false,
      missed: false,
      signaled: false,
      window: segLen * 0.12,
    });
    if (id === 'B') {
      gaps.push({ start: sx + segLen * 0.3, end: sx + segLen * 0.72 });
    }
  });

  controls.push({ x: length, y: pressureToY(-200) });
  return buildTerrain(length, controls, markers, (x) => {
    const i = clamp(Math.floor((x - start) / segLen), 0, order.length - 1);
    const local = ((x - start - i * segLen) / segLen) * 600 - 400;
    return `Tipo ${order[i]} · ${local > 0 ? '+' : ''}${local.toFixed(0)} daPa`;
  });
}

/** Fase 3 — ondas sonoras sobre um traçado de imitanciometria pulsante. */
export function createReflexTerrain(seed: number, length: number): Terrain {
  const rng = makeRng(seed);
  const controls: ControlPoint[] = [];
  const baseY = 70;
  for (let x = 0; x <= length; x += 160) {
    const y =
      baseY +
      Math.sin(x * 0.006 + seed) * 16 +
      Math.sin(x * 0.017 + seed * 2) * 7 +
      (rng() - 0.5) * 6;
    controls.push({ x, y });
  }
  const markers: Marker[] = [];
  return buildTerrain(length, controls, markers, () => 'Imitanciometria · Reflexo do estapédio');
}
