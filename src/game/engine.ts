import { AudiometerSynth } from './audio/AudiometerSynth';
import { InputController } from './input';
import { createAudiometryTerrain, createReflexTerrain, createTympanometryTerrain, Terrain } from './terrain';
import { buildLariSpriteSheet, LARI_FRAMES, LariSpriteSheet, SPRITE_H, SPRITE_W } from './sprites/lari';
import { ClinicScene } from './three/clinic';
import { FREQUENCIES_HZ, HudState, Marker, PHASES, PhaseId, PhaseResult, Wave } from './types';
import { clamp, lerp } from './utils';

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
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

const GRAVITY = 1500;
const DIVE_GRAVITY = 2600;
const JUMP_V = 580;
const BOOST_V = 660;
const BASE_SPEED = 250;
const MAX_SPEED = 620;

const PHASE_ORDER: PhaseId[] = ['audiometria', 'timpanometria', 'reflexo'];

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
  private lastFreqIndex = -1;
  private phaseSeed = 7;

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

  backToMenu(): void {
    this.screen = 'menu';
    this.pushState(true);
  }

  toggleMute(): void {
    this.muted = !this.muted;
    this.synth.setMuted(this.muted);
    this.pushState(true);
  }

  // ---- Fluxo de fases ----

  private startPhase(id: PhaseId): void {
    const config = PHASES[id];
    this.phaseSeed = (this.phaseSeed * 1103515245 + 12345) % 2147483647;
    this.terrain =
      id === 'audiometria'
        ? createAudiometryTerrain(this.phaseSeed, config.length)
        : id === 'timpanometria'
          ? createTympanometryTerrain(this.phaseSeed, config.length)
          : createReflexTerrain(this.phaseSeed, config.length);

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
    this.lastFreqIndex = -1;
    this.cheerTimer = 0;
    this.screen = 'phaseIntro';
    this.setMessage(config.title, 2.2);
    this.synth.uiClick();
    if (id === 'audiometria') this.synth.playSweep();
    this.pushState(true);
  }

  private startPlaying(): void {
    this.screen = 'playing';
    this.pushState(true);
  }

  confirmPhaseIntro(): void {
    this.synth.unlock();
    if (this.screen === 'phaseIntro') this.startPlaying();
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
    this.cheerTimer = 2.6;
    this.screen = 'phaseResults';
    this.clinic.onCorrect();
    this.synth.phaseComplete();
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
    if (phase === 'audiometria') {
      const marker = this.pendingMarker();
      if (marker) {
        this.hitMarker(marker);
        return;
      }
    }
    if (phase === 'timpanometria') {
      this.lari.diving = true;
      this.synth.dive();
      return;
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

  // ---- Update ----

  private update(dt: number): void {
    this.animTime += dt;
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = '';
    }
    this.camShake = Math.max(0, this.camShake - dt * 3);
    this.updateParticles(dt);
    this.clinic.update(dt);

    if (this.cheerTimer > 0) this.cheerTimer -= dt;

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
    const lari = this.lari;
    const terrain = this.terrain;

    const progress = clamp(lari.x / terrain.length, 0, 1);
    const targetSpeed =
      phase === 'audiometria'
        ? BASE_SPEED + progress * 260
        : phase === 'timpanometria'
          ? BASE_SPEED + 60
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
          this.clinic.onMiss();
          this.synth.miss();
          this.setMessage('Limiar perdido… o paciente duvidou!', 1.3);
        }
      }
    }

    if (phase === 'reflexo') {
      this.updateWaves(dt);
    }

    if (this.shieldTimer > 0) this.shieldTimer -= dt;

    this.camY = lerp(this.camY, lari.y, Math.min(1, dt * 4));

    if (lari.x >= terrain.length - 240) {
      this.completePhase();
    }
  }

  private updateWaves(dt: number): void {
    this.waveTimer -= dt;
    const progress = clamp(this.lari.x / this.terrain.length, 0, 1);
    this.waveInterval = lerp(1.7, 0.95, progress);
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
          this.synth.waveBlocked();
          this.clinic.onCorrect();
          this.spawnParticles(wave.x, wave.y, 12, '#7fd8ff');
          this.setMessage('Onda bloqueada pelo reflexo!', 1);
        } else {
          this.misses += 1;
          this.combo = 1;
          this.camShake = 1;
          this.lari.speed = Math.max(150, this.lari.speed * 0.7);
          this.synth.waveHit();
          this.clinic.onMiss();
          this.spawnParticles(wave.x, wave.y, 12, '#ff7a7a');
          this.setMessage('A onda atingiu a Lari!', 1.2);
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
    this.camShake = 0.8;
    this.synth.miss();
    this.clinic.onMiss();
    this.setMessage('A Lari caiu no platô do Tipo B! Segure para mergulhar antes.', 1.6);
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

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 700 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  private setMessage(text: string, duration: number): void {
    this.message = text;
    this.messageTimer = duration;
    this.messageKey += 1;
    this.pushState(true);
  }

  // ---- Layout / estado ----

  private gameArea(): { x: number; y: number; w: number; h: number } {
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
    this.onState({
      screen: this.screen,
      phase,
      score: this.score,
      hits: this.hits,
      misses: this.misses,
      combo: this.combo,
      speed: Math.round(this.lari.speed),
      progress: clamp(this.lari.x / this.terrain.length, 0, 1),
      frequencyLabel: this.terrain.labelAt(this.lari.x),
      message: this.message,
      messageKey: this.messageKey,
      shieldActive: this.shieldTimer > 0,
      reflexGlow: this.reflexGlow(),
      results: this.results,
      isPortrait: this.isPortrait,
      hasTouch: this.hasTouch,
      muted: this.muted,
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
    this.drawTerrain(area);
    this.drawMarkers(area);
    if (PHASE_ORDER[this.phaseIndex] === 'reflexo' && this.screen !== 'menu') {
      this.drawWaves(area);
    }
    this.drawLari(area);
    this.drawParticles(area);
    ctx.restore();
  }

  private worldScale(area: Area): number {
    return area.w / (this.isPortrait ? 640 : 1000);
  }

  private drawGraphPanel(area: Area): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
    grad.addColorStop(0, 'rgba(10, 14, 30, 0.55)');
    grad.addColorStop(1, 'rgba(10, 14, 30, 0.88)');
    ctx.fillStyle = grad;
    ctx.fillRect(area.x, area.y, area.w, area.h);
    ctx.strokeStyle = 'rgba(120, 160, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(area.x, area.y + 1);
    ctx.lineTo(area.x + area.w, area.y + 1);
    ctx.stroke();
  }

  private screenX(x: number, area: Area): number {
    const scale = this.worldScale(area);
    return area.x + (x - (this.lari.x - (this.isPortrait ? 0.3 : 0.36) * area.w / scale)) * scale;
  }

  private screenY(y: number, area: Area): number {
    const scale = this.worldScale(area);
    return area.y + area.h * 0.62 - (y - this.camY) * scale;
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
          const wx = this.lari.x - (this.isPortrait ? 0.3 : 0.36) * area.w / scale + px / scale;
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
        const wx = this.lari.x - (this.isPortrait ? 0.3 : 0.36) * area.w / scale + px / scale;
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
    const sx = this.screenX(this.lari.x, area);
    const sy = this.screenY(this.lari.y, area);

    let frame: number = LARI_FRAMES.idle;
    if (this.cheerTimer > 0) {
      frame = LARI_FRAMES.cheer[Math.floor(this.animTime * 6) % 2];
    } else if (this.screen === 'playing') {
      if (this.lari.grounded) {
        if (this.lari.holding && !this.lari.diving) frame = LARI_FRAMES.run[Math.floor(this.animTime * 14) % 4];
        else frame = LARI_FRAMES.run[Math.floor((this.animTime * this.lari.speed) / 34) % 4];
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

    const tilt = this.lari.grounded ? 0 : clamp(this.lari.vy / 1400, -0.3, 0.35);
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
    ctx.restore();
  }

  private drawParticles(area: Area): void {
    const ctx = this.ctx;
    const scale = this.worldScale(area);
    ctx.save();
    ctx.beginPath();
    ctx.rect(area.x, area.y, area.w, area.h);
    ctx.clip();
    for (const p of this.particles) {
      const sx = this.screenX(p.x, area);
      const sy = this.screenY(p.y, area);
      ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.color;
      const s = 3 * scale * 1.6;
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
