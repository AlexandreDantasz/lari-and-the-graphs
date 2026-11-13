import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/engine';
import { HudState } from './game/types';
import { HUD } from './components/HUD';

const INITIAL_STATE: HudState = {
  screen: 'menu',
  phase: 'audiometria',
  score: 0,
  hits: 0,
  misses: 0,
  combo: 1,
  speed: 0,
  progress: 0,
  frequencyLabel: '',
  message: '',
  messageKey: 0,
  shieldActive: false,
  reflexGlow: 0,
  results: [],
  isPortrait: false,
  hasTouch: false,
  muted: false,
  credibility: 100,
  lariMood: 'happy' as const,
  phaseHint: '',
  quiz: null,
  quizChosen: null,
  gameOverReason: '',
  toastyKey: 0,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [state, setState] = useState<HudState>(INITIAL_STATE);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new GameEngine(containerRef.current, setState);
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  return (
    <div className="app-root">
      <div ref={containerRef} className="game-container" />
      <HUD state={state} engineRef={engineRef} />
    </div>
  );
}
