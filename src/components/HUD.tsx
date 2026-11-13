import { MutableRefObject, useEffect, useMemo, useRef } from 'react';
import { GameEngine } from '../game/engine';
import { HudState, PHASES, PhaseResult } from '../game/types';
import { buildToastyPortrait } from '../game/sprites/toasty';
import {
  buildLariSpriteSheet,
  LARI_FRAMES,
  LariSpriteSheet,
  SPRITE_H,
  SPRITE_W,
} from '../game/sprites/lari';

interface Props {
  state: HudState;
  engineRef: MutableRefObject<GameEngine | null>;
}

const PHASE_RESULT_LABEL: Record<PhaseResult['phase'], string> = {
  audiometria: 'Audiometria Tonal',
  timpanometria: 'Timpanometria',
  reflexo: 'Reflexo Estapediano',
};

const TOASTY_LINES = ['REFAÇA O EXAME!', 'LAUDO REPROVADO!'];

/** Lari 2D animada em pixel art, renderizada no mesmo plano dos menus. */
function LariPortrait({ grade, size = 92 }: { grade: string; size?: number }) {
  const sheet: LariSpriteSheet = useMemo(() => buildLariSpriteSheet(), []);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    const draw = (): void => {
      t += 1 / 60;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let frame: number;
      if (grade === 'A' || grade === 'B') {
        frame = LARI_FRAMES.cheer[Math.floor(t * 6) % 2];
      } else if (grade === 'C') {
        frame = LARI_FRAMES.run[Math.floor(t * 5) % 4];
      } else {
        frame = LARI_FRAMES.idle;
      }
      ctx.drawImage(
        sheet.canvas,
        frame * SPRITE_W,
        0,
        SPRITE_W,
        SPRITE_H,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      if (grade === 'D') {
        const bob = Math.sin(t * 8) * 2;
        ctx.fillStyle = '#7fd8ff';
        ctx.fillRect(canvas.width * 0.82, canvas.height * 0.16 + bob, 4, 7);
        ctx.fillRect(canvas.width * 0.1, canvas.height * 0.2 - bob, 4, 7);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [grade, sheet]);

  return (
    <canvas
      ref={canvasRef}
      width={SPRITE_W * 4}
      height={SPRITE_H * 4}
      className="lari-portrait"
      style={{ width: size }}
      aria-label={`Lari ${grade}`}
    />
  );
}

function CredibilityMeter({ state }: { state: HudState }) {
  const face = state.credibility > 65 ? '😊' : state.credibility > 35 ? '😐' : '😠';
  const moodLabel =
    state.lariMood === 'happy'
      ? 'Lari feliz!'
      : state.lariMood === 'neutral'
        ? 'Lari atenta'
        : 'Lari nervosa!';
  const cls =
    state.credibility <= 35 ? 'danger' : state.credibility <= 65 ? 'warn' : '';
  return (
    <div className="credibility-meter">
      <span className="credibility-face">{face}</span>
      <div className="credibility-track">
        <div className={`credibility-fill ${cls}`} style={{ width: `${Math.round(state.credibility)}%` }} />
        <span className="credibility-label">Credibilidade do Laudo</span>
      </div>
      <span className="credibility-mood">{moodLabel}</span>
    </div>
  );
}

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
        <span className="stat speed">
          {state.phase === 'timpanometria' ? `C ${state.speed}` : `${state.speed} u/s`}
        </span>
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

/** Easter egg estilo "Toasty!": retrato pixel art da professora avaliadora. */
function Toasty({ toastKey }: { toastKey: number }) {
  const portrait = useMemo(() => buildToastyPortrait().dataUrl, []);
  return (
    <div key={toastKey} className="toasty" role="img" aria-label="Toasty!">
      <img src={portrait} alt="Professora avaliadora" className="toasty-img" />
      <span className="toasty-text">{TOASTY_LINES[toastKey % TOASTY_LINES.length]}</span>
    </div>
  );
}

function MenuScreen({ engineRef, hasTouch }: { engineRef: Props['engineRef']; hasTouch: boolean }) {
  return (
    <div className="overlay">
      <div className="menu-hero">
        <LariPortrait grade="A" size={84} />
        <div>
          <h1 className="game-title">
            Lari <span className="amp">&amp;</span> The Graphs
          </h1>
          <p className="tagline">Corra sobre audiogramas, calibre timpanogramas e bloqueie reflexos!</p>
        </div>
      </div>
      <ul className="menu-list">
        <li>🎧 Fase 1 — Audiometria Tonal: registre os limiares sem falso-positivos</li>
        <li>📈 Fase 2 — Timpanometria: calibre a pressão nos 5 tipos de Jerger</li>
        <li>🛡️ Fase 3 — Reflexo Estapediano: bloqueie só as ondas presentes</li>
        <li>⚠️ Erros derrubam a Credibilidade do Laudo — a 0% o exame é invalidado!</li>
        <li>📝 Ao fim de cada gráfico, acerte o diagnóstico do laudo (ou Game Over!)</li>
      </ul>
      <p className="controls-hint">
        {hasTouch
          ? 'Toque = pular · Segure = pressão/mergulho · Deslize ↑ = reflexo'
          : 'Clique/Espaço = pular · Segure = pressão · ↑ = reflexo · ↓ = mergulhar'}
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
    <div className="overlay tappable" onClick={() => engineRef.current?.confirmPhaseIntro()}>
      <h2>{phase.title}</h2>
      <p className="subtitle">{phase.subtitle}</p>
      <p className="instructions">{phase.instructions}</p>
      <button className="primary-btn" onClick={() => engineRef.current?.confirmPhaseIntro()}>
        Preparar! (ou toque na tela)
      </button>
    </div>
  );
}

function QuizScreen({ state, engineRef }: { state: HudState; engineRef: Props['engineRef'] }) {
  const quiz = state.quiz;
  if (!quiz) return null;
  const labels = ['A', 'B', 'C'];
  const chosen = state.quizChosen;
  const answered = chosen !== null;
  const isCorrect = answered && chosen === quiz.correct;
  return (
    <div className="overlay quiz-overlay">
      <h2>📝 Laudo do Paciente</h2>
      {quiz.image && (
        <figure className="quiz-memory">
          <img className="quiz-chart" src={quiz.image} alt="Memória do exame realizado" />
          {quiz.imageCaption && (
            <figcaption className="quiz-caption">{quiz.imageCaption}</figcaption>
          )}
        </figure>
      )}
      <p className="quiz-question">{quiz.question}</p>
      <div className="quiz-options">
        {quiz.options.map((option, i) => {
          let cls = 'quiz-option';
          if (answered && i === quiz.correct) cls += ' is-correct';
          else if (answered && i === chosen) cls += ' is-wrong';
          return (
            <button
              key={option}
              className={cls}
              disabled={answered}
              onClick={() => engineRef.current?.answerQuiz(i)}
            >
              <span className="quiz-letter">{labels[i] ?? '?'}</span>
              {option}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="quiz-feedback">
          <p className={isCorrect ? 'quiz-verdict ok' : 'quiz-verdict bad'}>
            {isCorrect
              ? '✅ Diagnóstico correto! Laudo assinado (+400)'
              : `❌ Não foi essa. A correta está destacada: "${quiz.options[quiz.correct]}"`}
          </p>
          <p className="quiz-explain">{quiz.explain}</p>
          <button className="quiz-continue" onClick={() => engineRef.current?.continueAfterQuiz()}>
            Continuar ▶
          </button>
        </div>
      ) : (
        <p className="quiz-warning">
          📖 O gráfico acima é a memória do exame — consulte-o antes de responder!
        </p>
      )}
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
      <h2>💖 {PHASE_RESULT_LABEL[last.phase]} concluída!</h2>
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
          ? '📋 Laudo impecável! O paciente saiu sorrindo. 💖'
          : accuracy >= 50
            ? '📋 Laudo bom — revise os limiares duvidosos.'
            : '📋 Laudo com ressalvas… a credibilidade sofreu!'}
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

function GameOverScreen({
  state,
  engineRef,
}: {
  state: HudState;
  engineRef: Props['engineRef'];
}) {
  return (
    <div className="overlay game-over">
      <Toasty toastKey={state.toastyKey} />
      <h2>😱 Exame reprovado!</h2>
      <p className="instructions game-over-reason">{state.gameOverReason}</p>
      <div className="results-grid">
        <div className="result-item">
          <span className="value">{state.hits}</span>
          <span className="label">acertos</span>
        </div>
        <div className="result-item">
          <span className="value">{state.misses}</span>
          <span className="label">erros</span>
        </div>
        <div className="result-item">
          <span className="value">{state.score}</span>
          <span className="label">pontos</span>
        </div>
      </div>
      <button className="primary-btn" onClick={() => engineRef.current?.retryPhase()}>
        Repetir fase 🔁
      </button>
      <button className="secondary-btn" onClick={() => engineRef.current?.backToMenu()}>
        Menu
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
      <div className="menu-hero">
        <LariPortrait grade={grade} size={88} />
        <h2>📋 Laudo Final</h2>
      </div>
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
            ? '🏆 Excelência clínica! A Lari comemora muito!'
            : grade === 'B'
              ? '💪 Bom trabalho! A Lari está animada para melhorar.'
              : grade === 'C'
                ? '😅 A Lari segue treinando os exames audiológicos…'
                : '😰 A Lari ficou nervosa — bora revisar a matéria de audiologia!'}
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
          <CredibilityMeter state={state} />
          <ProgressBar progress={state.progress} />
          <MessageToast state={state} />
          {state.phase === 'reflexo' && (
            <div className={`reflex-hint ${state.reflexGlow > 0.2 ? 'glow' : ''}`}>
              {state.isPortrait || state.hasTouch
                ? 'Deslize ↑ quando o fone brilhar!'
                : 'Espaço/↑ quando o fone brilhar!'}
            </div>
          )}
          {state.phase === 'timpanometria' && state.phaseHint && (
            <div className="tymp-hint">💡 {state.phaseHint}</div>
          )}
          {state.isPortrait && (
            <div className="touch-hint">
              {state.phase === 'timpanometria'
                ? 'Segure = pressão ↑ · Solte = pressão ↓'
                : state.phase === 'reflexo'
                  ? 'Deslize ↑ para o reflexo'
                  : 'Toque para pular · deslize ↑ para o reflexo'}
            </div>
          )}
        </>
      )}

      {state.screen === 'menu' && <MenuScreen engineRef={engineRef} hasTouch={state.hasTouch} />}
      {state.screen === 'phaseIntro' && <PhaseIntroScreen state={state} engineRef={engineRef} />}
      {state.screen === 'quiz' && <QuizScreen state={state} engineRef={engineRef} />}
      {state.screen === 'phaseResults' && (
        <PhaseResultsScreen state={state} engineRef={engineRef} />
      )}
      {state.screen === 'gameOver' && <GameOverScreen state={state} engineRef={engineRef} />}
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
