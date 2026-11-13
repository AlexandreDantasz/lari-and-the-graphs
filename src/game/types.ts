export type PhaseId = 'audiometria' | 'timpanometria' | 'reflexo';

export type GameScreen =
  | 'menu'
  | 'phaseIntro'
  | 'playing'
  | 'phaseResults'
  | 'finalReport';

export interface PhaseResult {
  phase: PhaseId;
  hits: number;
  misses: number;
  perfect: number;
  maxSpeed: number;
  distance: number;
}

export interface HudState {
  screen: GameScreen;
  phase: PhaseId;
  score: number;
  hits: number;
  misses: number;
  combo: number;
  speed: number;
  progress: number;
  frequencyLabel: string;
  message: string;
  messageKey: number;
  shieldActive: boolean;
  reflexGlow: number;
  results: PhaseResult[];
  isPortrait: boolean;
  hasTouch: boolean;
  muted: boolean;
}

export interface PhaseConfig {
  id: PhaseId;
  title: string;
  subtitle: string;
  instructions: string;
  length: number;
}

export interface Marker {
  x: number;
  y: number;
  label: string;
  kind: 'threshold' | 'peak' | 'reflex';
  hit: boolean;
  missed: boolean;
  window: number;
}

export interface Wave {
  x: number;
  y: number;
  speed: number;
  radius: number;
  blocked: boolean;
  phase: number;
}

export const PHASES: Record<PhaseId, PhaseConfig> = {
  audiometria: {
    id: 'audiometria',
    title: 'Fase 1 · Audiometria Tonal',
    subtitle: 'Orelha Direita (O) × Orelha Esquerda (X)',
    instructions:
      'Toque no timing exato dos limiares auditivos para dar impulso à Lari e saltar as quedas de perda auditiva. A velocidade aumenta nos agudos!',
    length: 6400,
  },
  timpanometria: {
    id: 'timpanometria',
    title: 'Fase 2 · Timpanometria',
    subtitle: 'Curvas Tipo A, As, Ad, B e C',
    instructions:
      'Segure o toque para mergulhar nas descidas e ganhar velocidade (estilo Tiny Wings). Salte os picos de complacência e os platôs do Tipo B!',
    length: 7200,
  },
  reflexo: {
    id: 'reflexo',
    title: 'Fase 3 · Reflexo Estapediano',
    subtitle: 'Imitanciometria · Defesa rítmica',
    instructions:
      'Ondas sonoras avançam contra a Lari! Quando o fone do paciente brilhar, deslize para cima (ou Espaço/Seta ↑) para ativar o escudo do reflexo.',
    length: 5200,
  },
};

export const FREQUENCIES_HZ = [250, 500, 1000, 2000, 4000, 8000] as const;
