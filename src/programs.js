// Sample programs students can load. Each is RAM laid out as words.
import { word, data } from './engine.js'

export const PROGRAMS = {
  add: {
    name: 'Add two numbers',
    blurb: 'LOAD the first number, ADD the second, OUT the result, then HLT.',
    ram: [
      word('LOAD', 5), // 0
      word('ADD', 6),  // 1
      word('OUT'),     // 2
      word('HLT'),     // 3
      data(0),         // 4  (spare)
      data(7),         // 5  first operand
      data(8),         // 6  second operand
    ],
  },
  subtract: {
    name: 'Subtract',
    blurb: 'LOAD 20, SUB 8, output the difference.',
    ram: [
      word('LOAD', 4), // 0
      word('SUB', 5),  // 1
      word('OUT'),     // 2
      word('HLT'),     // 3
      data(20),        // 4
      data(8),         // 5
    ],
  },
  store: {
    name: 'Compute & store',
    blurb: 'Add two numbers and STORE the result back into memory before output.',
    ram: [
      word('LOAD', 6), // 0
      word('ADD', 7),  // 1
      word('STORE', 8),// 2
      word('OUT'),     // 3
      word('HLT'),     // 4
      data(0),         // 5
      data(15),        // 6
      data(27),        // 7
      data(0),         // 8  result lands here
    ],
  },
  loop: {
    name: 'Countdown loop (JMP + BRZ)',
    blurb: 'Output a value, branch to HLT when it reaches zero, otherwise subtract 1 and JMP back. Watch the PC jump.',
    ram: [
      word('LOAD', 7), // 0  ACC ← start value
      word('OUT'),     // 1  print current value
      word('BRZ', 6),  // 2  if ACC == 0, branch to HLT at 6
      word('SUB', 8),  // 3  ACC ← ACC - 1
      word('JMP', 1),  // 4  loop back to OUT
      word('HLT'),     // 5  (unreached padding / safety halt)
      word('HLT'),     // 6  branch target
      data(3),         // 7  start value
      data(1),         // 8  step
    ],
  },
}

// Build multiple-choice options for the game: the correct micro-step plus
// three distractors drawn from the other phases / common student mistakes.
// Returns shuffled {rtn, desc, correct} objects.
export function buildChoices(correctStep, allSteps, rng = Math.random) {
  const correct = { rtn: correctStep.rtn, desc: shortDesc(correctStep), correct: true }

  // Pool of distractors: real RTNs from elsewhere in the cycle + canned mistakes.
  const pool = new Set()
  for (const s of allSteps) {
    if (s.rtn !== correctStep.rtn) pool.add(s.rtn)
  }
  COMMON_MISTAKES.forEach((m) => pool.add(m))
  pool.delete(correctStep.rtn)

  const distractors = shuffle([...pool], rng)
    .slice(0, 3)
    .map((rtn) => ({ rtn, desc: mistakeDesc(rtn), correct: false }))

  return shuffle([correct, ...distractors], rng)
}

const COMMON_MISTAKES = [
  '[PC] ← [MAR]',
  '[CIR] ← [PC]',
  '[ACC] ← [PC]',
  '[MAR] ← [MDR]',
  '[PC] ← [PC] − 1',
  '[MDR] ← [CIR]',
]

function shortDesc(step) {
  return step.desc.length > 90 ? step.desc.slice(0, 87) + '…' : step.desc
}

function mistakeDesc(rtn) {
  return DESCS[rtn] ?? 'A possible register transfer — but is it the right one for this step?'
}

const DESCS = {
  '[MAR] ← [PC]': 'Copy the PC into the MAR.',
  '[MDR] ← [memory[MAR]]': 'Read memory at MAR into the MDR.',
  '[PC] ← [PC] + 1': 'Increment the program counter.',
  '[CIR] ← [MDR]': 'Move the fetched instruction into the CIR.',
  '[PC] ← [MAR]': 'Copy the MAR into the PC.',
  '[CIR] ← [PC]': 'Copy the PC straight into the CIR.',
  '[ACC] ← [PC]': 'Copy the PC into the accumulator.',
  '[MAR] ← [MDR]': 'Copy the MDR into the MAR.',
  '[PC] ← [PC] − 1': 'Decrement the program counter.',
  '[MDR] ← [CIR]': 'Copy the CIR into the MDR.',
}

function shuffle(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
