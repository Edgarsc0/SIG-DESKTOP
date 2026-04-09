import { useState, useEffect, useCallback } from 'react'
import { ClockArrowUp, Terminal, Cpu } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useLogs } from '../hooks/useLogs'

function parseProgreso(line) {
  const match = line.match(/(\d+(?:\.\d+)?)%\s*\|\s*(\d+)\/(\d+)\s*\|\s*Fallos:\s*(\d+)/)
  if (!match) return null
  return {
    pct: parseFloat(match[1]),
    actual: parseInt(match[2]),
    total: parseInt(match[3]),
    fallos: parseInt(match[4])
  }
}

function parseWorkers(line) {
  const match = line.match(/\[WORKERS:(\d+)\]/)
  if (!match) return null
  return parseInt(match[1])
}

function parseWorkerProg(line) {
  // [WORKER_PROG:id:pct:actual:total:fallos]
  const match = line.match(/\[WORKER_PROG:(\d+):([\d.]+):(\d+):(\d+):(\d+)\]/)
  if (!match) return null
  return {
    id: parseInt(match[1]),
    pct: parseFloat(match[2]),
    actual: parseInt(match[3]),
    total: parseInt(match[4]),
    fallos: parseInt(match[5])
  }
}

const WORKER_COLORS = [
  {
    bar: 'from-violet-500 to-violet-400',
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20'
  },
  {
    bar: 'from-indigo-500 to-indigo-400',
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20'
  },
  {
    bar: 'from-blue-500 to-blue-400',
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  },
  {
    bar: 'from-cyan-500 to-cyan-400',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20'
  },
  {
    bar: 'from-teal-500 to-teal-400',
    text: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/20'
  },
  {
    bar: 'from-emerald-500 to-emerald-400',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20'
  },
  {
    bar: 'from-fuchsia-500 to-fuchsia-400',
    text: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/20'
  },
  {
    bar: 'from-pink-500 to-pink-400',
    text: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20'
  }
]

function CargarHistorialPos() {
  const [headless, setHeadless] = useState(true)
  const [workers, setWorkers] = useState(() => {
    const saved = localStorage.getItem('workers_historial')
    return saved ? parseInt(saved) : 4
  })
  const [corriendo, setCorriendo] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [numWorkers, setNumWorkers] = useState(null)
  const [progreso, setProgreso] = useState(null)
  const [workerProgs, setWorkerProgs] = useState({})

  const { logs, agregarLog, logsEndRef, containerRef } = useLogs()

  useEffect(() => {
    const cleanup = window.api.onDescargaLog((chunk) => {
      const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean)
      for (const line of lines) {
        const wp = parseWorkerProg(line)
        if (wp) {
          setWorkerProgs((prev) => ({ ...prev, [wp.id]: wp }))
          continue
        }
        const p = parseProgreso(line)
        if (p) {
          setProgreso(p)
          continue
        }
        const wCount = parseWorkers(line)
        if (wCount) setNumWorkers(wCount)
        else agregarLog(line)
      }
    })
    return cleanup
  }, [agregarLog])

  const handleIniciar = useCallback(async () => {
    setCorriendo(true)
    setCompletado(false)
    setProgreso(null)
    setNumWorkers(null)
    setWorkerProgs({})
    agregarLog('Iniciando carga de Historial de Posiciones...')

    try {
      await window.api.iniciarHistorialPos('', headless, workers)
      setCompletado(true)
      agregarLog('Proceso terminado.')
    } catch (err) {
      agregarLog(`ERROR: ${err.message}`)
    } finally {
      setCorriendo(false)
    }
  }, [headless, workers, agregarLog])

  const barWidth = progreso ? Math.round(progreso.pct) : 0
  const workerEntries = Object.values(workerProgs).sort((a, b) => a.id - b.id)

  return (
    <div className="min-h-screen bg-linear-to-br from-stone-950 via-neutral-900 to-stone-950 p-8 flex flex-col">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-900/5 rounded-full blur-3xl" />
      </div>

      {/* Encabezado */}
      <div className="relative flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg bg-white/5 transition-all duration-200 hover:shadow-none hover:bg-white/10">
              <ClockArrowUp size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Historial de Posiciones</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Consulta el historial de cada posición en el SIG y lo carga a la tabla HISTORIAL_POS.
          </p>
        </div>

        <Button
          onClick={handleIniciar}
          disabled={corriendo}
          className="bg-linear-to-r from-violet-700 to-violet-500 hover:from-violet-600 hover:to-violet-400 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-violet-700/20 disabled:opacity-30 disabled:shadow-none transition-all duration-200 flex items-center gap-2"
        >
          <ClockArrowUp size={16} />
          {corriendo ? 'Ejecutando...' : 'Iniciar'}
        </Button>
      </div>

      {/* Configuración */}
      <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col gap-4">
        {/* Toggle headless */}
        <button
          onClick={() => setHeadless((v) => !v)}
          disabled={corriendo}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
        >
          <div
            className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${headless ? 'bg-violet-600' : 'bg-stone-600'}`}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${headless ? 'left-4' : 'left-0.5'}`}
            />
          </div>
          {headless ? 'Sin ventana' : 'Con ventana'}
        </button>

        <div className="h-px bg-white/5" />

        {/* Workers chips */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 shrink-0">
            <Cpu size={13} className="text-violet-400" />
            <span>Workers</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <button
                key={n}
                disabled={corriendo}
                onClick={() => {
                  setWorkers(n)
                  localStorage.setItem('workers_historial', n.toString())
                }}
                className={`w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${
                  workers === n
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-700/40 scale-110'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10 hover:border-white/20'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Barra de progreso global + workers */}
      {(corriendo || progreso) && (
        <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          {/* Global */}
          <div>
            <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                <span>Global</span>
                {numWorkers && (
                  <span className="text-violet-400 font-medium">
                    {numWorkers} worker{numWorkers > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {progreso && (
                <div className="flex items-center gap-3">
                  <span className="text-white font-semibold tabular-nums">
                    {progreso.actual.toLocaleString()} / {progreso.total.toLocaleString()}
                  </span>
                  {progreso.fallos > 0 && (
                    <span className="text-amber-400">✗ {progreso.fallos}</span>
                  )}
                  <span className="text-violet-400 font-bold tabular-nums">
                    {progreso.pct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-600 to-violet-400 rounded-full transition-all duration-300"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            {progreso && progreso.fallos > 0 && (
              <div className="mt-1.5 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500/50 rounded-full transition-all duration-300"
                  style={{ width: `${(progreso.fallos / progreso.total) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* Por worker */}
          {workerEntries.length > 0 && (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/5">
              {workerEntries.map((wp) => {
                const c = WORKER_COLORS[wp.id % WORKER_COLORS.length]
                const done = wp.actual >= wp.total
                return (
                  <div key={wp.id} className={`rounded-lg p-3 border ${c.bg} ${c.border}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${c.text}`}>W{wp.id + 1}</span>
                      <div className="flex items-center gap-2 text-xs">
                        {wp.fallos > 0 && (
                          <span className="text-amber-400/80 tabular-nums">✗{wp.fallos}</span>
                        )}
                        <span
                          className={`font-semibold tabular-nums ${done ? 'text-emerald-400' : c.text}`}
                        >
                          {wp.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-linear-to-r ${c.bar} rounded-full transition-all duration-300`}
                        style={{ width: `${wp.pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                      {wp.actual.toLocaleString()} / {wp.total.toLocaleString()}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Estado final */}
      {completado && progreso && (
        <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-slate-500 text-xs mb-1">Procesadas</p>
            <p className="text-emerald-400 font-bold text-lg">
              {(progreso.total - progreso.fallos).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">No encontradas</p>
            <p className="text-amber-400 font-bold text-lg">{progreso.fallos.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Total</p>
            <p className="text-white font-bold text-lg">{progreso.total.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Logs */}
      {(corriendo || logs.length > 0) && (
        <div className="relative mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-violet-400" />
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Salida del proceso
            </span>
            {corriendo && (
              <span className="flex items-center gap-1.5 text-xs text-violet-400">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                En progreso...
              </span>
            )}
            {completado && !corriendo && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Proceso terminado
              </span>
            )}
          </div>
          <div
            ref={containerRef}
            className="bg-black/40 border border-white/10 rounded-xl p-4 h-64 overflow-y-auto font-mono text-xs resize-y min-h-32 max-h-[80vh]"
          >
            {logs.map((line, i) => (
              <p
                key={i}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.startsWith('ERROR') || line.startsWith('FALLO')
                    ? 'text-red-400'
                    : line.startsWith('AVISO')
                      ? 'text-amber-400'
                      : line.startsWith('✓')
                        ? 'text-emerald-400'
                        : 'text-green-400'
                }`}
              >
                <span className="text-slate-600 select-none mr-2">{`>`}</span>
                {line}
              </p>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  )
}

export default CargarHistorialPos
