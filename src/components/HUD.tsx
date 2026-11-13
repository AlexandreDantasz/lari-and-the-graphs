import { MutableRefObject } from 'react';
import { GameEngine } from '../game/engine';
import { HudState, PHASES, PhaseResult } from '../game/types';

interface Props {
  state: HudState;
  engineRef: MutableRefObject<GameEngine | null>;
}

const PHASE_RESULT_LABEL: Record<PhaseResult['phase'], string> = {
  audiometria: 'Audiometria Tonal',
  timpanometria: 'Timpanometria',
  reflexo: 'Reflexo Estapediano',
};

function TopBar({ state, engineRef }: Props) {
  const engine = engineRef.current;
  return (
    <div className={`top-bar ${state.isPortrait ? 'portrait' : 'landscape'}`}>
      <div className="stat-group">
        <span className="stat score">★ {state.score}</span>
        <span className="stat">✓ {state.hits}</span>
        <span className="stat">✗ {state.misses}</span>
        {state.combo > 1 && <span className="stat combo">x{state.combo}</span>}
      </div>
      <div className="phase-info">
        <span className="phase-label">{PHASES[state.phase].title.split('·')[1]?.trim()}</span>
        <span className="freq-label">{state.frequencyLabel}</span>
      </div>
      <div className="right-group">
        <span className="stat speed">{state.speed} u/s</span>
        <button className="icon-btn" onClick={() => engine?.toggleMute()} aria-label="Som">
          {state.muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      <span className="progress-icon" style={{ left: `${Math.round(progress * 100)}%` }}>
        👂
      </span>
    </div>
  );
}

function MessageToast({ state }: { state: HudState }) {
  if (!state.message) return null;
  return (
    <div key={state.messageKey} className="message-toast">
      {state.message}
    </div>
  );
}

function MenuScreen({ engineRef, hasTouch }: { engineRef: Props['engineRef']; hasTouch: boolean }) {
  return (
    <div className="overlay">
      <h1 className="game-title">
        Lari <span className="amp">&amp;</span> The Graphs
      </h1>
      <p className="tagline">Corra sobre audiogramas, timpanogramas e reflexos!</p>
      <ul className="menu-list">
        <li>🎧 Fase 1 — Audiometria Tonal: salte os limiares auditivos</li>
        <li>📈 Fase 2 — Timpanometria: mergulhe nas curvas Tipo A/B/C</li>
        <li>🛡️ Fase 3 — Reflexo Estapediano: bloqueie as ondas sonoras</li>
      </ul>
      <p className="controls-hint">
        {hasTouch
          ? 'Toque = pular · Segure = mergulhar · Deslize ↑ = reflexo'
          : 'Clique/Espaço = pular · Segure = mergulhar · ↑ = reflexo · ↓ = mergulhar'}
      </p>
      <button className="primary-btn" onClick={() => engineRef.current?.beginRun()}>
        Começar o plantão 🩺
      </button>
    </div>
  );
}

function PhaseIntroScreen({
  state,
  engineRef,
}: {
  state: HudState;
  engineRef: Props['engineRef'];
}) {
  const phase = PHASES[state.phase];
  return (
    <div className="overlay">
      <h2>{phase.title}</h2>
      <p className="subtitle">{phase.subtitle}</p>
      <p className="instructions">{phase.instructions}</p>
      <button className="primary-btn" onClick={() => engineRef.current?.confirmPhaseIntro()}>
        Preparar! (ou toque na tela)
      </button>
    </div>
  );
}

function PhaseResultsScreen({
  state,
  engineRef,
}: {
  state: HudState;
  engineRef: Props['engineRef'];
}) {
  const last = state.results[state.results.length - 1];
  if (!last) return null;
  const total = last.hits + last.misses;
  const accuracy = total > 0 ? Math.round((last.hits / total) * 100) : 100;
  const isFinal = state.results.length === 3;
  return (
    <div className="overlay">
      <h2>{PHASE_RESULT_LABEL[last.phase]} concluída!</h2>
      <div className="results-grid">
        <div className="result-item">
          <span className="value">{last.hits}</span>
          <span className="label">acertos</span>
        </div>
        <div className="result-item">
          <span className="value">{last.misses}</span>
          <span className="label">erros</span>
        </div>
        <div className="result-item">
          <span className="value">{accuracy}%</span>
          <span className="label">precisão</span>
        </div>
        <div className="result-item">
          <span className="value">{last.perfect}</span>
          <span className="label">perfeitos</span>
        </div>
      </div>
      <p className="laudo-note">
        {accuracy >= 80
          ? '📋 Laudo impecável! Os pacientes agradecem.'
          : accuracy >= 50
            ? '📋 Laudo bom — revise os limiares duvidosos.'
            : '📋 Laudo com ressalvas… treine mais o timing!'}
      </p>
      <button
        className="primary-btn"
        onClick={() => engineRef.current?.advanceFromResults()}
      >
        {isFinal ? 'Ver laudo final 📋' : 'Próxima fase ▶'}
      </button>
    </div>
  );
}

function FinalReportScreen({
  state,
  engineRef,
}: {
  state: HudState;
  engineRef: Props['engineRef'];
}) {
  const totalHits = state.results.reduce((a, r) => a + r.hits, 0);
  const totalMisses = state.results.reduce((a, r) => a + r.misses, 0);
  const total = totalHits + totalMisses;
  const accuracy = total > 0 ? Math.round((totalHits / total) * 100) : 100;
  const grade = accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D';
  return (
    <div className="overlay">
      <h2>📋 Laudo Final</h2>
      <div className="report-card">
        <p>
          Paciente: <strong>Lari</strong> · Fonoaudiologia
        </p>
        {state.results.map((r) => (
          <p key={r.phase} className="report-line">
            {PHASE_RESULT_LABEL[r.phase]}: {r.hits} acertos / {r.misses} erros ·{' '}
            {r.maxSpeed} u/s máx.
          </p>
        ))}
        <p className="report-total">
          Precisão global: <strong>{accuracy}%</strong> · Conceito <strong>{grade}</strong>
        </p>
        <p className="laudo-note">
          {grade === 'A'
            ? '🏆 Excelência clínica! A Lari é referência no consultório.'
            : '💪 Continue treinando os exames audiológicos!'}
        </p>
      </div>
      <button className="primary-btn" onClick={() => engineRef.current?.beginRun()}>
        Jogar novamente 🔁
      </button>
      <button className="secondary-btn" onClick={() => engineRef.current?.backToMenu()}>
        Menu
      </button>
    </div>
  );
}

export function HUD({ state, engineRef }: Props) {
  const engine = engineRef.current;
  return (
    <div className={`hud ${state.isPortrait ? 'portrait' : 'landscape'}`}>
      {state.screen === 'playing' && (
        <>
          <TopBar state={state} engineRef={engineRef} />
          <ProgressBar progress={state.progress} />
          <MessageToast state={state} />
          {state.phase === 'reflexo' && (
            <div className={`reflex-hint ${state.reflexGlow > 0.2 ? 'glow' : ''}`}>
              {state.isPortrait || state.hasTouch
                ? 'Deslize ↑ quando brilhar!'
                : 'Espaço/↑ quando brilhar!'}
            </div>
          )}
          {state.isPortrait && (
            <div className="touch-hint">
              {state.phase === 'timpanometria'
                ? 'Segure para mergulhar 🤿'
                : 'Toque para pular · deslize ↑ para o reflexo'}
            </div>
          )}
        </>
      )}

      {state.screen === 'menu' && <MenuScreen engineRef={engineRef} hasTouch={state.hasTouch} />}
      {state.screen === 'phaseIntro' && <PhaseIntroScreen state={state} engineRef={engineRef} />}
      {state.screen === 'phaseResults' && (
        <PhaseResultsScreen state={state} engineRef={engineRef} />
      )}
      {state.screen === 'finalReport' && <FinalReportScreen state={state} engineRef={engineRef} />}

      {state.screen === 'playing' && (
        <button
          className="icon-btn exit-btn"
          onClick={() => engine?.backToMenu()}
          aria-label="Menu"
        >
          ✕
        </button>
      )}
    </div>
  );
}
