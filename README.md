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

## Credibilidade do Laudo, penalidades e quiz

O jogo agora tem **dificuldade real**: a barra de **Credibilidade do Laudo**
começa em 100% e cai com cada erro clínico — chegando a **0%, o exame é
invalidado (Game Over)**. Cada erro exibe um **alerta clínico** explicando o
conceito de fonoaudiologia envolvido:

| Erro | Fase | Penalidade |
| --- | --- | --- |
| Falso-positivo (tocar sem o paciente ter levantado a mão) | 1 | −20% |
| Omissão (deixar de registrar um limiar sinalizado) | 1 | −20% |
| Queda fora do traçado (não saltar a queda brusca/gap) | 1 | −25% |
| Ruído mascarante (raios vermelhos no trajeto) | 1 | −25% |
| Desvio da curva (fora da faixa tracejada) | 2 | −15%/s |
| Falha de defesa (onda presente atinge a Lari) | 3 | −25% |
| Falso reflexo (escudo sem resposta presente) | 3 | −25% |

- A velocidade aumenta nas frequências agudas (4000/8000 Hz) e a janela de acerto
  é mais estreita; os limiares sinalizados acendem em amarelo antes da janela
  (o paciente 3D levanta a mão como aviso).
- Na Fase 2, a complacência tem **física de 2ª ordem** (aceleração + arrasto):
  segurar/soltar gera momento e o traçado desenha **arcos suaves**, capazes de
  acompanhar as parábolas das curvas de Jerger.
- Na Fase 3, as ondas podem ser **presentes** (bloqueie!) ou **ausentes**
  (tracejadas e cinzas — não ative o escudo); o brilho no fone só acende para
  respostas presentes.

### Quiz do laudo

Ao fim de cada gráfico o jogo pausa e mostra o **Laudo do Paciente**: 3 opções de
diagnóstico baseadas no traçado jogado (ex.: "Perda neurossensorial em rampa",
"Curva Timpanométrica Tipo C", "Integridade da via auditiva — VII e VIII pares").
**Acertou: +400 pontos. Errou: Game Over imediato!**

## Toasty! 🍞

Todo Game Over dispara o easter egg estilo Mortal Kombat: a **professora
avaliadora loira** (retrato pixel art procedural — óculos grandes, pérolas,
blusa preta com renda) desliza pelo canto inferior direito com som retrô
sintetizado e grita **"REFAÇA O EXAME!"** / **"LAUDO REPROVADO!"**, seguida do
painel com o motivo clínico da reprovação.

## Câmeras cinematográficas

O diretor de câmera 3D alterna planos automaticamente durante o exame: **plano
geral do consultório**, **close no rosto da Lari 3D** (também usado na
conclusão de fase), **plano por trás do paciente** com a Lari operando o
audiômetro ao fundo e **close da mesa do audiômetro** — tudo com transições
suaves. A mesa foi rebaixada (tampo em y = 0,7) e a Lari 3D ampliada para que
tronco, jaleco, braços e cabeça apareçam claramente.

## Humor e animações

- A **Lari reage à credibilidade**: nervosa (suor + corrida acelerada) abaixo de
  35% e feliz (corações) acima de 65%; a Lari 3D e os pacientes 3D espelham o
  humor em tempo real (mão levantada, comemoração, dúvida, raiva).
- Ao completar uma fase, a Lari comemora soltando **corações pixelados**.
- No **Laudo Final**, a Lari 2D anima conforme o conceito: comemora nos conceitos
  A/B, corre no C e fica parada e suando no D — ao lado do painel, no mesmo
  plano do menu.

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
