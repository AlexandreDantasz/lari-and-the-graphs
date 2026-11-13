# Lari & The Graphs 🩺📈

Jogo web responsivo (2.5D — pixel art 2D sobre consultório 3D low-poly) onde **Lari**,
estudante de fonoaudiologia, corre e surfa sobre gráficos clínicos reais.

## Fases

1. **Audiometria Tonal** — corra sobre as curvas OD (`O`, vermelha) e OE (`X`, azul) de
   250 Hz a 8000 Hz. Toque no timing exato dos limiares auditivos para dar impulso e
   saltar as quedas de perda auditiva. Colete as ondinhas sonoras; a velocidade
   aumenta nos agudos.
2. **Timpanometria (Calibração de Pressão & Complacência)** — a Lari guia a sonda na
   varredura de **−400 a +200 daPa**: segurar aumenta a pressão positiva (curva sobe)
   e soltar reduz (curva desce). Mantenha o traçado dentro da faixa tracejada e
   estabilize no pico no momento certo, com as **5 classificações de Jerger** tendo
   comportamentos distintos:
   - **Tipo A**: pico agudo centralizado em 0 daPa (complacência normal)
   - **Tipo As**: pico baixo em 0 daPa (controle fino para não passar da altura)
   - **Tipo Ad**: pico muito alto e estreito (segure no timing exato)
   - **Tipo B**: linha quase reta e baixa (estabilidade constante, sem oscilar)
   - **Tipo C**: pico deslocado entre −150 e −300 daPa (antecipe bem antes do centro)
3. **Reflexo Estapediano** — ondas sonoras avançam contra a Lari em um trajeto longo
   e pulsante. Quando o fone do paciente 3D brilhar, deslize para cima (mobile) ou
   pressione `Espaço`/`↑` (desktop) para ativar o escudo do reflexo.

## Paciente, humor e derrota

- Errar (limiares perdidos, ondas que acertam, traçado fora da faixa) **irrita o
  paciente** — o medidor de paciência sobe e a expressão 3D muda (😊 → 😐 → 😠).
- A **Lari reage ao humor**: fica nervosa (suor + corrida acelerada) quando o
  paciente está irritado e feliz (corações) quando você encadeia acertos.
- Uma **Lari 3D low-poly** acompanha tudo do consultório, comemorando acertos e
  tremendo nos erros.
- Se a paciência chegar a zero… **o paciente encerra o exame (game over)** — dê
  "Repetir fase" para tentar de novo.
- Ao completar uma fase, a Lari comemora soltando **corações pixelados**.

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
