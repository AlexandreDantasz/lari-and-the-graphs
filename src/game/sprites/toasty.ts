/**
 * Retrato pixel-art procedural da Professora Avaliadora (easter egg "Toasty!").
 * Loira de cabelo curto repicado com franja lateral, óculos grandes de armação
 * transparente/bege, sorriso aberto e irônico, brincos e colar longo de pérolas,
 * blusa preta com detalhes rendados no decote. Sem arquivos externos.
 */

export const TOASTY_W = 20;
export const TOASTY_H = 24;

const PALETTE: Record<string, string> = {
  H: '#e8c04a', // loiro claro
  h: '#c79a2e', // sombra do loiro
  S: '#f2c9a8', // pele clara
  D: '#d19a72', // sombra de pele
  F: '#e6dcc3', // armação translúcida/bege
  G: '#e8f4f8', // lente
  E: '#2e2418', // olhos
  M: '#a83a3a', // boca aberta
  T: '#fbfbf6', // dentes
  P: '#f7f4ec', // pérolas
  B: '#17171d', // blusa preta
  L: '#4a4a58', // renda do decote
  R: '#eaa9a0', // blush
  '.': 'transparent',
};

const ROWS: string[] = [
  '....HHHHHHHHHHH.....',
  '...HHHHHHHHHHHHH....',
  '..HHHHHHHHHHHHHHH...',
  '..HHhHHHHHHHHhHHH...',
  '..HHHHHHHHHHHHHHH...',
  '..hHHHHSSSSSSSHHH...',
  '..hHHFFFFFFFFFHHH...',
  '..hHHGEEGSGEEGHHH...',
  '..hHHGEEGSGEEGHHH...',
  '..hHHFFFFFFFFFHHH...',
  '..hHHRSSSSSSSRHHH...',
  '..hHHSTTTTTTTSHHH...',
  '..hHHSMMMMMMMSHHH...',
  '..PHHSSSSSSSSSHHH...',
  '....DSSSSSSSSD......',
  '....DSSSSSSSSD......',
  '..BBBBPBPBPBPBBBB...',
  '.BBBBBPPPPPPPBBBBB..',
  '.BBBBBBPPPPPBBBBBB..',
  '.BBBBBLBBBBLBBBBBB..',
  '.BBBBBLBBBBLBBBBBB..',
  '.BBBBBBBBBBBBBBBBB..',
  '.BBBBBBBBBBBBBBBBB..',
  'BBBBBBBBBBBBBBBBBBBB',
];

export interface ToastyPortrait {
  dataUrl: string;
}

/** Gera o retrato em canvas offscreen e retorna como dataURL (nearest-neighbor via CSS). */
export function buildToastyPortrait(): ToastyPortrait {
  const canvas = document.createElement('canvas');
  canvas.width = TOASTY_W;
  canvas.height = TOASTY_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '' };
  ctx.imageSmoothingEnabled = false;
  for (let row = 0; row < ROWS.length; row++) {
    const line = ROWS[row];
    let col = 0;
    while (col < line.length) {
      const ch = line[col];
      let run = 1;
      while (col + run < line.length && line[col + run] === ch) run++;
      if (ch !== '.' && PALETTE[ch]) {
        ctx.fillStyle = PALETTE[ch];
        ctx.fillRect(col, row, run, 1);
      }
      col += run;
    }
  }
  return { dataUrl: canvas.toDataURL('image/png') };
}
