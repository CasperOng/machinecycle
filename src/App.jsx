import { useEffect, useMemo, useRef, useState } from 'react'
import CPUDiagram from './CPUDiagram.jsx'
import { initialState, buildCycle } from './engine.js'
import { PROGRAMS, buildChoices } from './programs.js'

const PROG_KEYS = Object.keys(PROGRAMS)
const PHASE_LABEL = { fetch: 'FETCH', decode: 'DECODE', execute: 'EXECUTE' }

function loadProgress() {
  try { return JSON.parse(localStorage.getItem('mc-progress')) || {} }
  catch { return {} }
}

export default function App() {
  const [mode, setMode] = useState('learn') // 'learn' | 'game'
  const [progKey, setProgKey] = useState('add')
  const [state, setState] = useState(() => initialState(PROGRAMS.add.ram))
  const [stepIdx, setStepIdx] = useState(0)        // index into current cycle's steps
  const [playKey, setPlayKey] = useState(0)        // bumps to retrigger packet anim
  const [auto, setAuto] = useState(false)
  const [lastStep, setLastStep] = useState(null)   // the step just applied (for diagram)

  // Game state
  const [choices, setChoices] = useState([])
  const [lives, setLives] = useState(3)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [feedback, setFeedback] = useState(null)   // {ok, text}
  const [best, setBest] = useState(() => loadProgress())

  // The micro-step list for whatever the PC currently points at.
  const cycle = useMemo(() => buildCycle(state), [state])
  const currentStep = cycle.steps[stepIdx] ?? null

  function reset(key = progKey) {
    setState(initialState(PROGRAMS[key].ram))
    setStepIdx(0)
    setLastStep(null)
    setFeedback(null)
  }

  function loadProgram(key) {
    setProgKey(key)
    reset(key)
    setLives(3); setScore(0); setStreak(0)
  }

  // Advance one micro-step: apply it, then either move within the cycle or
  // roll over into the next instruction's freshly-built cycle.
  function advance() {
    if (state.halted) return
    const c = buildCycle(state)
    const s = c.steps[stepIdx]
    if (!s) return
    const next = s.apply(state)
    setLastStep(s)
    setPlayKey((k) => k + 1)
    if (stepIdx + 1 < c.steps.length) {
      setStepIdx(stepIdx + 1)
      setState(stripCarries(state, next, false))
    } else {
      setStepIdx(0)
      setState(stripCarries(state, next, true))
    }
  }

  // When we cross into a new instruction we drop the _cirWord/_mdrWord display
  // carries so stale mnemonics don't linger.
  function stripCarries(prev, next, endOfCycle) {
    if (!endOfCycle) return next
    const { _mdrWord, ...rest } = next
    return rest
  }

  // Auto-play loop for learn mode.
  const autoRef = useRef()
  useEffect(() => {
    if (!auto || mode !== 'learn') return
    autoRef.current = setInterval(() => {
      setState((s) => {
        if (s.halted) { setAuto(false); return s }
        return s
      })
      advance()
    }, 1100)
    return () => clearInterval(autoRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, mode, state, stepIdx])

  // ---- Game: present choices for the current step ----
  useEffect(() => {
    if (mode !== 'game') return
    if (state.halted) { setChoices([]); return }
    const c = buildCycle(state)
    const s = c.steps[stepIdx]
    if (s) setChoices(buildChoices(s, c.steps))
    setFeedback(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stepIdx, state.reg.PC, state.halted])

  function answer(choice) {
    if (feedback) return
    if (choice.correct) {
      const gain = 10 + streak * 2
      setScore((v) => v + gain)
      setStreak((v) => v + 1)
      setFeedback({ ok: true, text: `Correct! ${currentStep.desc}` })
      setTimeout(() => advance(), 850)
    } else {
      setStreak(0)
      setLives((v) => v - 1)
      setFeedback({ ok: false, text: `Not quite. The right transfer is ${currentStep.rtn} — ${currentStep.desc}` })
    }
  }

  // Persist best score per program when a run ends.
  useEffect(() => {
    if (mode !== 'game') return
    const dead = lives <= 0
    if (state.halted || dead) {
      setBest((prev) => {
        const prior = prev[progKey] ?? 0
        if (score <= prior) return prev
        const upd = { ...prev, [progKey]: score }
        try { localStorage.setItem('mc-progress', JSON.stringify(upd)) } catch {}
        return upd
      })
    }
  }, [state.halted, lives]) // eslint-disable-line react-hooks/exhaustive-deps

  const gameOver = mode === 'game' && (lives <= 0 || state.halted)
  const badges = earnedBadges({ score, streak, halted: state.halted, lives })

  return (
    <div className="app">
      <header>
        <h1>Machine Cycle Trainer</h1>
        <p className="tag">HKDSE ICT · Fetch → Decode → Execute</p>
        <div className="modes">
          <button className={mode === 'learn' ? 'on' : ''} onClick={() => { setMode('learn'); reset() }}>
            Learn (simulator)
          </button>
          <button className={mode === 'game' ? 'on' : ''}
            onClick={() => { setMode('game'); reset(); setLives(3); setScore(0); setStreak(0) }}>
            You are the Control Unit
          </button>
        </div>
      </header>

      <div className="program-bar">
        <span>Program:</span>
        {PROG_KEYS.map((k) => (
          <button key={k} className={k === progKey ? 'chip on' : 'chip'} onClick={() => loadProgram(k)}>
            {PROGRAMS[k].name}
          </button>
        ))}
      </div>
      <p className="blurb">{PROGRAMS[progKey].blurb}</p>

      <div className="layout">
        <div className="diagram-wrap">
          <CPUDiagram state={state} step={lastStep} playKey={playKey} />
          {lastStep && (
            <div className={`step-readout phase-${lastStep.phase}`}>
              <span className="phase-pill">{PHASE_LABEL[lastStep.phase]}</span>
              <code>{lastStep.rtn}</code>
              <p>{lastStep.desc}</p>
            </div>
          )}
          {state.output.length > 0 && (
            <div className="output-strip">Output: {state.output.join('  ·  ')}</div>
          )}
        </div>

        <aside className="panel">
          {mode === 'learn' ? (
            <LearnPanel
              auto={auto} setAuto={setAuto} advance={advance}
              reset={() => reset()} halted={state.halted}
              nextRtn={currentStep?.rtn} phase={currentStep?.phase}
            />
          ) : (
            <GamePanel
              choices={choices} answer={answer} feedback={feedback}
              lives={lives} score={score} streak={streak}
              gameOver={gameOver} halted={state.halted}
              best={best[progKey] ?? 0} badges={badges}
              restart={() => { reset(); setLives(3); setScore(0); setStreak(0) }}
              nextPhase={currentStep?.phase}
            />
          )}
        </aside>
      </div>
      <footer>Registers: PC · MAR · MDR · CIR · ACC — drag-free, exam-accurate register transfer notation.</footer>
    </div>
  )
}

function LearnPanel({ auto, setAuto, advance, reset, halted, nextRtn, phase }) {
  return (
    <div className="learn">
      <h2>Walk the cycle</h2>
      <p className="hint">Step through each micro-operation, or auto-play to watch data flow across the buses.</p>
      {!halted ? (
        <div className="next-up">
          <span className={`phase-pill phase-${phase}`}>{PHASE_LABEL[phase] ?? ''}</span>
          <code>{nextRtn}</code>
          <span className="next-label">← next step</span>
        </div>
      ) : (
        <p className="halted">Processor halted (HLT). Reset to run again.</p>
      )}
      <div className="btn-row">
        <button className="primary" onClick={advance} disabled={halted}>Step ▸</button>
        <button onClick={() => setAuto((a) => !a)} disabled={halted}>
          {auto ? 'Pause ❙❙' : 'Auto-play ▶'}
        </button>
        <button onClick={reset}>Reset ↺</button>
      </div>
      <Legend />
    </div>
  )
}

function GamePanel({ choices, answer, feedback, lives, score, streak, gameOver, halted, best, badges, restart, nextPhase }) {
  if (gameOver) {
    return (
      <div className="game over">
        <h2>{halted ? 'Program complete! 🎉' : 'Out of lives'}</h2>
        <p className="final">Score: <strong>{score}</strong> · Best: {Math.max(best, score)}</p>
        {badges.length > 0 && (
          <div className="badges">{badges.map((b) => <span key={b} className="badge">{b}</span>)}</div>
        )}
        <button className="primary" onClick={restart}>Play again ↺</button>
      </div>
    )
  }
  return (
    <div className="game">
      <div className="hud">
        <span className="lives">{'❤'.repeat(Math.max(0, lives))}{'·'.repeat(Math.max(0, 3 - lives))}</span>
        <span className="score">{score} pts</span>
        <span className="streak">🔥 {streak}</span>
      </div>
      <h2>What is the correct next micro-step?</h2>
      <p className="hint">You are the Control Unit. Pick the register transfer for the
        <strong> {PHASE_LABEL[nextPhase] ?? ''}</strong> phase.</p>
      <div className="choices">
        {choices.map((c, i) => (
          <button key={i} className="choice" onClick={() => answer(c)} disabled={!!feedback}>
            <code>{c.rtn}</code>
            <span>{c.desc}</span>
          </button>
        ))}
      </div>
      {feedback && (
        <div className={feedback.ok ? 'fb ok' : 'fb bad'}>{feedback.text}</div>
      )}
      <p className="best">Best score on this program: {best}</p>
    </div>
  )
}

function Legend() {
  return (
    <div className="legend">
      <span><i style={{ background: '#2563eb' }} /> address bus</span>
      <span><i style={{ background: '#16a34a' }} /> data bus</span>
      <span><i style={{ background: '#d97706' }} /> control bus</span>
    </div>
  )
}

function earnedBadges({ score, streak, halted, lives }) {
  const out = []
  if (halted && lives === 3) out.push('🏅 Flawless run')
  if (streak >= 6) out.push('⚡ Streak 6+')
  if (score >= 150) out.push('🧠 Cycle Master')
  if (halted) out.push('✅ Program completed')
  return out
}
