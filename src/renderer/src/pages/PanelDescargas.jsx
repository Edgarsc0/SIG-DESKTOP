import { useState, useEffect, useRef } from 'react'
import {
  FileSpreadsheet,
  Check,
  Download,
  Files,
  FolderOpen,
  Terminal,
  X,
  FolderCheck
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

const archivos = [
  {
    nombre: 'Posiciones.csv',
    id: 1
  },
  {
    nombre: 'Empleados_Activos.csv',
    id: 2
  },
  {
    nombre: 'Empleados_Bajas.csv',
    id: 3
  },
  {
    nombre: 'Familiares.csv',
    id: 4
  },
  {
    nombre: 'Escolaridad.csv',
    id: 7
  },
  {
    nombre: 'Movimientos_ANAM_EMPLEADOS.xlsx',
    id: 'movimientos_anam_empleados'
  }
]

function PanelDescargas() {
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [carpeta, setCarpeta] = useState(() => localStorage.getItem('carpeta_descarga') ?? null)
  const [headless, setHeadless] = useState(true)
  const [logs, setLogs] = useState([])
  const [descargando, setDescargando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [downloadDir, setDownloadDir] = useState(null)
  const logsEndRef = useRef(null)
  const canceladoRef = useRef(false)

  useEffect(() => {
    const cleanup = window.api.onDescargaLog((msg) => {
      setLogs((prev) => [...prev, msg.trim()])
    })
    return cleanup
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const elegirCarpeta = async () => {
    const ruta = await window.api.seleccionarCarpeta()
    if (ruta) {
      setCarpeta(ruta)
      localStorage.setItem('carpeta_descarga', ruta)
    }
  }

  const toggle = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleTodos = () => {
    if (seleccionados.size === archivos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(archivos.map((a) => a.id)))
    }
  }

  const handleCancelar = async () => {
    canceladoRef.current = true
    await window.api.cancelarDescarga()
  }

  const handleDescargarSeleccionados = async () => {
    if (!carpeta) return
    setLogs([])
    setDescargando(true)
    setCompletado(false)
    setCancelado(false)
    canceladoRef.current = false
    let descargarMovimientos = false
    try {
      const ids = [...seleccionados]
      if (ids.includes('movimientos_anam_empleados')) {
        descargarMovimientos = true
        const index = ids.indexOf('movimientos_anam_empleados')

        //Quitamos el archivo de descarga de movimientos de empleados.
        ids.splice(index, 1)
      }

      const downloadDir = await window.api.crearCarpetaDescarga(carpeta)
      setDownloadDir(downloadDir)

      if (ids.length !== 0) {
        //Descargamos primero los archivos seleccionados.
        await window.api.iniciarDescarga(ids, downloadDir, headless)
      }

      //Descargamos el archivo de movimientos de empleados.
      if (descargarMovimientos)
        await window.api.iniciarDescargaMovimientosAnamXlsx(downloadDir, headless)

      setCompletado(true)
      setLogs((prev) => [...prev, 'Proceso terminado.'])
    } catch {
      if (canceladoRef.current) {
        setCancelado(true)
        setLogs((prev) => [...prev, 'Proceso cancelado.'])
      }
    } finally {
      setDescargando(false)
    }
  }

  const todosSeleccionados = seleccionados.size === archivos.length

  return (
    <div className="min-h-screen bg-linear-to-br from-stone-950 via-neutral-900 to-stone-950 p-8 flex flex-col">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-900/5 rounded-full blur-3xl" />
      </div>

      {/* Encabezado */}
      <div className="relative flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg  flex items-center justify-center shadow-lg shadow-black-500/20 bg-white/5 transition-all duration-200 hover:shadow-none hover:bg-white/10">
              <Download size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Panel de Descargas</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Selecciona los archivos que deseas descargar
          </p>
          <p className="text-slate-400 text-sm ml-12">
            Selecciona uno o más archivos y haz clic en Descargar. Cada archivo pasa por una
            validación automática para corregir inconsistencias en el formato de filas corrigiendo
            posibles filas desplazadas.
          </p>
        </div>

        <div className="flex-col-reverse sm:flex-row sm:items-center gap-y-4 sm:gap-0">
          <Button
            onClick={handleDescargarSeleccionados}
            disabled={seleccionados.size === 0 || !carpeta || descargando}
            className="bg-linear-to-r from-amber-700 to-amber-500 hover:from-amber-600 hover:to-amber-400 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-amber-700/20 disabled:opacity-30 disabled:shadow-none transition-all duration-200 flex items-center gap-2"
          >
            <Download size={16} />
            Descargar{seleccionados.size > 0 ? ` (${seleccionados.size})` : ''}
          </Button>

          {descargando && (
            <Button
              onClick={handleCancelar}
              className="bg-red-600/20 mt-2 w-full hover:bg-red-600/30 border border-red-500/40 text-red-400 hover:text-red-300 font-semibold px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2"
            >
              <X size={16} />
              Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Barra de estadísticas */}
      <div className="relative flex items-center justify-between mb-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm gap-4 overflow-hidden">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2 text-slate-400 text-sm shrink-0">
            <Files size={16} />
            <span>{archivos.length} archivos</span>
          </div>
          <div className="w-px h-4 bg-white/10 shrink-0" />
          <div className="flex items-center gap-2 text-sm shrink-0">
            <span className="text-slate-400">Sel:</span>
            <span className="text-amber-400 font-semibold">{seleccionados.size}</span>
          </div>
          <div className="w-px h-4 bg-white/10 shrink-0" />
          <button
            onClick={elegirCarpeta}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors min-w-0"
          >
            <FolderOpen size={15} className="text-amber-400 shrink-0" />
            <span className="truncate">{carpeta ?? 'Elegir carpeta...'}</span>
          </button>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Toggle headless */}
          <button
            onClick={() => setHeadless((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            title={headless ? 'Navegador oculto' : 'Navegador visible'}
          >
            <div
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${headless ? 'bg-amber-600' : 'bg-stone-600'}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${headless ? 'left-4' : 'left-0.5'}`}
              />
            </div>
            <span className="text-xs">{headless ? 'Sin ventana' : 'Con ventana'}</span>
          </button>

          <div className="w-px h-4 bg-white/10" />

          <button
            onClick={toggleTodos}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                todosSeleccionados ? 'bg-amber-600 border-amber-600' : 'border-stone-600'
              }`}
            >
              {todosSeleccionados && <Check size={10} strokeWidth={3} className="text-white" />}
            </div>
            Seleccionar todos
          </button>
        </div>
      </div>

      {/* Botón deshabilitado mientras descarga */}

      {/* Grid de archivos */}
      <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {archivos.map(({ nombre, id }) => {
          const activo = seleccionados.has(id)
          const ext = nombre.split('.').pop().toUpperCase()
          const baseName = nombre.replace(/\.[^.]+$/, '')

          return (
            <button
              key={id}
              onClick={() => toggle(id)}
              className={`group relative text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-3 ${
                activo
                  ? 'bg-amber-700/15 border-amber-600/40 shadow-lg shadow-amber-700/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
              }`}
            >
              {/* Ícono */}
              <div
                className={`shrink-0 p-2 rounded-lg transition-colors ${
                  activo ? 'bg-amber-600/20' : 'bg-white/5 group-hover:bg-white/10'
                }`}
              >
                <FileSpreadsheet
                  size={22}
                  className={activo ? 'text-amber-400' : 'text-stone-400'}
                />
              </div>

              {/* Texto */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-semibold truncate transition-colors ${
                    activo ? 'text-white' : 'text-stone-300 group-hover:text-white'
                  }`}
                >
                  {baseName}
                </p>
                <span
                  className={`text-[10px] font-bold ${activo ? 'text-amber-400' : 'text-stone-500'}`}
                >
                  .{ext}
                </span>
              </div>

              {/* Checkbox */}
              <div
                className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                  activo
                    ? 'bg-amber-600 border-amber-600'
                    : 'border-stone-600 group-hover:border-stone-400'
                }`}
              >
                {activo && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>

              {/* Línea inferior activa */}
              {activo && (
                <div className="absolute bottom-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-amber-500/50 to-transparent" />
              )}
            </button>
          )
        })}
      </div>

      {/* Sección de logs */}
      {(descargando || logs.length > 0) && (
        <div className="relative mt-6">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-amber-400" />
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Salida del proceso
            </span>
            {descargando && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                En progreso...
              </span>
            )}
            {completado && !descargando && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Proceso terminado
              </span>
            )}
            {completado && !descargando && downloadDir && (
              <button
                onClick={() => window.api.abrirCarpeta(downloadDir)}
                className="ml-auto flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <FolderCheck size={13} />
                Abrir carpeta
              </button>
            )}
            {cancelado && !descargando && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Proceso cancelado
              </span>
            )}
          </div>
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs">
            {logs.map((line, i) => (
              <p
                key={i}
                className={`leading-relaxed ${line.startsWith('ERROR') ? 'text-red-400' : line.startsWith('Proceso cancelado') ? 'text-amber-400' : 'text-green-400'}`}
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

export default PanelDescargas
