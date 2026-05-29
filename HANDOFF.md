# Project Handoff: Machine Cycle Trainer (HKDSE ICT)

## What this is
An interactive, gamified web app that teaches HKDSE ICT students the **fetch–decode–execute machine cycle**. The pedagogical idea: the cycle is invisible and instant in real hardware, so the app makes data *physically move* on screen and lets the student *become the Control Unit*. Register acronyms (PC, MAR, MDR, CIR, ACC) are taught through repeated, exam-accurate register transfer notation rather than memorization.

## Decisions already locked in
- **Stack:** React + Vite (client-side only, no backend, hosts as a static site).
- **Audience:** HKDSE ICT exam-focused — exact syllabus terminology and register-transfer notation (e.g. `[MAR] ← [PC]`).
- **First build scope:** animated simulator + the "You are the Control Unit" game.
- Project lives at `/Users/casperong/AppleComparison/machinecycle` (inside a git repo).
- Scaffolded **manually** (not `create-vite`) because the current `create-vite` needs a newer Node than 20.10. Pinned versions: `react@18.3.1`, `react-dom@18.3.1`, `vite@5.4.2`, `@vitejs/plugin-react@4.3.1`.

## Current state — WORKING and VERIFIED
- `npm run build` compiles clean (34 modules, no errors); dev server serves correctly (`npm run dev`).
- All four sample programs execute to correct results.

### File map
- `src/engine.js` — the machine-cycle model. Pure, immutable state (`{reg, ram, output, halted}`). Expands the instruction at `PC` into an ordered list of micro-steps; each step carries phase (fetch/decode/execute), register-transfer notation, plain-English description, which bus lights up, source/destination component, and a pure `apply(state)→state`.
- `src/programs.js` — four sample programs laid out as RAM, plus the game's distractor generator (`buildChoices`) that mixes real RTNs from other phases with canned common-mistake transfers like `[PC] ← [MAR]`.
- `src/CPUDiagram.jsx` — SVG diagram (760×520 viewBox). CPU box (CU + ALU), the five registers, RAM grid with address/contents + PC pointer, three colour-coded buses, and an animated glowing packet that travels source→destination via `requestAnimationFrame`.
- `src/App.jsx` — two modes, scoring, 3 lives, streaks, badges, `localStorage` best-score persistence.
- `src/styles.css`, `src/main.jsx`, `index.html`, `package.json`, `vite.config.js`, `README.md`.

### Instruction set (ISA)
`LOAD`, `STORE`, `ADD`, `SUB`, `JMP`, `BRZ` (branch if ACC=0), `OUT`, `HLT`. Little Man Computer lineage, mapped to HKDSE.

### Sample programs (verified output)
- Add two numbers → `15`
- Subtract → `12`
- Compute & store → `42`
- Countdown loop (JMP + BRZ) → `[3, 2, 1, 0]` then halts

### Two modes
- **Learn (simulator):** step manually or auto-play; each micro-step shows the RTN, an explanation, a FETCH/DECODE/EXECUTE phase pill, animates a packet along the correct bus, and highlights the active register + RAM cell.
- **"You are the Control Unit" (game):** at each micro-step the student picks the correct register transfer from 4 options (1 correct, 3 distractors). Points scale with streak, 3 lives, badges (Flawless run, Cycle Master, etc.), best score per program saved to `localStorage`.

## Two fixes made during the build (context worth keeping)
1. The original countdown loop used an unconditional `JMP` with no exit and ran forever. Added a `BRZ` (branch-if-zero) instruction so it terminates — also a richer teaching example of conditional branching.
2. Fixed register-display "carries" so the CIR keeps showing the decoded instruction (e.g. `ADD 6`) through decode/execute instead of flickering back to a raw number; MDR clears its mnemonic when it later holds operand data.

## Roadmap / next steps (not yet built)
The engine is fully data-driven, so both of these are natural extensions:
- **Debug mode:** present a broken cycle (e.g. PC fails to increment → infinite loop) and have the student find/fix the faulty micro-step.
- **Program builder:** let students write their own short assembly programs and watch them run through the cycle, with a "compute X" puzzle goal.
- Level progression (L1 fetch-only → L5 timed/debug), and an HKDSE-style quiz between levels tying back to exam vocabulary.

## How to run
```
cd /Users/casperong/AppleComparison/machinecycle
npm install
npm run dev      # Vite dev server
npm run build    # production build → dist/
```
