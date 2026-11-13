export type PhaseId = 'audiometria' | 'timpanometria' | 'reflexo';

export type GameScreen =
  | 'menu'
  | 'phaseIntro'
  | 'playing'
  | 'quiz'
  | 'phaseResults'
  | 'finalReport'
  | 'gameOver';

export type LariMood = 'happy' | 'neutral' | 'nervous';

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
  credibility: number;
  lariMood: LariMood;
  phaseHint: string;
  quiz: QuizData | null;
  quizChosen: number | null;
  gameOverReason: string;
  toastyKey: number;
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
  signaled: boolean;
  window: number;
  registeredY?: number;
}

export interface Wave {
  x: number;
  y: number;
  speed: number;
  radius: number;
  blocked: boolean;
  present: boolean;
  phase: number;
}

export interface QuizData {
  question: string;
  options: string[];
  correct: number;
  explain: string;
  image?: string;
  imageCaption?: string;
}

export const PHASES: Record<PhaseId, PhaseConfig> = {
  audiometria: {
    id: 'audiometria',
    title: 'Fase 1 · Audiometria Tonal',
    subtitle: 'Orelha Direita (O) × Orelha Esquerda (X)',
    instructions:
      'Toque no timing exato dos limiares auditivos para dar impulso à Lari e saltar as quedas de perda auditiva. Colete as ondinhas sonoras e cuidado: errar demais irrita o paciente! A velocidade aumenta nos agudos.',
    length: 9600,
  },
  timpanometria: {
    id: 'timpanometria',
    title: 'Fase 2 · Timpanometria',
    subtitle: 'Calibração de Pressão & Complacência · 5 tipos de Jerger',
    instructions:
      'Guie a sonda na varredura de -400 a +200 daPa: segure para aumentar a pressão positiva (curva sobe) e solte para reduzir (curva desce). Mantenha o traçado dentro da faixa tracejada e estabilize no pico no momento certo — cada tipo de Jerger se comporta de um jeito!',
    length: 5,
  },
  reflexo: {
    id: 'reflexo',
    title: 'Fase 3 · Reflexo Estapediano',
    subtitle: 'Imitanciometria · Defesa rítmica',
    instructions:
      'Ondas sonoras avançam contra a Lari em um trajeto longo e pulsante! Quando o fone do paciente brilhar, deslize para cima (ou Espaço/Seta ↑) para ativar o escudo do reflexo. Colete as ondinhas e mantenha o paciente calmo.',
    length: 8400,
  },
};

export const FREQUENCIES_HZ = [250, 500, 1000, 2000, 4000, 8000] as const;
