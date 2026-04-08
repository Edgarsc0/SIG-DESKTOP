import { useState, useEffect, useRef, useCallback } from 'react'
import {
  FileSpreadsheet,
  Check,
  Download,
  Files,
  FolderOpen,
  Terminal,
  X,
  FolderCheck,
  Database,
  ClockArrowUp
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cargarSimple, cargarSync } from '../lib/api'
import { useLogs } from '../hooks/useLogs'

const archivos = [
  { nombre: 'Posiciones.csv', id: 1 },
  { nombre: 'Empleados_Activos.csv', id: 2 },
  { nombre: 'Empleados_Bajas.csv', id: 3 },
  { nombre: 'Familiares.csv', id: 4 },
  { nombre: 'Escolaridad.csv', id: 7 },
  { nombre: 'Movimientos_ANAM_EMPLEADOS.xlsx', id: 'movimientos_anam_empleados' }
]

function PanelDescargas() {
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [carpeta, setCarpeta] = useState(() => localStorage.getItem('carpeta_descarga') ?? null)
  const [headless, setHeadless] = useState(true)
  const [detectarErrores, setDetectarErrores] = useState(true)
  const [subirABD, setSubirABD] = useState(true)
  const [cargarHistorial, setCargarHistorial] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [cancelado, setCancelado] = useState(false)
  const [subiendoBD, setSubiendoBD] = useState(false)
  const [downloadDir, setDownloadDir] = useState(null)
  const [resultadosBD, setResultadosBD] = useState({})
  const canceladoRef = useRef(false)

  const { logs, agregarLog, logsEndRef, containerRef } = useLogs()

  useEffect(() => {
    const cleanup = window.api.onDescargaLog((msg) => agregarLog(msg))
    return cleanup
  }, [agregarLog])

  const elegirCarpeta = async () => {
    const ruta = await window.api.seleccionarCarpeta()
    if (ruta) {
      setCarpeta(ruta)
      localStorage.setItem('carpeta_descarga', ruta)
    }
  }

  const toggle = useCallback((id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleTodos = useCallback(() => {
    if (seleccionados.size === archivos.length) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(archivos.map((a) => a.id)))
    }
  }, [seleccionados.size])

  const handleCancelar = useCallback(async () => {
    canceladoRef.current = true
    await window.api.cancelarDescarga()
  }, [])

  const handleSubirABD = useCallback(
    async (dir) => {
      setSubiendoBD(true)
      setResultadosBD({})
      agregarLog('Iniciando carga a base de datos...')

      try {
        const corregidosDir = `${dir}/Corregidos`
        const enCorregidos = await window.api.listarDirectorio(corregidosDir).catch(() => [])
        const enRaiz = await window.api.listarDirectorio(dir)

        let rutaPosiciones = null
        if (enCorregidos.includes('zafiro_info_Posiciones_Corregido.csv'))
          rutaPosiciones = `${corregidosDir}/zafiro_info_Posiciones_Corregido.csv`
        else if (enRaiz.includes('zafiro_info_Posiciones.csv'))
          rutaPosiciones = `${dir}/zafiro_info_Posiciones.csv`

        if (rutaPosiciones) {
          agregarLog('Leyendo Posiciones...')
          const rows = await window.api.leerCsvRows(rutaPosiciones)
          const result = await cargarSimple(
            rows,
            '/api/bulk-insert-movpos/',
            'MOV_POS',
            'Posiciones',
            agregarLog
          )
          setResultadosBD((prev) => ({ ...prev, Posiciones: result }))
        } else {
          agregarLog('AVISO: Posiciones.csv no encontrado — se omite.')
        }

        let rutaFamiliares = null
        if (enCorregidos.includes('zafiro_info_Familiares_Corregido.csv'))
          rutaFamiliares = `${corregidosDir}/zafiro_info_Familiares_Corregido.csv`
        else if (enRaiz.includes('zafiro_info_Familiares.csv'))
          rutaFamiliares = `${dir}/zafiro_info_Familiares.csv`

        if (rutaFamiliares) {
          agregarLog('Leyendo Familiares...')
          const rows = await window.api.leerCsvRows(rutaFamiliares)
          const result = await cargarSimple(
            rows,
            '/api/cargar-familiar-csv/',
            'FAMILIAR',
            'Familiares',
            agregarLog
          )
          setResultadosBD((prev) => ({ ...prev, Familiares: result }))
        } else {
          agregarLog('AVISO: Familiares.csv no encontrado — se omite.')
        }

        const esExcel = (f) =>
          !f.startsWith('~$') &&
          !f.startsWith('.~lock') &&
          ['.xlsx', '.xls'].includes(f.slice(f.lastIndexOf('.')).toLowerCase())

        const excelCorregido = enCorregidos.find(esExcel)
        const excelRaiz = enRaiz.find(esExcel)
        const rutaMovimientos = excelCorregido
          ? `${corregidosDir}/${excelCorregido}`
          : excelRaiz
            ? `${dir}/${excelRaiz}`
            : null

        if (rutaMovimientos) {
          agregarLog('Leyendo Movimientos.xlsx...')
          const rows = await window.api.leerExcelRows(rutaMovimientos)
          const result = await cargarSync(
            rows,
            '/api/insertar-movimientos/',
            'Movimientos',
            agregarLog
          )
          setResultadosBD((prev) => ({ ...prev, Movimientos: result }))
        } else {
          agregarLog('AVISO: Movimientos.xlsx no encontrado — se omite.')
        }

        let rutaDomicilios = null
        if (enCorregidos.includes('zafiro_info_Escolaridad_Corregido.csv'))
          rutaDomicilios = `${corregidosDir}/zafiro_info_Escolaridad_Corregido.csv`
        else if (enRaiz.includes('zafiro_info_Escolaridad.csv'))
          rutaDomicilios = `${dir}/zafiro_info_Escolaridad.csv`

        if (rutaDomicilios) {
          agregarLog('Leyendo Escolaridad...')
          const rows = await window.api.leerCsvRows(rutaDomicilios)
          const result = await cargarSimple(
            rows,
            '/api/cargar-domicilios-csv/',
            'domicilios',
            'Escolaridad',
            agregarLog
          )
          setResultadosBD((prev) => ({ ...prev, Escolaridad: result }))
        } else {
          agregarLog('AVISO: Escolaridad.csv no encontrado — se omite.')
        }
      } catch (err) {
        agregarLog(`ERROR BD: ${err.message}`)
      } finally {
        setSubiendoBD(false)
      }
    },
    [agregarLog]
  )

  const handleDescargarSeleccionados = useCallback(async () => {
    if (!carpeta) return
    setDescargando(true)
    setCompletado(false)
    setCancelado(false)
    canceladoRef.current = false
    let descargarMovimientos = false

    try {
      const ids = [...seleccionados]
      if (ids.includes('movimientos_anam_empleados')) {
        descargarMovimientos = true
        ids.splice(ids.indexOf('movimientos_anam_empleados'), 1)
      }

      const dir = await window.api.crearCarpetaDescarga(carpeta)
      setDownloadDir(dir)

      if (ids.length !== 0) {
        await window.api.iniciarDescarga(ids, dir, headless)
      }

      if (detectarErrores && ids.length > 0) {
        agregarLog('Iniciando detección y corrección de errores...')
        await window.api.corregirArchivos(dir)
        agregarLog('Corrección completada. Archivos en carpeta Corregidos/')
      }

      if (descargarMovimientos) {
        await window.api.iniciarDescargaMovimientosAnamXlsx(dir, headless)
      }

      setCompletado(true)
      agregarLog('Proceso terminado.')

      if (subirABD) await handleSubirABD(dir)

      if (cargarHistorial && seleccionados.has(1)) {
        agregarLog('Iniciando carga de Historial de Posiciones...')
        await window.api.iniciarHistorialPos(dir, headless)
        agregarLog('Historial de Posiciones completado.')
      }
    } catch (err) {
      if (canceladoRef.current) {
        setCancelado(true)
        agregarLog('Proceso cancelado.')
      } else {
        agregarLog(`ERROR: ${err.message}`)
      }
    } finally {
      setDescargando(false)
    }
  }, [carpeta, seleccionados, headless, detectarErrores, subirABD, cargarHistorial, agregarLog, handleSubirABD])

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
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg shadow-black-500/20 bg-white/5 transition-all duration-200 hover:shadow-none hover:bg-white/10">
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
            disabled={seleccionados.size === 0 || !carpeta || descargando || subiendoBD}
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
      <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col gap-3">
        {/* Fila 1: carpeta + contadores */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={elegirCarpeta}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors min-w-0 flex-1"
          >
            <FolderOpen size={15} className="text-amber-400 shrink-0" />
            <span className="truncate">{carpeta ?? 'Elegir carpeta de destino...'}</span>
          </button>
          <div className="flex items-center gap-3 shrink-0 text-sm">
            <div className="flex items-center gap-1.5 text-stone-500">
              <Files size={14} />
              <span>{archivos.length}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-1 text-sm">
              <span className="text-stone-500">Sel:</span>
              <span className="text-amber-400 font-semibold">{seleccionados.size}</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {/* Fila 2: toggles */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Toggle: headless — DESHABILITADO */}
          <button
            onClick={() => setHeadless((v) => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
            title={headless ? 'Navegador oculto' : 'Navegador visible'}
          >
            <div
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${headless ? 'bg-amber-600' : 'bg-stone-600'}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${headless ? 'left-4' : 'left-0.5'}`}
              />
            </div>
            {headless ? 'Sin ventana' : 'Con ventana'}
          </button>

          <div className="w-px h-4 bg-white/10" />

          {/* Toggle: detectar errores — DESHABILITADO */}
          <button
            onClick={() => setDetectarErrores((v) => !v)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <div
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${detectarErrores ? 'bg-amber-600' : 'bg-stone-600'}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${detectarErrores ? 'left-4' : 'left-0.5'}`}
              />
            </div>
            Detectar y corregir errores en los archivos csv
          </button>

          <>
            <div className="w-px h-4 bg-white/10" />

            {/* Toggle: subir a BD */}
            <button
              onClick={() => setSubirABD((v) => !v)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
              title="Cargar archivos a la base de datos al finalizar"
            >
              <div
                className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${subirABD ? 'bg-emerald-600' : 'bg-stone-600'}`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${subirABD ? 'left-4' : 'left-0.5'}`}
                />
              </div>
              <Database size={12} className={subirABD ? 'text-amber-400' : 'text-stone-500'} />
              Subir a base de datos
            </button>
          </>

          {seleccionados.has(1) && (
            <>
              <div className="w-px h-4 bg-white/10" />

              {/* Toggle: cargar historial de posiciones */}
              <button
                onClick={() => setCargarHistorial((v) => !v)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
                title="Cargar historial de posiciones al finalizar"
              >
                <div
                  className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${cargarHistorial ? 'bg-violet-600' : 'bg-stone-600'}`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${cargarHistorial ? 'left-4' : 'left-0.5'}`}
                  />
                </div>
                <ClockArrowUp size={12} className={cargarHistorial ? 'text-violet-400' : 'text-stone-500'} />
                Cargar historial de posiciones
              </button>
            </>
          )}

          {/* Seleccionar todos */}
          <button
            onClick={toggleTodos}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors ml-auto"
          >
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${todosSeleccionados ? 'bg-amber-600 border-amber-600' : 'border-stone-600'}`}
            >
              {todosSeleccionados && <Check size={10} strokeWidth={3} className="text-white" />}
            </div>
            Seleccionar todos
          </button>
        </div>
      </div>

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
              <div
                className={`shrink-0 p-2 rounded-lg transition-colors ${activo ? 'bg-amber-600/20' : 'bg-white/5 group-hover:bg-white/10'}`}
              >
                <FileSpreadsheet
                  size={22}
                  className={activo ? 'text-amber-400' : 'text-stone-400'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-semibold truncate transition-colors ${activo ? 'text-white' : 'text-stone-300 group-hover:text-white'}`}
                >
                  {baseName}
                </p>
                <span
                  className={`text-[10px] font-bold ${activo ? 'text-amber-400' : 'text-stone-500'}`}
                >
                  .{ext}
                </span>
              </div>
              <div
                className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${activo ? 'bg-amber-600 border-amber-600' : 'border-stone-600 group-hover:border-stone-400'}`}
              >
                {activo && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              {activo && (
                <div className="absolute bottom-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-amber-500/50 to-transparent" />
              )}
            </button>
          )
        })}
      </div>

      {/* Resumen BD */}
      {!subiendoBD && Object.keys(resultadosBD).length > 0 && (
        <div className="relative mt-6 rounded-xl bg-white/5 border border-white/10 text-xs font-mono overflow-hidden">
          <p className="px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider border-b border-white/10">
            Resumen BD
          </p>
          <div className="divide-y divide-white/5">
            {Object.entries(resultadosBD).map(([label, { insertadas, eliminados }]) => (
              <div key={label} className="px-4 py-3 flex items-center justify-between gap-4">
                <p className="text-white font-semibold shrink-0">{label}</p>
                <div className="flex gap-6 ml-auto text-right">
                  <div>
                    <p className="text-slate-500 text-[10px]">Insertadas</p>
                    <p className="text-emerald-400">{insertadas.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[10px]">Duplicados eliminados</p>
                    <p className="text-amber-400">{eliminados.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-[10px]">En tabla</p>
                    <p className="text-white">{(insertadas - eliminados).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sección de logs */}
      {(descargando || subiendoBD || logs.length > 0) && (
        <div className="relative mt-6">
          {' '}
          {/* <-- Quité el resize-y de aquí */}
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-amber-400" />
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Salida del proceso
            </span>

            {(descargando || subiendoBD) && (
              <span className="flex items-center gap-1.5 text-xs text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                {subiendoBD ? 'Subiendo a BD...' : 'En progreso...'}
              </span>
            )}
            {completado && !descargando && !subiendoBD && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Proceso terminado
              </span>
            )}
            {completado && !descargando && !subiendoBD && downloadDir && (
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
          <div
            ref={containerRef}
            className="bg-black/40 border border-white/10 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs resize-y min-h-32 max-h-[80vh]"
          >
            {logs.map((line, i) => (
              <p
                key={i}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.startsWith('ERROR') || line.startsWith('FALLO')
                    ? 'text-red-400'
                    : line.startsWith('Proceso cancelado')
                      ? 'text-amber-400'
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

export default PanelDescargas
