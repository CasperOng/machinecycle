# Machine Cycle Trainer — HKDSE ICT

An interactive, gamified web app for teaching the **fetch–decode–execute cycle**
to HKDSE ICT students. Students watch data flow across the address/data/control
buses between the CPU registers (PC, MAR, MDR, CIR, ACC) and RAM — then take the
controls themselves.

## Two modes

- **Learn (simulator)** — step through each micro-operation or auto-play.
  Every step shows exam-accurate register transfer notation (e.g. `[MAR] ← [PC]`)
  with a plain-English explanation, and animates a packet along the correct bus.
- **You are the Control Unit** — the game. At each micro-step you pick the
  correct register transfer from four options (one right, three plausible
  distractors). Earn points, build streaks, keep your 3 lives, and unlock badges.
  Best score per program is saved to `localStorage`.

## Sample programs

| Program | What it teaches |
|---------|-----------------|
| Add two numbers | LOAD / ADD / OUT / HLT basics |
| Subtract | ALU subtraction |
| Compute & store | STORE writing back to memory |
| Countdown loop | JMP + BRZ branching, the PC jumping |

## Run it

```bash
npm install
npm run dev      # dev server (Vite)
npm run build    # production build → dist/
npm run preview  # serve the built app
```

Requires Node 18+. Pure client-side React — no backend, hosts as a static site.

## Where things live

- `src/engine.js` — the machine-cycle model: instruction set and the micro-step
  expansion of fetch/decode/execute (register-transfer notation + state mutation).
- `src/programs.js` — sample programs and the game's distractor generator.
- `src/CPUDiagram.jsx` — the SVG diagram, register highlighting, and bus packet animation.
- `src/App.jsx` — modes, scoring, lives, streaks, badges, progress persistence.
