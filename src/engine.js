// engine.js — HKDSE machine-cycle model.
//
// One "program" is a list of instructions placed in RAM. The engine expands
// the fetch–decode–execute cycle for the instruction currently pointed at by
// the PC into an ordered list of micro-steps. Each micro-step carries:
//   - register-transfer notation (rtn) and a plain-English description
//   - which bus (if any) lights up, and the source/destination components
//   - an apply() that returns the next machine state (pure, no mutation)
//
// The same step list drives the auto-play simulator AND the "You are the
// Control Unit" game (where the correct step is hidden among distractors).

export const REGISTERS = ['PC', 'MAR', 'MDR', 'CIR', 'ACC']

// HKDSE-style instruction set (Little Man Computer lineage).
// operand is a RAM address unless the opcode is operand-less.
export const ISA = {
  LOAD:  { needsOperand: true,  label: 'LOAD',  text: 'ACC ← contents of address' },
  STORE: { needsOperand: true,  label: 'STORE', text: 'contents of address ← ACC' },
  ADD:   { needsOperand: true,  label: 'ADD',   text: 'ACC ← ACC + contents of address' },
  SUB:   { needsOperand: true,  label: 'SUB',   text: 'ACC ← ACC − contents of address' },
  JMP:   { needsOperand: true,  label: 'JMP',   text: 'PC ← address (unconditional jump)' },
  BRZ:   { needsOperand: true,  label: 'BRZ',   text: 'PC ← address only if ACC = 0 (branch if zero)' },
  OUT:   { needsOperand: false, label: 'OUT',   text: 'output ← ACC' },
  HLT:   { needsOperand: false, label: 'HLT',   text: 'halt the processor' },
}

// A machine word in RAM: either an instruction or plain data.
export const word = (opcode, operand = 0) => ({ opcode, operand })
export const data = (value) => ({ opcode: 'DATA', operand: value })

// Deep-ish clone of the mutable machine state. The _cirWord / _mdrWord display
// carries are preserved so the CIR keeps showing the decoded instruction
// (e.g. "ADD 6") through decode and execute, not just for one step.
function cloneState(s) {
  return {
    reg: { ...s.reg },
    ram: s.ram.map((w) => ({ ...w })),
    output: [...s.output],
    halted: s.halted,
    _cirWord: s._cirWord ?? null,
    _mdrWord: s._mdrWord ?? null,
  }
}

export function initialState(ram) {
  return {
    reg: { PC: 0, MAR: 0, MDR: 0, CIR: 0, ACC: 0 },
    ram: ram.map((w) => ({ ...w })),
    output: [],
    halted: false,
  }
}

// Render a RAM word for the MDR/CIR display: instructions show as "ADD 9".
export function wordToText(w) {
  if (!w) return '0'
  if (w.opcode === 'DATA') return String(w.operand)
  const meta = ISA[w.opcode]
  return meta?.needsOperand ? `${w.opcode} ${w.operand}` : w.opcode
}

// Numeric view of a word (data uses its value; an instruction packs as well).
function wordValue(w) {
  return w.opcode === 'DATA' ? w.operand : w.operand
}

let _id = 0
const step = (cfg) => ({ id: ++_id, bus: null, from: null, to: null, ...cfg })

// ---- Fetch: identical for every instruction --------------------------------
function fetchSteps() {
  return [
    step({
      phase: 'fetch',
      rtn: '[MAR] ← [PC]',
      desc: 'Copy the address of the next instruction from the PC into the MAR.',
      from: 'PC', to: 'MAR', bus: null,
      apply: (s) => {
        const n = cloneState(s)
        n.reg.MAR = n.reg.PC
        return n
      },
    }),
    step({
      phase: 'fetch',
      rtn: '[MDR] ← [memory[MAR]]',
      desc: 'Place the MAR address on the address bus; memory returns the instruction on the data bus into the MDR.',
      from: 'RAM', to: 'MDR', bus: 'data',
      apply: (s) => {
        const n = cloneState(s)
        n.reg.MDR = wordValue(n.ram[n.reg.MAR])
        n._mdrWord = n.ram[n.reg.MAR] // carry the decoded word for display
        return n
      },
    }),
    step({
      phase: 'fetch',
      rtn: '[PC] ← [PC] + 1',
      desc: 'Increment the PC so it points to the following instruction.',
      from: 'PC', to: 'PC', bus: null,
      apply: (s) => {
        const n = cloneState(s)
        n.reg.PC = n.reg.PC + 1
        return n
      },
    }),
    step({
      phase: 'fetch',
      rtn: '[CIR] ← [MDR]',
      desc: 'Copy the fetched instruction from the MDR into the CIR.',
      from: 'MDR', to: 'CIR', bus: null,
      apply: (s) => {
        const n = cloneState(s)
        n.reg.CIR = n.reg.MDR
        n._cirWord = s._mdrWord ?? s.ram[s.reg.MAR]
        return n
      },
    }),
  ]
}

// ---- Decode ----------------------------------------------------------------
function decodeStep(instr) {
  const meta = ISA[instr.opcode]
  return step({
    phase: 'decode',
    rtn: 'decode [CIR]',
    desc: `The control unit decodes the instruction in the CIR: ${instr.opcode}${
      meta?.needsOperand ? ' ' + instr.operand : ''
    } — ${meta?.text ?? 'unknown opcode'}.`,
    from: 'CIR', to: 'CU', bus: 'control',
    apply: (s) => cloneState(s),
  })
}

// ---- Execute: depends on the opcode ---------------------------------------
function executeSteps(instr) {
  const a = instr.operand
  switch (instr.opcode) {
    case 'LOAD':
      return [
        memAddrStep(a, 'Send the operand address to the MAR.'),
        memReadStep('Read the operand from memory into the MDR.'),
        step({
          phase: 'execute', rtn: '[ACC] ← [MDR]',
          desc: 'Copy the value from the MDR into the accumulator.',
          from: 'MDR', to: 'ACC',
          apply: (s) => { const n = cloneState(s); n.reg.ACC = n.reg.MDR; return n },
        }),
      ]
    case 'ADD':
    case 'SUB': {
      const add = instr.opcode === 'ADD'
      return [
        memAddrStep(a, 'Send the operand address to the MAR.'),
        memReadStep('Read the operand from memory into the MDR.'),
        step({
          phase: 'execute',
          rtn: add ? '[ACC] ← [ACC] + [MDR]' : '[ACC] ← [ACC] − [MDR]',
          desc: `The ALU ${add ? 'adds the MDR to' : 'subtracts the MDR from'} the accumulator; the result returns to the ACC.`,
          from: 'ALU', to: 'ACC',
          apply: (s) => {
            const n = cloneState(s)
            n.reg.ACC = add ? n.reg.ACC + n.reg.MDR : n.reg.ACC - n.reg.MDR
            return n
          },
        }),
      ]
    }
    case 'STORE':
      return [
        memAddrStep(a, 'Send the destination address to the MAR.'),
        step({
          phase: 'execute', rtn: '[MDR] ← [ACC]',
          desc: 'Copy the accumulator value into the MDR ready to be written.',
          from: 'ACC', to: 'MDR',
          apply: (s) => { const n = cloneState(s); n.reg.MDR = n.reg.ACC; n._mdrWord = null; return n },
        }),
        step({
          phase: 'execute', rtn: '[memory[MAR]] ← [MDR]',
          desc: 'Write the MDR to memory at the address held in the MAR (address bus + data bus).',
          from: 'MDR', to: 'RAM', bus: 'data',
          apply: (s) => {
            const n = cloneState(s)
            n.ram[n.reg.MAR] = data(n.reg.MDR)
            return n
          },
        }),
      ]
    case 'JMP':
      return [
        step({
          phase: 'execute', rtn: '[PC] ← operand',
          desc: `Load the jump address (${a}) into the PC so the next fetch starts there.`,
          from: 'CIR', to: 'PC',
          apply: (s) => { const n = cloneState(s); n.reg.PC = a; return n },
        }),
      ]
    case 'BRZ':
      return [
        step({
          phase: 'execute', rtn: 'if [ACC] = 0: [PC] ← operand',
          desc: `The control unit checks the ACC. If it is zero, the PC is set to ${a}; otherwise the PC is left to continue in sequence.`,
          from: 'CIR', to: 'PC',
          apply: (s) => { const n = cloneState(s); if (n.reg.ACC === 0) n.reg.PC = a; return n },
        }),
      ]
    case 'OUT':
      return [
        step({
          phase: 'execute', rtn: 'output ← [ACC]',
          desc: 'Send the accumulator value to the output.',
          from: 'ACC', to: 'OUT', bus: 'data',
          apply: (s) => { const n = cloneState(s); n.output.push(n.reg.ACC); return n },
        }),
      ]
    case 'HLT':
      return [
        step({
          phase: 'execute', rtn: 'halt',
          desc: 'Stop the fetch–execute cycle.',
          from: 'CU', to: 'CU',
          apply: (s) => { const n = cloneState(s); n.halted = true; return n },
        }),
      ]
    default:
      return []
  }
}

function memAddrStep(addr, desc) {
  return step({
    phase: 'execute', rtn: `[MAR] ← ${addr}`,
    desc, from: 'CIR', to: 'MAR', bus: 'address',
    apply: (s) => { const n = cloneState(s); n.reg.MAR = addr; return n },
  })
}
function memReadStep(desc) {
  return step({
    phase: 'execute', rtn: '[MDR] ← [memory[MAR]]',
    desc, from: 'RAM', to: 'MDR', bus: 'data',
    apply: (s) => {
      const n = cloneState(s)
      n.reg.MDR = wordValue(n.ram[n.reg.MAR])
      n._mdrWord = null // MDR now holds operand data, not an instruction
      return n
    },
  })
}

// Build the full micro-step list for the instruction the PC currently selects.
export function buildCycle(state) {
  const instr = state.ram[state.reg.PC]
  if (!instr) return { instr: null, steps: [] }
  const steps = [...fetchSteps(), decodeStep(instr), ...executeSteps(instr)]
  return { instr, steps }
}
