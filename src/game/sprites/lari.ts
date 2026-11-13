/**
 * Sprite pixel-art procedural da Lari — nenhuma imagem externa.
 * A personagem é definida por uma matriz de caracteres (1 char = 1 pixel)
 * e renderizada em um sprite-sheet offscreen com nearest-neighbor.
 *
 * Aparência: pele morena clara, cabelo preto volumoso ondulado na altura dos
 * ombros, franja reta e cheia até as sobrancelhas, sobrancelhas escuras,
 * olhos castanho-escuros, sorriso, jaleco branco sobre blusa escura,
 * crachá e fone audiométrico no pescoço.
 */

export const SPRITE_W = 20;
export const SPRITE_H = 28;

const PALETTE: Record<string, string> = {
  K: '#181019', // cabelo preto
  H: '#2c2030', // brilho do cabelo
  S: '#eab68c', // pele morena clara
  D: '#b97f4e', // sombra de pele / nariz
  P: '#e59a86', // bochechas
  E: '#3a2014', // olhos castanho-escuros / sobrancelhas
  M: '#a8503f', // boca/sorriso
  W: '#f5f5f0', // jaleco branco
  G: '#c7ccd6', // sombra do jaleco
  B: '#26344f', // blusa escura
  N: '#2f4d78', // gola/fone audiométrico
  R: '#d94848', // crachá
  J: '#23252e', // sapatos
  '.': 'transparent',
};

/** Cabeça + tronco (linhas 0..19). Pernas e braços são animados proceduralmente. */
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

interface LegPose {
  hip: number;
  thighDx: number;
  thighRows: number;
  shinDx: number;
  shinRows: number;
}

function drawLeg(ctx: CanvasRenderingContext2D, ox: number, oy: number, leg: LegPose): void {
  const thighX = leg.hip + leg.thighDx;
  drawMatrixPixel(ctx, PALETTE.P, ox + thighX, oy + 20, 4, leg.thighRows);
  const shinX = thighX + leg.shinDx;
  drawMatrixPixel(ctx, PALETTE.P, ox + shinX, oy + 20 + leg.thighRows, 4, leg.shinRows);
  drawMatrixPixel(
    ctx,
    PALETTE.J,
    ox + shinX,
    oy + 20 + leg.thighRows + leg.shinRows - 2,
    5,
    2,
  );
}

function drawArm(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  x: number,
  y: number,
  w: number,
  h: number,
  raised = false,
): void {
  if (raised) {
    drawMatrixPixel(ctx, PALETTE.S, ox + x, oy + y, w, 2);
    drawMatrixPixel(ctx, PALETTE.W, ox + x, oy + y + 2, w, h - 2);
    return;
  }
  drawMatrixPixel(ctx, PALETTE.W, ox + x, oy + y, w, h);
  drawMatrixPixel(ctx, PALETTE.S, ox + x, oy + y + h, w, 2);
}

type PoseName = 'run' | 'jump' | 'dive' | 'cheer' | 'idle';

/**
 * Ciclo de corrida em 4 frames: contato (perna dianteira estendida, traseira
 * com calcanhar levantado) e passagem (joelho flexionado no ar, perna de apoio
 * reta) — em visão lateral as pernas se alternam silhueta a silhueta. O corpo
 * sobe 1px nos frames de passagem.
 */
const RUN_STRIDE: { lead: LegPose; trail: LegPose } = {
  lead: { hip: 11, thighDx: 2, thighRows: 4, shinDx: 2, shinRows: 4 },
  trail: { hip: 5, thighDx: -2, thighRows: 4, shinDx: -2, shinRows: 3 },
};
const RUN_PASS: { lead: LegPose; trail: LegPose } = {
  lead: { hip: 11, thighDx: 1, thighRows: 3, shinDx: 2, shinRows: 3 },
  trail: { hip: 5, thighDx: 0, thighRows: 4, shinDx: 0, shinRows: 4 },
};
const RUN_CYCLE: Array<{ lead: LegPose; trail: LegPose }> = [
  RUN_STRIDE,
  RUN_PASS,
  RUN_STRIDE,
  RUN_PASS,
];

function drawPose(ctx: CanvasRenderingContext2D, ox: number, oy: number, pose: PoseName, f: number): void {
  switch (pose) {
    case 'run': {
      const cycle = RUN_CYCLE[f % 4];
      drawLeg(ctx, ox, oy, cycle.lead);
      drawLeg(ctx, ox, oy, cycle.trail);
      const armSwing = f % 2 === 0 ? -1 : 1;
      drawArm(ctx, ox, oy, 1, 16 + armSwing, 2, 3);
      drawArm(ctx, ox, oy, 17, 16 - armSwing, 2, 3);
      break;
    }
    case 'jump': {
      drawLeg(ctx, ox, oy, { hip: 5, thighDx: 0, thighRows: 3, shinDx: -2, shinRows: 3 });
      drawLeg(ctx, ox, oy, { hip: 11, thighDx: 0, thighRows: 3, shinDx: 2, shinRows: 3 });
      drawArm(ctx, ox, oy, 1, 13, 2, 4);
      drawArm(ctx, ox, oy, 17, 13, 2, 4);
      break;
    }
    case 'dive': {
      drawLeg(ctx, ox, oy, { hip: 4, thighDx: 0, thighRows: 4, shinDx: -3, shinRows: 4 });
      drawLeg(ctx, ox, oy, { hip: 10, thighDx: 0, thighRows: 4, shinDx: -2, shinRows: 4 });
      drawArm(ctx, ox, oy, 1, 18, 2, 3);
      drawArm(ctx, ox, oy, 17, 18, 2, 3);
      break;
    }
    case 'cheer': {
      drawLeg(ctx, ox, oy, { hip: 6, thighDx: 0, thighRows: 4, shinDx: 0, shinRows: 4 });
      drawLeg(ctx, ox, oy, { hip: 10, thighDx: 0, thighRows: 4, shinDx: 0, shinRows: 4 });
      const swap = f % 2;
      const leftY = 4 + swap;
      const rightY = 5 - swap;
      drawArm(ctx, ox, oy, 1, leftY, 2, 13 - leftY, true);
      drawArm(ctx, ox, oy, 17, rightY, 2, 13 - rightY, true);
      break;
    }
    case 'idle': {
      drawLeg(ctx, ox, oy, { hip: 6, thighDx: 0, thighRows: 4, shinDx: 0, shinRows: 4 });
      drawLeg(ctx, ox, oy, { hip: 10, thighDx: 0, thighRows: 4, shinDx: 0, shinRows: 4 });
      drawArm(ctx, ox, oy, 1, 16, 2, 3);
      drawArm(ctx, ox, oy, 17, 16, 2, 3);
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
    drawBase(ctx, ox, bob);
    drawPose(ctx, ox, bob, frame.pose, frame.f);
  });
  return { canvas, frameCount: FRAME_ORDER.length };
}
