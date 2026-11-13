/**
 * Sprite pixel-art procedural da Lari — nenhuma imagem externa.
 * A personagem é definida por uma matriz de caracteres (1 char = 1 pixel)
 * e renderizada em um sprite-sheet offscreen com nearest-neighbor.
 *
 * Aparência: pele morena clara, cabelo preto volumoso ondulado na altura dos
 * ombros, franja reta e cheia até as sobrancelhas, sobrancelhas escuras,
 * olhos castanho-escuros, sorriso, jaleco branco sobre blusa escura,
 * crachá e fone audiométrico no pescoço.
 *
 * Animação: cabeça+tronco são a base fixa; membros são desenhados por
 * segmentos angulados (quadril→joelho→pé, ombro→cotovelo→mão), com os
 * membros do lado oposto em tom sombreado — permitindo corrida com passada
 * real, salto, mergulho e comemoração com silhuetas fluidas.
 */

export const SPRITE_W = 20;
export const SPRITE_H = 28;

const PALETTE: Record<string, string> = {
  K: '#181019', // cabelo preto
  H: '#2c2030', // brilho do cabelo
  S: '#eab68c', // pele morena clara
  D: '#b97f4e', // sombra de pele / membros do lado oposto
  P: '#e59a86', // bochechas
  E: '#3a2014', // olhos castanho-escuros / sobrancelhas
  M: '#a8503f', // boca/sorriso
  W: '#f5f5f0', // jaleco branco
  G: '#c7ccd6', // sombra do jaleco / manga do lado oposto
  B: '#26344f', // blusa escura
  N: '#2f4d78', // gola/fone audiométrico
  R: '#d94848', // crachá
  J: '#23252e', // sapatos
  '.': 'transparent',
};

/** Cabeça + tronco (linhas 0..19). Membros são animados por segmentos. */
const BASE_ROWS: string[] = [
  '......KKKKKKK.......',
  '.....KKKKKKKKK......',
  '....KKKKKKKKKKK.....',
  '...KKKKKKKKKKKKK....',
  '...KKKKKKKKKKKKK....',
  '...KKKKKKKKKKKKK....',
  '..KKKSDDSSSSDDSKKK..',
  '..KKKSEESSSSEESKKK..',
  '..KKKSSSSSSSSSSKKK..',
  '..KKKSPSSSDSSPSSKKK.',
  '..KKKSSSMMMMSSSKKK..',
  '..KKKKSSSSSSSSKKKK..',
  '..KKKKWWSSSSWWKKKK..',
  '.KKWWWWWWWWWWWWWWKK.',
  '.KKWWNBBBBBBNWWKK...',
  '.KKWWNBNNNNBNWWKK...',
  '.KWWWWWWWGWWWWWWK...',
  '.KWWWWGGGGWWRWWWK...',
  '.KWWWWWWWGWWWWWWK...',
  '.KWWWWWWWGWWWWWWK...',
];

function drawMatrixPixel(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  w = 1,
  h = 1,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawBase(ctx: CanvasRenderingContext2D, ox: number, oy: number): void {
  for (let row = 0; row < BASE_ROWS.length; row++) {
    const line = BASE_ROWS[row];
    let col = 0;
    while (col < line.length) {
      const ch = line[col];
      let run = 1;
      while (col + run < line.length && line[col + run] === ch) run++;
      if (ch !== '.' && PALETTE[ch]) {
        drawMatrixPixel(ctx, PALETTE[ch], ox + col, oy + row, run, 1);
      }
      col += run;
    }
  }
}

/** Segmento inclinado: h linhas de largura w, deslocando dxTotal do início ao fim. */
function drawAngled(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  dxTotal: number,
  dir: 1 | -1 = 1,
): void {
  for (let r = 0; r < h; r++) {
    const dx = h > 1 ? Math.round((dxTotal * r) / (h - 1)) : 0;
    drawMatrixPixel(ctx, color, ox + x + dx, oy + y + dir * r, w, 1);
  }
}

interface LegPose {
  hip: number;
  thighDx: number;
  kneeDx: number;
  lift: number;
  far?: boolean;
}

function drawLeg(ctx: CanvasRenderingContext2D, ox: number, oy: number, leg: LegPose): void {
  const skin = leg.far ? PALETTE.D : PALETTE.P;
  const thighRows = 4;
  drawAngled(ctx, ox, oy, leg.hip, 20, 4, thighRows, skin, leg.thighDx);
  const kneeX = leg.hip + leg.thighDx;
  const shinRows = Math.max(2, 4 - leg.lift);
  drawAngled(ctx, ox, oy, kneeX, 20 + thighRows, 4, shinRows, skin, leg.kneeDx);
  const footX = kneeX + leg.kneeDx;
  drawMatrixPixel(
    ctx,
    PALETTE.J,
    ox + footX - 1,
    oy + 20 + thighRows + shinRows - 2,
    5,
    2,
  );
}

interface ArmPose {
  x: number;
  y: number;
  upperDx: number;
  foreDx: number;
  far?: boolean;
  up?: boolean;
}

function drawArm(ctx: CanvasRenderingContext2D, ox: number, oy: number, arm: ArmPose): void {
  const sleeve = arm.far ? PALETTE.G : PALETTE.W;
  const hand = arm.far ? PALETTE.D : PALETTE.S;
  if (arm.up) {
    drawAngled(ctx, ox, oy, arm.x, arm.y - 1, 2, 3, sleeve, arm.upperDx, -1);
    const elbowX = arm.x + arm.upperDx;
    drawAngled(ctx, ox, oy, elbowX, arm.y - 4, 2, 3, sleeve, arm.foreDx, -1);
    drawMatrixPixel(ctx, hand, ox + elbowX + arm.foreDx, oy + arm.y - 8, 2, 2);
    return;
  }
  drawAngled(ctx, ox, oy, arm.x, arm.y, 2, 3, sleeve, arm.upperDx);
  const elbowX = arm.x + arm.upperDx;
  drawAngled(ctx, ox, oy, elbowX, arm.y + 3, 2, 3, sleeve, arm.foreDx);
  drawMatrixPixel(ctx, hand, ox + elbowX + arm.foreDx, oy + arm.y + 6, 2, 2);
}

type PoseName = 'run' | 'jump' | 'dive' | 'cheer' | 'idle';

/**
 * Ciclo de corrida: passada (perna de apoio estendida à frente, traseira com
 * calcanhar erguido) e passagem (joelho da frente recolhido no ar, perna de
 * apoio reta). Membros de trás em tom sombreado dão profundidade.
 */
const RUN_STRIDE_LEGS: { lead: LegPose; trail: LegPose } = {
  lead: { hip: 11, thighDx: 2, kneeDx: 2, lift: 0 },
  trail: { hip: 5, thighDx: -3, kneeDx: -1, lift: 1, far: true },
};
const RUN_PASS_LEGS: { lead: LegPose; trail: LegPose } = {
  lead: { hip: 11, thighDx: 1, kneeDx: -3, lift: 2 },
  trail: { hip: 5, thighDx: 0, kneeDx: 0, lift: 0, far: true },
};
const STRIDE_ARMS: { near: ArmPose; far: ArmPose } = {
  near: { x: 3, y: 14, upperDx: -1, foreDx: -1 },
  far: { x: 15, y: 14, upperDx: 2, foreDx: 1, far: true },
};
const PASS_ARMS: { near: ArmPose; far: ArmPose } = {
  near: { x: 14, y: 14, upperDx: 2, foreDx: 1 },
  far: { x: 4, y: 14, upperDx: -2, foreDx: -1, far: true },
};

/**
 * Poses em duas camadas: 'far' desenha os membros do lado oposto (ficam ATRÁS
 * da base — cabelo/tronco os recortam naturalmente) e 'near' os membros da
 * frente (por cima do tronco). A ordem de composição é far → base → near.
 */
function drawPose(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  pose: PoseName,
  f: number,
  layer: 'far' | 'near',
): void {
  const far = layer === 'far';
  switch (pose) {
    case 'run': {
      const stride = f % 2 === 0;
      const legs = stride ? RUN_STRIDE_LEGS : RUN_PASS_LEGS;
      const arms = stride ? STRIDE_ARMS : PASS_ARMS;
      if (far) {
        drawLeg(ctx, ox, oy, legs.trail);
        drawArm(ctx, ox, oy, arms.far);
      } else {
        drawLeg(ctx, ox, oy, legs.lead);
        drawArm(ctx, ox, oy, arms.near);
      }
      break;
    }
    case 'jump': {
      if (far) {
        drawLeg(ctx, ox, oy, { hip: 5, thighDx: -1, kneeDx: -2, lift: 2, far: true });
        drawArm(ctx, ox, oy, { x: 4, y: 14, upperDx: -3, foreDx: 0, far: true, up: true });
      } else {
        drawLeg(ctx, ox, oy, { hip: 11, thighDx: 1, kneeDx: -2, lift: 2 });
        drawArm(ctx, ox, oy, { x: 15, y: 14, upperDx: 3, foreDx: 0, up: true });
      }
      break;
    }
    case 'dive': {
      if (far) {
        drawLeg(ctx, ox, oy, { hip: 5, thighDx: -2, kneeDx: -1, lift: 2, far: true });
      } else {
        drawLeg(ctx, ox, oy, { hip: 11, thighDx: -2, kneeDx: -2, lift: 1 });
        drawArm(ctx, ox, oy, { x: 4, y: 14, upperDx: 3, foreDx: 2, far: true });
        drawArm(ctx, ox, oy, { x: 15, y: 14, upperDx: 2, foreDx: 1 });
      }
      break;
    }
    case 'cheer': {
      if (far) {
        drawLeg(ctx, ox, oy, { hip: 5, thighDx: 0, kneeDx: 0, lift: 0, far: true });
        if (f % 2 === 0) {
          drawArm(ctx, ox, oy, { x: 4, y: 14, upperDx: -3, foreDx: 0, far: true, up: true });
        } else {
          drawArm(ctx, ox, oy, { x: 4, y: 14, upperDx: -2, foreDx: -1, far: true, up: true });
        }
      } else {
        drawLeg(ctx, ox, oy, { hip: 11, thighDx: 0, kneeDx: 0, lift: 0 });
        if (f % 2 === 0) {
          drawArm(ctx, ox, oy, { x: 15, y: 14, upperDx: 3, foreDx: 0, up: true });
        } else {
          drawArm(ctx, ox, oy, { x: 15, y: 14, upperDx: 2, foreDx: 1, up: true });
        }
      }
      break;
    }
    case 'idle': {
      if (far) {
        drawLeg(ctx, ox, oy, { hip: 5, thighDx: 0, kneeDx: 0, lift: 0, far: true });
        drawArm(ctx, ox, oy, { x: 4, y: 14, upperDx: -1, foreDx: 0, far: true });
      } else {
        drawLeg(ctx, ox, oy, { hip: 11, thighDx: 0, kneeDx: 0, lift: 0 });
        drawArm(ctx, ox, oy, { x: 15, y: 14, upperDx: 1, foreDx: 0 });
      }
      break;
    }
  }
}

export interface LariSpriteSheet {
  canvas: HTMLCanvasElement;
  frameCount: number;
}

export const LARI_FRAMES = {
  run: [0, 1, 2, 3],
  jump: 4,
  dive: 5,
  cheer: [6, 7],
  idle: 8,
} as const;

const FRAME_ORDER: Array<{ pose: PoseName; f: number }> = [
  { pose: 'run', f: 0 },
  { pose: 'run', f: 1 },
  { pose: 'run', f: 2 },
  { pose: 'run', f: 3 },
  { pose: 'jump', f: 0 },
  { pose: 'dive', f: 0 },
  { pose: 'cheer', f: 0 },
  { pose: 'cheer', f: 1 },
  { pose: 'idle', f: 0 },
];

/** Gera o sprite-sheet completo em um canvas offscreen (sem arquivos externos). */
export function buildLariSpriteSheet(): LariSpriteSheet {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE_W * FRAME_ORDER.length;
  canvas.height = SPRITE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { canvas, frameCount: FRAME_ORDER.length };
  ctx.imageSmoothingEnabled = false;
  FRAME_ORDER.forEach((frame, i) => {
    const ox = i * SPRITE_W;
    const bob = frame.pose === 'run' && frame.f % 2 === 1 ? -1 : 0;
    drawPose(ctx, ox, bob, frame.pose, frame.f, 'far');
    drawBase(ctx, ox, bob);
    drawPose(ctx, ox, bob, frame.pose, frame.f, 'near');
  });
  return { canvas, frameCount: FRAME_ORDER.length };
}
