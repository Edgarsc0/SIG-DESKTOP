import { useState, useEffect, useRef, useCallback } from 'react'
import { ClockArrowUp, Terminal, FolderOpen } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useLogs } from '../hooks/useLogs'

function parseProgreso(line) {
  // Línea: [████░░░░]  42.3% | 4950/11716 | Fallos: 12
  const match = line.match(/(\d+(?:\.\d+)?)%\s*\|\s*(\d+)\/(\d+)\s*\|\s*Fallos:\s*(\d+)/)
  if (!match) return null
  return {
    pct: parseFloat(match[1]),
    actual: parseInt(match[2]),
    total: parseInt(match[3]),
    fallos: parseInt(match[4])
  }
}

function CargarHistorialPos() {
  const [carpeta, setCarpeta] = useState(() => localStorage.getItem('carpeta_historial') ?? null)
  const [headless, setHeadless] = useState(true)
  const [corriendo, setCorriendo] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [progreso, setProgreso] = useState(null) // { pct, actual, total, fallos }

  const { logs, agregarLog, logsEndRef, containerRef } = useLogs()
  const canceladoRef = useRef(false)

  useEffect(() => {
    const cleanup = window.api.onDescargaLog((msg) => {
      const p = parseProgreso(msg)
      if (p) {
        setProgreso(p)
      } else {
        agregarLog(msg)
      }
    })
    return cleanup
  }, [agregarLog])

  const elegirCarpeta = useCallback(async () => {
    const ruta = await window.api.seleccionarCarpeta()
    if (ruta) {
      setCarpeta(ruta)
      localStorage.setItem('carpeta_historial', ruta)
    }
  }, [])

  const handleIniciar = useCallback(async () => {
    setCorriendo(true)
    setCompletado(false)
    setProgreso(null)
    canceladoRef.current = false
    agregarLog('Iniciando carga de Historial de Posiciones...')

    try {
      await window.api.iniciarHistorialPos(carpeta ?? '', headless)
      setCompletado(true)
      agregarLog('Proceso terminado.')
    } catch (err) {
      agregarLog(`ERROR: ${err.message}`)
    } finally {
      setCorriendo(false)
    }
  }, [carpeta, headless, agregarLog])

  const barWidth = progreso ? Math.round(progreso.pct) : 0

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
      <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col gap-3">
        {/* Carpeta */}
        <button
          onClick={elegirCarpeta}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full"
        >
          <FolderOpen size={15} className="text-violet-400 shrink-0" />
          <span className="truncate">{carpeta ?? 'Elegir carpeta de trabajo (opcional)...'}</span>
        </button>

        <div className="h-px bg-white/5" />

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
      </div>

      {/* Barra de progreso */}
      {(corriendo || progreso) && (
        <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
            <span>Progreso</span>
            {progreso && (
              <div className="flex items-center gap-4">
                <span className="text-white font-semibold">
                  {progreso.actual.toLocaleString()} / {progreso.total.toLocaleString()}
                </span>
                {progreso.fallos > 0 && (
                  <span className="text-amber-400">Fallos: {progreso.fallos}</span>
                )}
                <span className="text-violet-400 font-bold">{progreso.pct.toFixed(1)}%</span>
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
            <div className="mt-2 w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500/60 rounded-full transition-all duration-300"
                style={{ width: `${(progreso.fallos / progreso.total) * 100}%` }}
              />
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
