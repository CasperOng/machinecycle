import { useEffect, useState } from 'react'
import { wordToText, ISA } from './engine.js'

// Fixed coordinate model for the SVG diagram. Everything is positioned in this
// 760×520 space and scaled responsively by the viewBox.
const POS = {
  PC:  { x: 60,  y: 70,  w: 150, h: 46, label: 'PC',  full: 'Program Counter' },
  CIR: { x: 60,  y: 130, w: 150, h: 46, label: 'CIR', full: 'Current Instruction Register' },
  ACC: { x: 60,  y: 240, w: 150, h: 46, label: 'ACC', full: 'Accumulator' },
  MAR: { x: 250, y: 70,  w: 150, h: 46, label: 'MAR', full: 'Memory Address Register' },
  MDR: { x: 250, y: 130, w: 150, h: 46, label: 'MDR', full: 'Memory Data Register' },
}
const CU  = { x: 250, y: 240, w: 150, h: 46, label: 'Control Unit' }
const ALU = { x: 60,  y: 320, w: 150, h: 56, label: 'ALU' }
const CPU_BOX = { x: 30, y: 30, w: 400, h: 380 }
const RAM_BOX = { x: 470, y: 30, w: 260, h: 460 }

const BUS_COLORS = { address: '#2563eb', data: '#16a34a', control: '#d97706' }

// Centre point of a named component, for drawing the moving packet.
function centre(name) {
  if (name === 'CU') return { x: CU.x + CU.w / 2, y: CU.y + CU.h / 2 }
  if (name === 'ALU') return { x: ALU.x + ALU.w / 2, y: ALU.y + ALU.h / 2 }
  if (name === 'RAM') return { x: RAM_BOX.x + 30, y: 250 }
  if (name === 'OUT') return { x: RAM_BOX.x + RAM_BOX.w / 2, y: RAM_BOX.y + RAM_BOX.h + 4 }
  const p = POS[name]
  if (p) return { x: p.x + p.w / 2, y: p.y + p.h / 2 }
  return null
}

function Register({ id, value, active }) {
  const p = POS[id]
  return (
    <g className={active ? 'reg active' : 'reg'}>
      <rect x={p.x} y={p.y} width={p.w} height={p.h} rx="8" />
      <text x={p.x + 10} y={p.y + 19} className="reg-label">{p.label}</text>
      <text x={p.x + 10} y={p.y + 37} className="reg-sub">{p.full}</text>
      <text x={p.x + p.w - 12} y={p.y + 30} className="reg-val" textAnchor="end">{value}</text>
    </g>
  )
}

// The glowing packet travelling between two components along a bus.
function Packet({ step, playKey }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    setT(0)
    let raf, start
    const dur = 650
    const tick = (now) => {
      if (!start) start = now
      const p = Math.min(1, (now - start) / dur)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playKey])

  if (!step?.from || !step?.to) return null
  const a = centre(step.from)
  const b = centre(step.to)
  if (!a || !b) return null
  if (step.from === step.to) return null // self-transfer (e.g. PC+1) — no travel

  const x = a.x + (b.x - a.x) * t
  const y = a.y + (b.y - a.y) * t
  const color = step.bus ? BUS_COLORS[step.bus] : '#7c3aed'
  return (
    <g className="packet">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="3"
        strokeDasharray="6 5" opacity="0.5" />
      <circle cx={x} cy={y} r="11" fill={color} />
      <circle cx={x} cy={y} r="11" fill="none" stroke="#fff" strokeWidth="2" />
    </g>
  )
}

export default function CPUDiagram({ state, step, playKey }) {
  const activeName = step?.to
  const ramSelected = state.reg.MAR

  return (
    <svg className="diagram" viewBox="0 0 760 520" role="img"
      aria-label="CPU and memory diagram showing registers and buses">
      {/* CPU enclosure */}
      <rect {...rectProps(CPU_BOX)} rx="14" className="cpu-box" />
      <text x={CPU_BOX.x + 12} y={CPU_BOX.y + 20} className="box-title">CPU</text>

      {/* RAM enclosure */}
      <rect {...rectProps(RAM_BOX)} rx="14" className="ram-box" />
      <text x={RAM_BOX.x + 12} y={RAM_BOX.y + 20} className="box-title">Main Memory (RAM)</text>

      {/* Bus backbone between CPU and RAM */}
      {['address', 'data', 'control'].map((bus, i) => (
        <line key={bus} x1={CPU_BOX.x + CPU_BOX.w} y1={120 + i * 40}
          x2={RAM_BOX.x} y2={120 + i * 40}
          stroke={BUS_COLORS[bus]} strokeWidth={step?.bus === bus ? 6 : 3}
          opacity={step?.bus === bus ? 1 : 0.35} />
      ))}
      <text x={435} y={114} className="bus-tag" fill={BUS_COLORS.address}>address bus</text>
      <text x={435} y={154} className="bus-tag" fill={BUS_COLORS.data}>data bus</text>
      <text x={435} y={194} className="bus-tag" fill={BUS_COLORS.control}>control bus</text>

      {/* Registers */}
      {Object.keys(POS).map((id) => (
        <Register key={id} id={id} value={regDisplay(id, state)} active={activeName === id} />
      ))}

      {/* CU + ALU */}
      <g className={activeName === 'CU' ? 'unit active' : 'unit'}>
        <rect {...rectProps(CU)} rx="8" />
        <text x={CU.x + CU.w / 2} y={CU.y + 28} textAnchor="middle" className="unit-label">{CU.label}</text>
      </g>
      <g className={activeName === 'ALU' ? 'unit active' : 'unit'}>
        <rect {...rectProps(ALU)} rx="8" />
        <text x={ALU.x + ALU.w / 2} y={ALU.y + 26} textAnchor="middle" className="unit-label">{ALU.label}</text>
        <text x={ALU.x + ALU.w / 2} y={ALU.y + 44} textAnchor="middle" className="reg-sub">Arithmetic Logic Unit</text>
      </g>

      {/* RAM cells */}
      {state.ram.map((w, addr) => {
        const cy = RAM_BOX.y + 40 + addr * 30
        if (cy > RAM_BOX.y + RAM_BOX.h - 14) return null
        const isSel = addr === ramSelected
        const isPC = addr === state.reg.PC
        return (
          <g key={addr} className={isSel ? 'cell sel' : 'cell'}>
            <rect x={RAM_BOX.x + 14} y={cy} width={RAM_BOX.w - 28} height="26" rx="5" />
            <text x={RAM_BOX.x + 24} y={cy + 18} className="cell-addr">{addr}</text>
            <text x={RAM_BOX.x + RAM_BOX.w - 24} y={cy + 18} textAnchor="end" className="cell-val">
              {wordToText(w)}
            </text>
            {isPC && <text x={RAM_BOX.x + 56} y={cy + 18} className="cell-pc">▶</text>}
          </g>
        )
      })}

      <Packet step={step} playKey={playKey} />
    </svg>
  )
}

function rectProps(b) { return { x: b.x, y: b.y, width: b.w, height: b.h } }

// Registers that hold an instruction (CIR, and MDR right after a fetch) show
// the decoded mnemonic; otherwise the raw number.
function regDisplay(id, state) {
  if (id === 'CIR' && state._cirWord) return wordToText(state._cirWord)
  if (id === 'MDR' && state._mdrWord) return wordToText(state._mdrWord)
  return state.reg[id]
}
