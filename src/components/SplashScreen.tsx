import { useEffect, useRef } from 'react';

/**
 * Splash de abertura: as ondas dos gráficos clínicos viram o mar que submerge
 * a tela da direita para a esquerda; quando a maré recua, o jogo aparece pronto
 * para começar (onReveal dispara a transição de menu para a fase). Toque/clique
 * pula para a revelação.
 */

const SUBMERGE_END = 1.6;
const FULL_END = 2.9;
const RECEDE_END = 4.15;
const FADE_MS = 450;

const WAVE_LAYERS = [
  { color: 'rgba(255, 95, 109, 0.95)', amp: 16, k: 0.011, speed: 2.1, yOff: -20, width: 3 },
  { color: 'rgba(127, 216, 255, 0.95)', amp: 20, k: 0.008, speed: 1.5, yOff: 4, width: 3 },
  { color: 'rgba(87, 227, 137, 0.45)', amp: 11, k: 0.015, speed: 2.7, yOff: 30, width: 2 },
];

const easeInOut = (v: number): number => {
  const c = Math.min(Math.max(v, 0), 1);
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
};

interface Props {
  onReveal: () => void;
  onDone: () => void;
}

export default function SplashScreen({ onReveal, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const onRevealRef = useRef(onReveal);
  const onDoneRef = useRef(onDone);
  onRevealRef.current = onReveal;
  onDoneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const title = titleRef.current;
    if (!canvas || !wrap || !title) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let disposed = false;
    let finished = false;
    let revealed = false;
    let start = 0;
    let skip = 0;
    let raf = 0;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const surfaceY = (layer: (typeof WAVE_LAYERS)[number], x: number, t: number): number => {
      const base = height * 0.44 + layer.yOff;
      return (
        base +
        Math.sin(x * layer.k - t * layer.speed * 2.4) * layer.amp +
        Math.sin(x * layer.k * 0.37 - t * layer.speed) * layer.amp * 0.55
      );
    };

    const drawWater = (frontX: number, t: number): void => {
      if (frontX >= width) return;
      const left = Math.max(0, frontX);
      ctx.save();
      ctx.beginPath();
      ctx.rect(left, 0, width - left, height);
      ctx.clip();

      const grad = ctx.createLinearGradient(0, height * 0.3, 0, height);
      grad.addColorStop(0, 'rgba(24, 52, 104, 0.94)');
      grad.addColorStop(1, 'rgba(8, 11, 24, 0.98)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(left, height);
      for (let x = left; x <= width; x += 6) {
        ctx.lineTo(x, surfaceY(WAVE_LAYERS[1], x, t));
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(160, 200, 255, 0.07)';
      ctx.lineWidth = 1;
      const gridShift = (t * 60) % 48;
      for (let gx = left - 48 + gridShift; gx < width; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, height * 0.3);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }

      for (const layer of WAVE_LAYERS) {
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.width;
        ctx.shadowColor = layer.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let x = left; x <= width; x += 5) {
          const y = surfaceY(layer, x, t);
          if (x === left) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      wrap.classList.add('splash-hide');
      window.setTimeout(() => {
        if (!disposed) onDoneRef.current();
      }, FADE_MS);
    };

    const frame = (now: number): void => {
      if (disposed || finished) return;
      if (start === 0) start = now;
      const t = (now - start) / 1000 + skip;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#070a14';
      ctx.fillRect(0, 0, width, height);

      let frontX: number;
      if (t < SUBMERGE_END) {
        frontX = width * (1 - easeInOut(t / SUBMERGE_END));
      } else if (t < FULL_END) {
        frontX = 0;
      } else if (t < RECEDE_END) {
        frontX = width * easeInOut((t - FULL_END) / (RECEDE_END - FULL_END));
      } else {
        frontX = width;
      }

      if (!revealed && t >= FULL_END) {
        revealed = true;
        onRevealRef.current();
      }

      drawWater(frontX, t);

      if (frontX < width) {
        const crestX = Math.max(frontX, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#7fd8ff';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(crestX, height * 0.2);
        ctx.quadraticCurveTo(crestX - 14 * Math.sin(t * 9), height * 0.5, crestX, height * 0.85);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      let titleOpacity: number;
      if (t < SUBMERGE_END) titleOpacity = Math.min(1, (t / SUBMERGE_END) * 1.4 - 0.3);
      else if (t < FULL_END) titleOpacity = 1;
      else titleOpacity = Math.max(0, 1 - ((t - FULL_END) / (RECEDE_END - FULL_END)) * 1.6);
      const bob = Math.sin(t * 2.4) * 7;
      title.style.opacity = `${Math.max(0, titleOpacity)}`;
      title.style.transform = `translate(-50%, calc(-50% + ${bob}px))`;

      if (t >= RECEDE_END) {
        finish();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    const skipAhead = () => {
      if (disposed || finished) return;
      const elapsed = start === 0 ? 0 : (performance.now() - start) / 1000 + skip;
      if (elapsed < FULL_END) skip = FULL_END - elapsed;
      else if (elapsed < RECEDE_END) skip = RECEDE_END - elapsed + 0.05;
    };
    window.addEventListener('pointerdown', skipAhead);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', skipAhead);
    };
  }, []);

  return (
    <div ref={wrapRef} className="splash">
      <canvas ref={canvasRef} className="splash-canvas" />
      <div ref={titleRef} className="splash-title">
        <h1>
          Lari <span className="splash-amp">&amp;</span> The Graphs
        </h1>
        <p>Surfando pelas ondas da fonoaudiologia</p>
      </div>
      <span className="splash-hint">toque para pular ▶</span>
    </div>
  );
}
