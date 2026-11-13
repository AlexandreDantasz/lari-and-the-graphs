import { makeRng, clamp, lerp } from './utils';

/**
 * Fase 2 — Timpanometria (Calibração de Pressão & Complacência).
 * A Lari guia a sonda ao longo do eixo de pressão (-400 a +200 daPa) numa
 * varredura automática; segurar aumenta a pressão positiva (curva sobe) e
 * soltar reduz (curva desce). É preciso manter o traçado dentro da faixa
 * tracejada alvo, estabilizando no pico no momento certo — com as 5
 * classificações de Jerger tendo comportamentos distintos.
 */

export type JergerId = 'A' | 'As' | 'Ad' | 'B' | 'C';

export interface JergerSpec {
  id: JergerId;
  name: string;
  height: number;
  peak: number;
  width: number;
  tol: number;
  sweepSpeed: number;
  passRatio: number;
  hint: string;
}

export const JERGER_SPECS: JergerSpec[] = [
  {
    id: 'A',
    name: 'Tipo A (Normal)',
    height: 0.62,
    peak: 0,
    width: 110,
    tol: 0.09,
    sweepSpeed: 95,
    passRatio: 0.55,
    hint: 'Pico agudo centrado em 0 daPa — suba e desça com o ritmo da varredura.',
  },
  {
    id: 'As',
    name: 'Tipo As (Rígida/Baixa)',
    height: 0.3,
    peak: 0,
    width: 125,
    tol: 0.06,
    sweepSpeed: 90,
    passRatio: 0.55,
    hint: 'Pico baixo: controle fino! Toques curtos para não passar da altura.',
  },
  {
    id: 'Ad',
    name: 'Tipo Ad (Hipermóvel/Alta)',
    height: 0.95,
    peak: 0,
    width: 72,
    tol: 0.06,
    sweepSpeed: 105,
    passRatio: 0.5,
    hint: 'Pico muito alto e estreito: segure no timing exato do centro!',
  },
  {
    id: 'B',
    name: 'Tipo B (Plana/Sem pico)',
    height: 0.08,
    peak: -100,
    width: 420,
    tol: 0.05,
    sweepSpeed: 68,
    passRatio: 0.62,
    hint: 'Linha quase reta e baixa: estabilidade constante, sem oscilar!',
  },
  {
    id: 'C',
    name: 'Tipo C (Pressão Negativa)',
    height: 0.62,
    peak: -225,
    width: 92,
    tol: 0.08,
    sweepSpeed: 100,
    passRatio: 0.55,
    hint: 'Pico deslocado à esquerda (-150 a -300 daPa): antecipe bem antes do centro!',
  },
];

export const TYMP_P_MIN = -400;
export const TYMP_P_MAX = 200;

export interface TracePoint {
  p: number;
  c: number;
  inBand: boolean;
}

export interface TympTypeResult {
  id: JergerId;
  accuracy: number;
  passed: boolean;
  peakLocked: boolean;
  oscillations: number;
}

export type TympState = 'sweeping' | 'break' | 'done';

/** Alvo de complacência normalizado (0..1) do tipo em uma dada pressão. */
export function targetCompliance(spec: JergerSpec, p: number): number {
  const d = (p - spec.peak) / spec.width;
  return spec.height * Math.exp(-d * d);
}

export class TympScan {
  readonly types: JergerSpec[];
  private typeIndex = 0;
  private state: TympState = 'sweeping';
  private breakTimer = 0;
  private pressure = TYMP_P_MIN;
  private compliance = 0.02;
  private holding = false;
  private trace: TracePoint[] = [];
  private inBandTime = 0;
  private totalTime = 0;
  private outFor = 0;
  private oscillCooldown = 0;
  private oscillations = 0;
  private peakLocked = false;
  private results: TympTypeResult[] = [];
  private rng: () => number;

  constructor(seed: number) {
    this.rng = makeRng(seed);
    this.types = JERGER_SPECS.map((s) =>
      s.id === 'C' ? { ...s, peak: -150 - Math.floor(this.rng() * 150) } : { ...s },
    );
  }

  get spec(): JergerSpec {
    return this.types[this.typeIndex];
  }

  get currentState(): TympState {
    return this.state;
  }

  get currentPressure(): number {
    return this.pressure;
  }

  get currentCompliance(): number {
    return this.compliance;
  }

  get isHolding(): boolean {
    return this.holding;
  }

  get tracePoints(): TracePoint[] {
    return this.trace;
  }

  get typeResults(): TympTypeResult[] {
    return this.results;
  }

  get overallProgress(): number {
    const perType = 1 / this.types.length;
    const done = this.results.length;
    const partial =
      this.state === 'sweeping'
        ? ((this.pressure - TYMP_P_MIN) / (TYMP_P_MAX - TYMP_P_MIN)) * perType
        : 0;
    return clamp(done * perType + partial, 0, 1);
  }

  get finished(): boolean {
    return this.results.length === this.types.length && this.state === 'done';
  }

  setHolding(holding: boolean): void {
    this.holding = holding;
  }

  /** Retorna eventos: 'oscillation' | 'peak' | 'typeDone' | null */
  update(dt: number): 'oscillation' | 'peak' | 'typeDone' | null {
    if (this.state === 'break') {
      this.breakTimer -= dt;
      if (this.breakTimer <= 0) {
        if (this.results.length >= this.types.length) {
          this.state = 'done';
          return null;
        }
        this.beginType();
      }
      return null;
    }
    if (this.state === 'done') return null;

    this.pressure += this.spec.sweepSpeed * dt;
    this.compliance = clamp(
      this.compliance + (this.holding ? 0.55 : -0.75) * dt,
      0.02,
      1.05,
    );

    const target = targetCompliance(this.spec, this.pressure);
    const inBand = Math.abs(this.compliance - target) <= this.spec.tol;
    this.trace.push({ p: this.pressure, c: this.compliance, inBand });
    if (this.trace.length > 900) this.trace.shift();

    this.totalTime += dt;
    this.oscillCooldown = Math.max(0, this.oscillCooldown - dt);

    if (inBand) {
      this.inBandTime += dt;
      this.outFor = 0;
      if (!this.peakLocked && Math.abs(this.pressure - this.spec.peak) < this.spec.width * 0.45) {
        this.peakLocked = true;
        return 'peak';
      }
    } else {
      this.outFor += dt;
      if (this.outFor > 0.3 && this.oscillCooldown <= 0) {
        this.oscillCooldown = 1.1;
        this.oscillations += 1;
        return 'oscillation';
      }
    }

    if (this.pressure >= TYMP_P_MAX) {
      this.finishType();
      return 'typeDone';
    }
    return null;
  }

  private beginType(): void {
    this.state = 'sweeping';
    this.pressure = TYMP_P_MIN;
    this.compliance = 0.02;
    this.trace = [];
    this.inBandTime = 0;
    this.totalTime = 0;
    this.outFor = 0;
    this.oscillCooldown = 0;
    this.oscillations = 0;
    this.peakLocked = false;
  }

  private finishType(): void {
    const accuracy = this.totalTime > 0 ? this.inBandTime / this.totalTime : 0;
    this.results.push({
      id: this.spec.id,
      accuracy,
      passed: accuracy >= this.spec.passRatio,
      peakLocked: this.peakLocked,
      oscillations: this.oscillations,
    });
    this.typeIndex = Math.min(this.typeIndex + 1, this.types.length - 1);
    this.state = 'break';
    this.breakTimer = 1.6;
  }

  label(): string {
    if (this.state === 'break') {
      const last = this.results[this.results.length - 1];
      return last ? `${last.id === 'C' ? 'Tipo C' : `Tipo ${last.id}`} · ${last.passed ? 'aprovado' : 'reprovado'}` : '';
    }
    return `Tipo ${this.spec.id} · ${this.pressure > 0 ? '+' : ''}${this.pressure.toFixed(0)} daPa`;
  }

  hint(): string {
    if (this.state !== 'sweeping') return '';
    return this.spec.hint;
  }
}

export const tympLerp = lerp;
