import { AudiometerSynth } from './audio/AudiometerSynth';
import { InputController } from './input';
import { createAudiometryTerrain, createReflexTerrain, Terrain } from './terrain';
import { buildLariSpriteSheet, LARI_FRAMES, LariSpriteSheet, SPRITE_H, SPRITE_W } from './sprites/lari';
import { ClinicScene } from './three/clinic';
import { TympScan } from './tympanometry';
import {
  FREQUENCIES_HZ,
  HudState,
  LariMood,
  Marker,
  PHASES,
  PhaseId,
  PhaseResult,
  Wave,
} from './types';
import { clamp, lerp, makeRng } from './utils';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Heart {
  x: number;
  y: number;
  vy: number;
  wobble: number;
  life: number;
  maxLife: number;
  size: number;
}

interface Collectible {
  x: number;
  y: number;
  taken: boolean;
}

interface LariState {
  x: number;
  y: number;
  vy: number;
  speed: number;
  grounded: boolean;
  diving: boolean;
  holding: boolean;
}

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GRAVITY = 1500;
const DIVE_GRAVITY = 2600;
const JUMP_V = 580;
const BOOST_V = 660;
const BASE_SPEED = 250;
const MAX_SPEED = 620;

const IRRITATION_ON_MISS = 12;
const IRRITATION_ON_WAVE_HIT = 14;
const IRRITATION_ON_GAP_FALL = 10;
const IRRITATION_ON_OSCILLATION = 8;
const IRRITATION_DECAY = 0.8;
const IRRITATION_MAX = 100;

const PHASE_ORDER: PhaseId[] = ['audiometria', 'timpanometria', 'reflexo'];

const HEART_MATRIX = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'];

export class GameEngine {
  private container: HTMLElement;
  private onState: (s: HudState) => void;
  private threeCanvas: HTMLCanvasElement;
  private overlay: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private clinic: ClinicScene;
  private synth = new AudiometerSynth();
  private sprites: LariSpriteSheet;
  private input: InputController | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private raf = 0;
  private lastTime = 0;
  private running = false;
  private disposed = false;

  private width = 800;
  private height = 600;
  private isPortrait = false;
  private readonly hasTouch: boolean;

  private screen: HudState['screen'] = 'menu';
  private phaseIndex = 0;
  private terrain: Terrain = createReflexTerrain(1, 1000);
  private tymp: TympScan | null = null;
  private lari: LariState = {
    x: 0,
    y: 0,
    vy: 0,
    speed: BASE_SPEED,
    grounded: true,
    diving: false,
    holding: false,
  };
  private camY = 0;
  private camShake = 0;
  private animTime = 0;
  private cheerTimer = 0;
  private shieldTimer = 0;
  private waves: Wave[] = [];
  private waveTimer = 0;
  private waveInterval = 1.7;
  private particles: Particle[] = [];
  private hearts: Heart[] = [];
  private collectibles: Collectible[] = [];
  private lastFreqIndex = -1;
  private phaseSeed = 7;

  private irritation = 0;
  private score = 0;
  private hits = 0;
  private misses = 0;
  private combo = 1;
  private perfectCount = 0;
  private maxSpeedSeen = 0;
  private results: PhaseResult[] = [];
  private message = '';
  private messageTimer = 0;
  private messageKey = 0;
  private hudTimer = 0;
  private muted = false;

  constructor(container: HTMLElement, onState: (s: HudState) => void) {
    this.container = container;
    this.onState = onState;
    this.hasTouch =
      'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

    this.threeCanvas = document.createElement('canvas');
    this.threeCanvas.className = 'canvas-3d';
    container.appendChild(this.threeCanvas);

    this.overlay = document.createElement('canvas');
    this.overlay.className = 'canvas-overlay';
    container.appendChild(this.overlay);
    const ctx = this.overlay.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D não suportado neste navegador');
    this.ctx = ctx;

    this.clinic = new ClinicScene(this.threeCanvas);
    this.sprites = buildLariSpriteSheet();
    this.terrain = createReflexTerrain(this.phaseSeed, PHASES.reflexo.length);

    this.input = new InputController(container, {
      onPressStart: (source) => this.handlePressStart(source),
      onPressEnd: (source) => this.handlePressEnd(source),
      onShield: () => this.handleShield(),
      onDiveKey: (down) => {
        this.lari.diving = down;
      },
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.pushState(true);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (t: number): void => {
      if (!this.running || this.disposed) return;
      const dt = clamp((t - this.lastTime) / 1000, 0, 1 / 30);
      this.lastTime = t;
      this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  dispose(): void {
    this.running = false;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    this.input?.dispose();
    this.clinic.dispose();
    this.threeCanvas.remove();
    this.overlay.remove();
  }

  // ---- Ações públicas (chamadas pelo React/HUD) ----

  beginRun(): void {
    this.synth.unlock();
    this.score = 0;
    this.hits = 0;
    this.misses = 0;
    this.combo = 1;
    this.perfectCount = 0;
    this.irritation = 0;
    this.results = [];
    this.phaseIndex = 0;
    this.startPhase('audiometria');
  }

  advanceFromResults(): void {
    const next = PHASE_ORDER[this.phaseIndex + 1];
    if (!next) {
      this.screen = 'finalReport';
      this.synth.gameComplete();
      this.pushState(true);
      return;
    }
    this.phaseIndex += 1;
    this.startPhase(next);
  }

  retryPhase(): void {
    this.synth.unlock();
    this.irritation = 35;
    this.hits = 0;
    this.misses = 0;
    this.combo = 1;
    this.perfectCount = 0;
    this.startPhase(PHASE_ORDER[this.phaseIndex]);
  }

  backToMenu(): void {
    this.screen = 'menu';
    this.irritation = 0;
    this.pushState(true);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.synth.setMuted(this.muted);
    this.pushState(true);
  }

  confirmPhaseIntro(): void {
    this.synth.unlock();
    if (this.screen === 'phaseIntro') this.startPlaying();
  }

  // ---- Fluxo de fases ----

  private startPhase(id: PhaseId): void {
    const config = PHASES[id];
    this.phaseSeed = (this.phaseSeed * 1103515245 + 12345) % 2147483647;

    if (id === 'timpanometria') {
      this.tymp = new TympScan(this.phaseSeed);
      this.terrain = createReflexTerrain(this.phaseSeed, 1200);
    } else {
      this.tymp = null;
      this.terrain =
        id === 'audiometria'
          ? createAudiometryTerrain(this.phaseSeed, config.length)
          : createReflexTerrain(this.phaseSeed, config.length);
    }

    this.lari = {
      x: 60,
      y: this.terrain.yAt(60),
      vy: 0,
      speed: BASE_SPEED,
      grounded: true,
      diving: false,
      holding: false,
    };
    this.camY = this.lari.y;
    this.waves = [];
    this.waveTimer = 0;
    this.waveInterval = 1.7;
    this.shieldTimer = 0;
    this.particles = [];
    this.hearts = [];
    this.collectibles = [];
    this.lastFreqIndex = -1;
    this.cheerTimer = 0;

    if (id !== 'timpanometria') {
      const rng = makeRng(this.phaseSeed + 99);
      for (let x = 520; x < this.terrain.length - 420; x += 280 + rng() * 140) {
        this.collectibles.push({
          x,
          y: this.terrain.yAt(x) + 44 + Math.sin(x * 0.01) * 20,
          taken: false,
        });
      }
    }

    this.screen = 'phaseIntro';
    this.setMessage(config.title, 2.2);
    this.synth.uiClick();
    if (id === 'audiometria') this.synth.playSweep();
    this.clinic.setProgress(0, id);
    this.pushState(true);
  }

  private startPlaying(): void {
    this.screen = 'playing';
    this.pushState(true);
  }

  private completePhase(): void {
    const id = PHASE_ORDER[this.phaseIndex];
    const result: PhaseResult = {
      phase: id,
      hits: this.hits,
      misses: this.misses,
      perfect: this.perfectCount,
      maxSpeed: Math.round(this.maxSpeedSeen),
      distance: Math.round(this.lari.x),
    };
    this.results = [...this.results, result];
    this.hits = 0;
    this.misses = 0;
    this.combo = 1;
    this.perfectCount = 0;
    this.maxSpeedSeen = 0;
    this.cheerTimer = 3.2;
    this.screen = 'phaseResults';
    this.clinic.onCorrect();
    this.spawnHearts(3);
    this.synth.phaseComplete();
    this.pushState(true);
  }

  private doGameOver(): void {
    this.irritation = IRRITATION_MAX;
    this.screen = 'gameOver';
    this.camShake = 1;
    this.clinic.onMiss();
    this.synth.gameOver();
    this.setMessage('O paciente perdeu a paciência!', 2);
    this.pushState(true);
  }

  // ---- Input ----

  private handlePressStart(source: 'pointer' | 'key'): void {
    this.synth.unlock();
    if (this.screen === 'phaseIntro') {
      this.startPlaying();
      return;
    }
    if (this.screen !== 'playing') return;
    const phase = PHASE_ORDER[this.phaseIndex];

    if (phase === 'reflexo') {
      this.handleShield();
      return;
    }

    this.lari.holding = true;
    if (phase === 'timpanometria') {
      this.tymp?.setHolding(true);
      return;
    }
    if (phase === 'audiometria') {
      const marker = this.pendingMarker();
      if (marker) {
        this.hitMarker(marker);
        return;
      }
    }
    if (this.lari.grounded) {
      this.lari.vy = JUMP_V;
      this.lari.grounded = false;
      this.synth.jump();
      this.spawnParticles(this.lari.x, this.lari.y, 6, '#ffffff');
    } else {
      this.lari.diving = true;
    }
    void source;
  }

  private handlePressEnd(source: 'pointer' | 'key'): void {
    this.lari.holding = false;
    this.lari.diving = false;
    this.tymp?.setHolding(false);
    void source;
  }

  private handleShield(): void {
    if (this.screen !== 'playing' || PHASE_ORDER[this.phaseIndex] !== 'reflexo') return;
    if (this.shieldTimer > 0) return;
    const glow = this.reflexGlow();
    this.shieldTimer = 0.65;
    this.synth.shield();
    if (glow > 0.2) {
      this.score += 60;
      this.combo = Math.min(this.combo + 1, 8);
      this.irritation = Math.max(0, this.irritation - 3);
      this.setMessage('Reflexo perfeito!', 1.1);
      this.clinic.onCorrect();
    } else {
      this.setMessage('Escudo ativo (fora de tempo)', 1.1);
    }
  }

  private pendingMarker(): Marker | null {
    for (const m of this.terrain.markers) {
      if (!m.hit && !m.missed && Math.abs(this.lari.x - m.x) <= m.window) return m;
    }
    return null;
  }

  private hitMarker(marker: Marker): void {
    marker.hit = true;
    this.hits += 1;
    const dx = Math.abs(this.lari.x - marker.x);
    const perfect = dx <= marker.window * 0.35;
    if (perfect) this.perfectCount += 1;
    this.score += Math.round((perfect ? 200 : 100) * this.combo);
    this.combo = Math.min(this.combo + 1, 8);
    this.irritation = Math.max(0, this.irritation - 4);
    this.lari.vy = BOOST_V;
    this.lari.grounded = false;
    this.lari.speed = Math.min(this.lari.speed + 110, MAX_SPEED);
    this.synth.hitThreshold(this.currentFrequency());
    this.clinic.onThresholdReached();
    this.spawnParticles(marker.x, marker.y, 14, perfect ? '#ffd54a' : '#7dff9b');
    this.setMessage(perfect ? 'PERFEITO! Impulso máximo' : 'Limiar capturado! +impulso', 1.2);
  }

  private currentFrequency(): number {
    const idx = clamp(
      Math.round((this.lari.x / this.terrain.length) * (FREQUENCIES_HZ.length - 1)),
      0,
      FREQUENCIES_HZ.length - 1,
    );
    return FREQUENCIES_HZ[idx];
  }

  private get lariMood(): LariMood {
    if (this.irritation < 30) return 'happy';
    if (this.irritation < 65) return 'neutral';
    return 'nervous';
  }

  // ---- Update ----

  private update(dt: number): void {
    this.animTime += dt;
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
    this.camShake = Math.max(0, this.camShake - dt * 3);
    this.updateParticles(dt);
    this.updateHearts(dt);
    this.clinic.update(dt);

    if (this.cheerTimer > 0) {
      this.cheerTimer -= dt;
      if (Math.random() < dt * 2.2) this.spawnHearts(1);
    }

    if (this.screen === 'playing') {
      this.updatePlaying(dt);
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.pushState(false);
    }
  }

  private updatePlaying(dt: number): void {
    const phase = PHASE_ORDER[this.phaseIndex];
    this.irritation = clamp(this.irritation - IRRITATION_DECAY * dt, 0, IRRITATION_MAX);
    if (this.irritation >= IRRITATION_MAX) {
      this.doGameOver();
      return;
    }

    if (phase === 'timpanometria') {
      this.updateTympPhase(dt);
    } else {
      this.updateRunnerPhase(dt, phase);
    }

    this.clinic.setMood(this.irritation / 100);
    this.clinic.setProgress(this.currentProgress(), phase);
  }

  private currentProgress(): number {
    if (this.tymp) return this.tymp.overallProgress;
    return clamp(this.lari.x / this.terrain.length, 0, 1);
  }

  private updateRunnerPhase(dt: number, phase: PhaseId): void {
    const lari = this.lari;
    const terrain = this.terrain;

    const progress = clamp(lari.x / terrain.length, 0, 1);
    const targetSpeed =
      phase === 'audiometria'
        ? BASE_SPEED + progress * 260
        : BASE_SPEED + 120;

    if (lari.grounded) {
      const slope = terrain.slopeAt(lari.x);
      const divePower = lari.holding && slope < -0.02 ? 2.4 : 1;
      lari.speed += slope * 190 * divePower * dt;
      lari.speed = lerp(lari.speed, targetSpeed, dt * 0.9);
      lari.speed = clamp(lari.speed, 130, MAX_SPEED);
      lari.x += lari.speed * dt;
      const groundY = terrain.yAt(lari.x);
      lari.vy = slope * lari.speed;
      const ballisticY = lari.y + lari.vy * dt;
      if (ballisticY > groundY + 1.5) {
        lari.grounded = false;
        lari.y = ballisticY;
      } else {
        lari.y = groundY;
      }
      if (lari.holding && slope < -0.02 && Math.random() < dt * 22) {
        this.spawnParticles(lari.x, lari.y, 1, '#9ad1ff');
      }
    } else {
      lari.x += lari.speed * dt;
      lari.vy -= (lari.diving ? DIVE_GRAVITY : GRAVITY) * dt;
      lari.y += lari.vy * dt;
      const groundY = terrain.yAt(lari.x);
      if (lari.y <= groundY) {
        lari.y = groundY;
        const landed = lari.vy <= 0;
        lari.vy = 0;
        lari.grounded = true;
        if (landed) {
          lari.diving = false;
          this.synth.land();
          this.spawnParticles(lari.x, lari.y, 4, '#cfd8ea');
        }
      }
    }

    this.maxSpeedSeen = Math.max(this.maxSpeedSeen, lari.speed);

    const inGap = terrain.gaps.some((g) => lari.x > g.start && lari.x < g.end);
    if (inGap && lari.grounded) {
      lari.grounded = false;
      lari.vy = Math.min(lari.vy, -40);
    }
    if (inGap && lari.y < terrain.minY - 140) {
      this.registerGapFall();
    }

    for (const c of this.collectibles) {
      if (
        !c.taken &&
        Math.abs(lari.x - c.x) < 28 &&
        Math.abs(lari.y + 40 - c.y) < 64
      ) {
        c.taken = true;
        this.score += 25;
        this.synth.playPureTone(1500, 0.09, 0.08);
        this.spawnParticles(c.x, c.y, 6, '#7fd8ff');
      }
    }

    if (phase === 'audiometria') {
      const freqIdx = clamp(
        Math.round((lari.x / terrain.length) * (FREQUENCIES_HZ.length - 1)),
        0,
        FREQUENCIES_HZ.length - 1,
      );
      if (freqIdx !== this.lastFreqIndex) {
        this.lastFreqIndex = freqIdx;
        this.synth.playPureTone(FREQUENCIES_HZ[freqIdx], 0.3, 0.12);
      }
      for (const m of terrain.markers) {
        if (!m.hit && !m.missed && lari.x > m.x + m.window) {
          m.missed = true;
          this.misses += 1;
          this.combo = 1;
          this.irritation = clamp(this.irritation + IRRITATION_ON_MISS, 0, IRRITATION_MAX);
          this.clinic.onMiss();
          this.synth.miss();
          this.setMessage('Limiar perdido… o paciente ficou irritado!', 1.3);
        }
      }
    }

    if (phase === 'reflexo') {
      this.updateWaves(dt);
    }

    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    this.camY = lerp(this.camY, lari.y, Math.min(1, dt * 4));

    if (this.irritation >= IRRITATION_MAX) {
      this.doGameOver();
      return;
    }

    if (lari.x >= terrain.length - 240) {
      this.completePhase();
    }
  }

  private updateTympPhase(dt: number): void {
    const tymp = this.tymp;
    if (!tymp) return;
    const event = tymp.update(dt);

    if (event === 'oscillation') {
      this.misses += 1;
      this.combo = 1;
      this.irritation = clamp(this.irritation + IRRITATION_ON_OSCILLATION, 0, IRRITATION_MAX);
      this.camShake = Math.max(this.camShake, 0.35);
      this.clinic.onMiss();
      this.synth.miss();
      this.setMessage('Traçado fora da faixa! O paciente torceu o nariz…', 1.1);
    } else if (event === 'peak') {
      this.score += 150;
      this.perfectCount += 1;
      this.irritation = Math.max(0, this.irritation - 5);
      this.synth.hitThreshold(1000);
      this.clinic.onCorrect();
      const px = this.tympAxisX(tymp.currentPressure, this.gameArea());
      const py = this.tympAxisY(tymp.currentCompliance, this.gameArea());
      this.spawnScreenParticles(px, py, 12, '#ffd54a');
      this.setMessage('Pico estabilizado! +150', 1.1);
    } else if (event === 'typeDone') {
      const r = tymp.typeResults[tymp.typeResults.length - 1];
      if (r) {
        if (r.passed) {
          this.hits += 1;
          this.score += 300;
          this.combo = Math.min(this.combo + 1, 8);
          this.synth.phaseComplete();
          this.clinic.onCorrect();
          this.spawnHearts(1);
          this.setMessage(`${r.id === 'C' ? 'Tipo C' : `Tipo ${r.id}`}: traçado aprovado! (+300)`, 1.6);
        } else {
          this.misses += 1;
          this.combo = 1;
          this.irritation = clamp(this.irritation + 10, 0, IRRITATION_MAX);
          this.synth.miss();
          this.clinic.onMiss();
          this.setMessage(`${r.id === 'C' ? 'Tipo C' : `Tipo ${r.id}`}: fora da faixa na maior parte…`, 1.6);
        }
      }
    }

    if (tymp.finished) {
      this.completePhase();
    }
  }

  private updateWaves(dt: number): void {
    this.waveTimer -= dt;
    const progress = clamp(this.lari.x / this.terrain.length, 0, 1);
    this.waveInterval = lerp(1.7, 0.85, progress);
    if (this.waveTimer <= 0 && this.lari.x < this.terrain.length - 900) {
      this.waveTimer = this.waveInterval;
      this.waves.push({
        x: this.lari.x + 780,
        y: this.terrain.yAt(this.lari.x + 780) + 46,
        speed: this.lari.speed * 0.62,
        radius: 46,
        blocked: false,
        phase: Math.random() * Math.PI * 2,
      });
    }

    for (const wave of this.waves) {
      wave.x -= wave.speed * dt;
      wave.phase += dt * 9;
      wave.y = this.terrain.yAt(Math.max(0, wave.x)) + 46;
      if (!wave.blocked && wave.x <= this.lari.x + 26) {
        wave.blocked = true;
        if (this.shieldTimer > 0) {
          this.score += 80;
          this.hits += 1;
          this.irritation = Math.max(0, this.irritation - 3);
          this.synth.waveBlocked();
          this.clinic.onCorrect();
          this.spawnParticles(wave.x, wave.y, 12, '#7fd8ff');
          this.setMessage('Onda bloqueada pelo reflexo!', 1);
        } else {
          this.misses += 1;
          this.combo = 1;
          this.irritation = clamp(this.irritation + IRRITATION_ON_WAVE_HIT, 0, IRRITATION_MAX);
          this.camShake = 1;
          this.lari.speed = Math.max(150, this.lari.speed * 0.7);
          this.synth.waveHit();
          this.clinic.onMiss();
          this.spawnParticles(wave.x, wave.y, 12, '#ff7a7a');
          this.setMessage('A onda atingiu a Lari! O paciente se irritou…', 1.2);
        }
      }
    }
    this.waves = this.waves.filter((w) => w.x > this.lari.x - 320);

    const nearest = this.waves.reduce<number>((acc, w) => {
      if (w.blocked) return acc;
      const dist = w.x - this.lari.x;
      const glow = clamp(1 - dist / 380, 0, 1);
      return Math.max(acc, glow);
    }, 0);
    this.clinic.setReflexGlow(nearest);
  }

  private reflexGlow(): number {
    return this.waves.reduce<number>((acc, w) => {
      if (w.blocked) return acc;
      return Math.max(acc, clamp(1 - (w.x - this.lari.x) / 380, 0, 1));
    }, 0);
  }

  private registerGapFall(): void {
    const gap = this.terrain.gaps.find((g) => this.lari.x > g.start - 60 && this.lari.x < g.end + 60);
    const exitX = gap ? gap.end + 80 : this.lari.x + 200;
    this.misses += 1;
    this.combo = 1;
    this.irritation = clamp(this.irritation + IRRITATION_ON_GAP_FALL, 0, IRRITATION_MAX);
    this.camShake = 0.8;
    this.synth.miss();
    this.clinic.onMiss();
    this.setMessage('A Lari caiu no platô do Tipo B! O paciente se irritou…', 1.6);
    this.lari.x = exitX;
    this.lari.y = this.terrain.yAt(exitX) + 120;
    this.lari.vy = 0;
    this.lari.grounded = false;
    this.lari.speed = 320;
  }

  private spawnParticles(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.7) * 220,
        vy: Math.random() * 260 + 60,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 1,
        color,
      });
    }
    if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
  }

  /** Partículas em coordenadas de tela (usadas na Fase 2). */
  private spawnScreenParticles(sx: number, sy: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: sx,
        y: sy,
        vx: (Math.random() - 0.5) * 160,
        vy: -Math.random() * 120 - 40,
        life: 0.5 + Math.random() * 0.3,
        maxLife: 1,
        color,
      });
    }
  }

  private spawnHearts(count: number): void {
    const area = this.gameArea();
    const scale = this.worldScale(area);
    const pos = this.lariScreenPos(area);
    for (let i = 0; i < count; i++) {
      this.hearts.push({
        x: pos.x + (Math.random() - 0.5) * 40,
        y: pos.y - SPRITE_H * scale * 3 - Math.random() * 20,
        vy: -60 - Math.random() * 40,
        wobble: Math.random() * Math.PI * 2,
        life: 1.4 + Math.random() * 0.6,
        maxLife: 2,
        size: 3 + Math.random() * 2,
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 700 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private updateHearts(dt: number): void {
    for (const h of this.hearts) {
      h.y += h.vy * dt;
      h.wobble += dt * 4;
      h.x += Math.sin(h.wobble) * 18 * dt;
      h.life -= dt;
    }
    this.hearts = this.hearts.filter((h) => h.life > 0);
  }

  private setMessage(text: string, duration: number): void {
    this.message = text;
    this.messageTimer = duration;
    this.messageKey += 1;
    this.pushState(true);
  }

  // ---- Layout / estado ----

  private gameArea(): Area {
    if (this.isPortrait) {
      return { x: 0, y: Math.round(this.height * 0.46), w: this.width, h: Math.round(this.height * 0.54) };
    }
    return { x: 0, y: Math.round(this.height * 0.3), w: this.width, h: Math.round(this.height * 0.7) };
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(320, Math.round(rect.width));
    this.height = Math.max(360, Math.round(rect.height));
    this.isPortrait = this.height > this.width * 1.04;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.overlay.width = Math.round(this.width * dpr);
    this.overlay.height = Math.round(this.height * dpr);
    this.overlay.style.width = `${this.width}px`;
    this.overlay.style.height = `${this.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;

    this.clinic.setPortrait(this.isPortrait);
    this.clinic.resize(this.width, this.height);
    this.pushState(false);
  }

  private pushState(force: boolean): void {
    if (!force && this.screen !== 'playing') return;
    const phase = PHASE_ORDER[this.phaseIndex];
    const label = this.tymp ? this.tymp.label() : this.terrain.labelAt(this.lari.x);
    this.onState({
      screen: this.screen,
      phase,
      score: this.score,
      hits: this.hits,
      misses: this.misses,
      combo: this.combo,
      speed: Math.round(this.tymp ? this.tymp.currentCompliance * 100 : this.lari.speed),
      progress: this.currentProgress(),
      frequencyLabel: label,
      message: this.message,
      messageKey: this.messageKey,
      shieldActive: this.shieldTimer > 0,
      reflexGlow: this.reflexGlow(),
      results: this.results,
      isPortrait: this.isPortrait,
      hasTouch: this.hasTouch,
      muted: this.muted,
      irritation: this.irritation,
      lariMood: this.lariMood,
      phaseHint: this.tymp ? this.tymp.hint() : '',
    });
  }

  // ---- Render (overlay 2D) ----

  private render(): void {
    this.clinic.render();
    const ctx = this.ctx;
    const area = this.gameArea();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();
    if (this.camShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * 10 * this.camShake,
        (Math.random() - 0.5) * 8 * this.camShake,
      );
    }
    this.drawGraphPanel(area);
    if (PHASE_ORDER[this.phaseIndex] === 'timpanometria' && this.screen !== 'menu') {
      this.drawTympGraph(area);
      this.drawTympLari(area);
    } else {
      this.drawTerrain(area);
      this.drawCollectibles(area);
      this.drawMarkers(area);
      if (PHASE_ORDER[this.phaseIndex] === 'reflexo' && this.screen !== 'menu') {
        this.drawWaves(area);
      }
      this.drawLari(area);
    }
    this.drawParticlesScreen(area);
    this.drawHearts();
    ctx.restore();
  }

  private worldScale(area: Area): number {
    return area.w / (this.isPortrait ? 640 : 1000);
  }

  private camLeft(area: Area): number {
    return this.lari.x - (this.isPortrait ? 0.3 : 0.36) * area.w / this.worldScale(area);
  }

  private screenX(x: number, area: Area): number {
    return area.x + (x - this.camLeft(area)) * this.worldScale(area);
  }

  private screenY(y: number, area: Area): number {
    return area.y + area.h * 0.62 - (y - this.camY) * this.worldScale(area);
  }

  private tympAxisX(p: number, area: Area): number {
    const pad = area.w * 0.06;
    return area.x + pad + ((p - -400) / 600) * (area.w - pad * 2);
  }

  private tympAxisY(c: number, area: Area): number {
    return area.y + area.h * 0.84 - c * (area.h * 0.68);
  }

  private lariScreenPos(area: Area): { x: number; y: number } {
    if (this.tymp && this.screen !== 'menu') {
      return {
        x: this.tympAxisX(this.tymp.currentPressure, area),
        y: this.tympAxisY(this.tymp.currentCompliance, area),
      };
    }
    return { x: this.screenX(this.lari.x, area), y: this.screenY(this.lari.y, area) };
  }

  private drawGraphPanel(area: Area): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
    grad.addColorStop(0, 'rgba(10, 14, 30, 0.55)');
    grad.addColorStop(1, 'rgba(10, 14, 30, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(area.x, area.y, area.w, area.h);

    const progress = this.currentProgress();
    const tints: Record<PhaseId, string> = {
      audiometria: `rgba(255, 150, 90, ${0.09 * progress})`,
      timpanometria: `rgba(90, 220, 160, ${0.09 * progress})`,
      reflexo: `rgba(190, 110, 255, ${0.1 * progress})`,
    };
    ctx.fillStyle = tints[PHASE_ORDER[this.phaseIndex]];
    ctx.fillRect(area.x, area.y, area.w, area.h);

    ctx.strokeStyle = 'rgba(120, 160, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(area.x, area.y + 1);
    ctx.lineTo(area.x + area.w, area.y + 1);
    ctx.stroke();
  }

  private drawTerrain(area: Area): void {
    const ctx = this.ctx;
    const phase = PHASE_ORDER[this.phaseIndex];
    const scale = this.worldScale(area);
    const stepPx = 6;

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();

    if (this.screen !== 'menu') {
      if (phase === 'audiometria') {
        ctx.strokeStyle = 'rgba(90, 139, 255, 0.75)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let px = 0; px <= area.w; px += stepPx) {
          const wx = this.camLeft(area) + px / scale;
          const sy = this.screenY(this.terrain.yAt(wx) + 30, area);
          if (px === 0) ctx.moveTo(px, sy);
          else ctx.lineTo(px, sy);
        }
        ctx.stroke();
      }

      const mainColor =
        phase === 'audiometria' ? '#ff5f6d' : phase === 'timpanometria' ? '#3ddc97' : '#b06cff';
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 4;
      ctx.shadowColor = mainColor;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      let pen = false;
      for (let px = 0; px <= area.w + stepPx; px += stepPx) {
        const wx = this.camLeft(area) + px / scale;
        const gap = this.terrain.gaps.some((g) => wx > g.start && wx < g.end);
        const sy = this.screenY(this.terrain.yAt(wx), area);
        if (gap || sy > area.y + area.h + 40) {
          pen = false;
          continue;
        }
        if (!pen) {
          ctx.moveTo(px, sy);
          pen = true;
        } else {
          ctx.lineTo(px, sy);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    if (phase === 'audiometria') {
      ctx.fillStyle = 'rgba(200, 215, 255, 0.55)';
      ctx.font = '10px monospace';
      [0, 25, 50, 75, 100].forEach((db) => {
        const sy = this.screenY((95 - db) * 1.7, area);
        if (sy < area.y || sy > area.y + area.h) return;
        ctx.strokeStyle = 'rgba(140, 170, 230, 0.16)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(area.x, sy);
        ctx.lineTo(area.x + area.w, sy);
        ctx.stroke();
        ctx.fillText(`${db} dB`, area.x + 6, sy - 4);
      });
    }
    ctx.restore();
  }

  private drawCollectibles(area: Area): void {
    if (this.screen === 'menu' || this.collectibles.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    for (const c of this.collectibles) {
      if (c.taken) continue;
      const sx = this.screenX(c.x, area);
      const sy = this.screenY(c.y, area);
      if (sx < area.x - 20 || sx > area.x + area.w + 20) continue;
      const pulse = 1 + Math.sin(this.animTime * 6 + c.x) * 0.2;
      ctx.strokeStyle = 'rgba(127, 216, 255, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(127, 216, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(sx, sy, 10 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMarkers(area: Area): void {
    if (this.screen === 'menu') return;
    const ctx = this.ctx;
    const phase = PHASE_ORDER[this.phaseIndex];
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    for (const m of this.terrain.markers) {
      const sx = this.screenX(m.x, area);
      const sy = this.screenY(m.y, area);
      if (sx < area.x - 30 || sx > area.x + area.w + 30) continue;
      const near = Math.abs(this.lari.x - m.x) <= m.window;
      let color = phase === 'audiometria' ? (m.label === 'O' ? '#ff5f6d' : '#5a8bff') : '#3ddc97';
      if (m.hit) color = '#7dff9b';
      if (m.missed) color = 'rgba(150, 150, 160, 0.6)';
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = near ? 3 : 2;
      ctx.beginPath();
      ctx.arc(sx, sy - 14, 9, 0, Math.PI * 2);
      ctx.stroke();
      if (m.hit) {
        ctx.fillText('✓', sx, sy - 10);
      } else {
        ctx.fillText(m.kind === 'threshold' ? m.label : '▲', sx, sy - 10);
      }
      if (near && !m.hit && !m.missed) {
        const pulse = 12 + Math.sin(this.animTime * 12) * 4;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(sx, sy - 14, 9 + pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    ctx.textAlign = 'left';
  }

  /** Fase 2 — gráfico timpanométrico com alvo tracejado, faixa e traçado do jogador. */
  private drawTympGraph(area: Area): void {
    const ctx = this.ctx;
    const tymp = this.tymp;
    if (!tymp) return;
    const spec = tymp.spec;

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();

    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(200, 215, 255, 0.6)';
    ctx.strokeStyle = 'rgba(140, 170, 230, 0.14)';
    ctx.lineWidth = 1;
    for (let p = -400; p <= 200; p += 100) {
      const sx = this.tympAxisX(p, area);
      ctx.beginPath();
      ctx.moveTo(sx, area.y);
      ctx.lineTo(sx, area.y + area.h);
      ctx.stroke();
      ctx.fillText(`${p > 0 ? '+' : ''}${p}`, sx - 10, area.y + area.h - 6);
    }
    for (let c = 0; c <= 1.001; c += 0.25) {
      const sy = this.tympAxisY(c, area);
      ctx.beginPath();
      ctx.moveTo(area.x, sy);
      ctx.lineTo(area.x + area.w, sy);
      ctx.stroke();
      ctx.fillText(c.toFixed(2), area.x + 6, sy - 4);
    }

    const targetAt = (p: number): number => {
      const d = (p - spec.peak) / spec.width;
      return spec.height * Math.exp(-d * d);
    };

    ctx.fillStyle = 'rgba(255, 213, 74, 0.12)';
    ctx.beginPath();
    let started = false;
    for (let p = -400; p <= 200; p += 8) {
      const sx = this.tympAxisX(p, area);
      const sy = this.tympAxisY(targetAt(p) + spec.tol, area);
      if (!started) {
        ctx.moveTo(sx, sy);
        started = true;
      } else ctx.lineTo(sx, sy);
    }
    for (let p = 200; p >= -400; p -= 8) {
      const sx = this.tympAxisX(p, area);
      ctx.lineTo(sx, this.tympAxisY(Math.max(0, targetAt(p) - spec.tol), area));
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    for (let p = -400; p <= 200; p += 6) {
      const sx = this.tympAxisX(p, area);
      const sy = this.tympAxisY(targetAt(p), area);
      if (p === -400) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    const trace = tymp.tracePoints;
    if (trace.length > 1) {
      ctx.lineWidth = 4;
      for (let i = 1; i < trace.length; i++) {
        const a = trace[i - 1];
        const b = trace[i];
        ctx.strokeStyle = b.inBand ? '#3ddc97' : '#ff5f6d';
        ctx.beginPath();
        ctx.moveTo(this.tympAxisX(a.p, area), this.tympAxisY(a.c, area));
        ctx.lineTo(this.tympAxisX(b.p, area), this.tympAxisY(b.c, area));
        ctx.stroke();
      }
    }

    const cx = this.tympAxisX(tymp.currentPressure, area);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, area.y);
    ctx.lineTo(cx, area.y + area.h);
    ctx.stroke();

    ctx.font = 'bold 15px monospace';
    ctx.fillStyle = '#ffd54a';
    ctx.fillText(spec.name, area.x + 14, area.y + 24);
    if (tymp.currentState === 'break') {
      const last = tymp.typeResults[tymp.typeResults.length - 1];
      if (last) {
        ctx.font = 'bold 13px monospace';
        ctx.fillStyle = last.passed ? '#7dff9b' : '#ff7a7a';
        ctx.fillText(
          `${last.passed ? '✓ APROVADO' : '✗ REPROVADO'} · precisão ${(last.accuracy * 100).toFixed(0)}% · oscilações: ${last.oscillations}`,
          area.x + 14,
          area.y + 46,
        );
      }
    } else {
      ctx.font = '12px monospace';
      ctx.fillStyle = 'rgba(200, 215, 255, 0.8)';
      ctx.fillText(
        `Varredura ${tymp.typeResults.length + 1}/${tymp.types.length} · precisão do segmento: ${Math.round(this.tympBandRatio() * 100)}%`,
        area.x + 14,
        area.y + 46,
      );
    }
    ctx.restore();
  }

  private tympBandRatio(): number {
    const tymp = this.tymp;
    if (!tymp) return 0;
    const trace = tymp.tracePoints;
    if (trace.length === 0) return 1;
    const inBand = trace.filter((t) => t.inBand).length;
    return inBand / trace.length;
  }

  private drawTympLari(area: Area): void {
    const ctx = this.ctx;
    const tymp = this.tymp;
    if (!tymp) return;
    const scale = this.worldScale(area);
    const pixelScale = clamp(scale * 4.6, 2.4, 4.2);
    const pos = this.lariScreenPos(area);

    let frame: number = LARI_FRAMES.run[0];
    if (tymp.currentState === 'break') {
      const last = tymp.typeResults[tymp.typeResults.length - 1];
      frame = last?.passed ? LARI_FRAMES.cheer[Math.floor(this.animTime * 6) % 2] : LARI_FRAMES.idle;
    } else if (tymp.isHolding) {
      frame = LARI_FRAMES.jump;
    } else {
      frame = LARI_FRAMES.run[Math.floor(this.animTime * 8) % 4];
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y - 10, area.w, area.h + 10);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x, this.tympAxisY(0, area));
    ctx.stroke();

    ctx.translate(pos.x, pos.y);
    ctx.drawImage(
      this.sprites.canvas,
      frame * SPRITE_W,
      0,
      SPRITE_W,
      SPRITE_H,
      (-SPRITE_W / 2) * pixelScale,
      -SPRITE_H * pixelScale,
      SPRITE_W * pixelScale,
      SPRITE_H * pixelScale,
    );
    this.drawMoodMarks(ctx, pixelScale);
    ctx.restore();
  }

  private drawWaves(area: Area): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    for (const wave of this.waves) {
      const sx = this.screenX(wave.x, area);
      const sy = this.screenY(wave.y, area);
      const r = wave.radius * (1 + 0.14 * Math.sin(wave.phase)) * this.worldScale(area) * 1.4;
      const glow = clamp(1 - (wave.x - this.lari.x) / 380, 0, 1);
      ctx.strokeStyle = wave.blocked ? 'rgba(120,130,150,0.4)' : `rgba(255, ${120 + glow * 100}, 160, 0.9)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = wave.blocked ? 'rgba(120,130,150,0.25)' : 'rgba(255, 170, 210, 0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, r * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawLari(area: Area): void {
    const ctx = this.ctx;
    const scale = this.worldScale(area);
    const pixelScale = clamp(scale * 4.6, 2.4, 4.2);
    const pos = this.lariScreenPos(area);
    const sx = pos.x;
    const sy = pos.y;

    let frame: number = LARI_FRAMES.idle;
    const mood = this.lariMood;
    if (this.cheerTimer > 0) {
      frame = LARI_FRAMES.cheer[Math.floor(this.animTime * 6) % 2];
    } else if (this.screen === 'playing') {
      if (this.lari.grounded) {
        const animSpeed = mood === 'nervous' ? 1.45 : 1;
        frame = LARI_FRAMES.run[Math.floor((this.animTime * this.lari.speed * animSpeed) / 34) % 4];
      } else if (this.lari.diving || this.lari.vy < -80) {
        frame = LARI_FRAMES.dive;
      } else {
        frame = LARI_FRAMES.jump;
      }
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y - 10, area.w, area.h + 10);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;

    if (this.shieldTimer > 0) {
      const alpha = clamp(this.shieldTimer / 0.65, 0, 1);
      ctx.strokeStyle = `rgba(127, 216, 255, ${0.4 + alpha * 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy - (SPRITE_H * pixelScale) / 2, SPRITE_H * pixelScale * 0.75, 0, Math.PI * 2);
      ctx.stroke();
    }

    const tilt = this.lari.grounded || this.tymp ? 0 : clamp(this.lari.vy / 1400, -0.3, 0.35);
    ctx.translate(sx, sy);
    ctx.rotate(tilt);
    ctx.drawImage(
      this.sprites.canvas,
      frame * SPRITE_W,
      0,
      SPRITE_W,
      SPRITE_H,
      (-SPRITE_W / 2) * pixelScale,
      -SPRITE_H * pixelScale,
      SPRITE_W * pixelScale,
      SPRITE_H * pixelScale,
    );
    this.drawMoodMarks(ctx, pixelScale);
    ctx.restore();
  }

  /** Suor quando nervosa, coração quando muito feliz. */
  private drawMoodMarks(ctx: CanvasRenderingContext2D, pixelScale: number): void {
    const mood = this.lariMood;
    if (mood === 'nervous') {
      const bob = Math.sin(this.animTime * 10) * 2;
      ctx.fillStyle = '#7fd8ff';
      ctx.fillRect(-SPRITE_W * 0.5 * pixelScale - 4, -SPRITE_H * pixelScale * 0.9 + bob, 2 * pixelScale * 0.6, 3 * pixelScale * 0.6);
      ctx.fillRect(SPRITE_W * 0.5 * pixelScale + 2, -SPRITE_H * pixelScale * 0.95 - bob, 2 * pixelScale * 0.6, 3 * pixelScale * 0.6);
    } else if (mood === 'happy' && this.combo >= 3 && Math.sin(this.animTime * 2) > 0.55) {
      const s = pixelScale * 0.9;
      this.drawPixelHeart(ctx, SPRITE_W * 0.5 * pixelScale + 4, -SPRITE_H * pixelScale - 6, s, '#ff5f7a');
    }
  }

  private drawPixelHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string): void {
    ctx.fillStyle = color;
    const w = HEART_MATRIX[0].length;
    const h = HEART_MATRIX.length;
    for (let row = 0; row < h; row++) {
      let col = 0;
      while (col < w) {
        if (HEART_MATRIX[row][col] === 'X') {
          let run = 1;
          while (col + run < w && HEART_MATRIX[row][col + run] === 'X') run++;
          ctx.fillRect(cx + (col - w / 2) * s, cy + (row - h / 2) * s, run * s, s);
          col += run;
        } else {
          col++;
        }
      }
    }
  }

  private drawHearts(): void {
    const ctx = this.ctx;
    for (const heart of this.hearts) {
      ctx.save();
      ctx.globalAlpha = clamp(heart.life / 0.8, 0, 1);
      this.drawPixelHeart(ctx, heart.x, heart.y, heart.size, '#ff5f7a');
      ctx.fillStyle = '#ffb3c0';
      ctx.fillRect(heart.x - heart.size * 1.1, heart.y - heart.size * 0.9, heart.size * 0.7, heart.size * 0.7);
      ctx.restore();
    }
  }

  /** Partículas: as da Fase 2 já estão em coordenadas de tela; as demais são convertidas. */
  private drawParticlesScreen(area: Area): void {
    const ctx = this.ctx;
    const scale = this.worldScale(area);
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    const isTymp = PHASE_ORDER[this.phaseIndex] === 'timpanometria';
    for (const p of this.particles) {
      const sx = isTymp ? p.x : this.screenX(p.x, area);
      const sy = isTymp ? p.y : this.screenY(p.y, area);
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      const s = 3 * scale * 1.6;
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
