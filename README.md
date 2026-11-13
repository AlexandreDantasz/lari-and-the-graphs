# Lari & The Graphs 🩺📈

Jogo web responsivo (2.5D — pixel art 2D sobre consultório 3D low-poly) onde **Lari**,
estudante de fonoaudiologia, corre e surfa sobre gráficos clínicos reais.

## Fases

1. **Audiometria Tonal** — corra sobre as curvas OD (`O`, vermelha) e OE (`X`, azul) de
   250 Hz a 8000 Hz. Toque no timing exato dos limiares auditivos para dar impulso e
   saltar as quedas de perda auditiva. A velocidade aumenta nos agudos.
2. **Timpanometria** — curvas Tipo A, As, Ad, B e C (−400 a +200 daPa). Segure o
   toque/clique para mergulhar nas descidas e ganhar velocidade (estilo Tiny Wings)
   e salte os picos de complacência e os platôs do Tipo B.
3. **Reflexo Estapediano** — ondas sonoras avançam contra a Lari. Quando o fone do
   paciente 3D brilhar, deslize para cima (mobile) ou pressione `Espaço`/`↑`
   (desktop) para ativar o escudo do reflexo.

## Stack

- **Vite + React + TypeScript**
- **Three.js** (cena 3D do consultório com pacientes reativos — criança, adulto e
  idoso — construídos só com primitivas, zero assets externos)
- **Canvas 2D** para o gráfico + sprite da Lari gerado proceduralmente por matriz de
  pixels (`imageSmoothingEnabled = false` / nearest-neighbor)
- **Web Audio API** (`AudiometerSynth`): tons puros reais (250/500/1k/2k/4k/8k Hz) via
  `OscillatorNode` + SFX retrô 8-bit, sem nenhum arquivo de áudio

## Rodando

```bash
npm install
npm run dev
```

## Deploy no GitHub Pages

O repositório já inclui `.github/workflows/deploy.yml` (Vite com `base: './'`, então
funciona em qualquer subpasta). Ative em **Settings → Pages → Source: GitHub Actions**.
O workflow faz build e publish automáticos a cada push em `main`.

## Controles

| Ação | Mobile | Desktop |
| --- | --- | --- |
| Pular / confirmar | toque simples | clique / `Espaço` |
| Mergulhar | segurar o toque | segurar clique / `↓` |
| Reflexo estapediano | deslizar ↑ | `↑` / `W` |

O jogo detecta orientação (`isPortrait`) e toque (`hasTouch`) e adapta câmera 3D,
HUD e controles dinamicamente: em retrato, o paciente 3D ocupa a metade superior e o
gráfico a inferior (one-thumb); em paisagem, o consultório inteiro aparece ao fundo
com visão antecipada maior do gráfico.
