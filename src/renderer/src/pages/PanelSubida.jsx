import { useState, useEffect, useCallback } from 'react'
import { Database, FolderOpen, Terminal, Check, FileSpreadsheet, AlertCircle, ClockArrowUp } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cargarSimple, cargarSync } from '../lib/api'
import { useLogs } from '../hooks/useLogs'

const ARCHIVOS_CONFIG = [
  {
    label: 'Posiciones',
    corregido: 'zafiro_info_Posiciones_Corregido.csv',
    original: 'zafiro_info_Posiciones.csv',
    endpoint: '/api/bulk-insert-movpos/',
    truncarTabla: 'MOV_POS',
    tipo: 'csv',
    modo: 'simple'
  },
  {
    label: 'Familiares',
    corregido: 'zafiro_info_Familiares_Corregido.csv',
    original: 'zafiro_info_Familiares.csv',
    endpoint: '/api/cargar-familiar-csv/',
    truncarTabla: 'FAMILIAR',
    tipo: 'csv',
    modo: 'simple'
  },
  {
    label: 'Movimientos',
    corregido: null,
    original: null,
    endpoint: '/api/insertar-movimientos/',
    truncarTabla: null,
    tipo: 'excel',
    modo: 'sync'
  },
  {
    label: 'Escolaridad',
    corregido: 'zafiro_info_Escolaridad_Corregido.csv',
    original: 'zafiro_info_Escolaridad.csv',
    endpoint: '/api/cargar-domicilios-csv/',
    truncarTabla: 'domicilios',
    tipo: 'csv',
    modo: 'simple'
  }
]

const ARCHIVOS_CUBIERTOS = new Set(
  ARCHIVOS_CONFIG.flatMap((c) => [c.corregido, c.original].filter(Boolean))
)

function PanelSubida() {
  const [carpeta, setCarpeta] = useState(() => localStorage.getItem('carpeta_subida') ?? null)
  const [archivosDetectados, setArchivosDetectados] = useState(null)
  const [archivosExtra, setArchivosExtra] = useState([])
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [subiendo, setSubiendo] = useState(false)
  const [completado, setCompletado] = useState(false)
  const [resultados, setResultados] = useState({})
  const [cargarHistorial, setCargarHistorial] = useState(false)

  const { logs, agregarLog, logsEndRef, containerRef } = useLogs()

  const escanearCarpeta = useCallback(
    async (dir) => {
      try {
        const corregidosDir = `${dir}/Corregidos`
        const enCorregidos = await window.api.listarDirectorio(corregidosDir).catch(() => [])
        const enRaiz = await window.api.listarDirectorio(dir)

        const esExcel = (f) =>
          !f.startsWith('~$') &&
          !f.startsWith('.~lock') &&
          ['.xlsx', '.xls'].includes(f.slice(f.lastIndexOf('.')).toLowerCase())

        const excelCorregido = enCorregidos.find(esExcel)
        const excelRaiz = enRaiz.find(esExcel)

        const detectados = ARCHIVOS_CONFIG.map((cfg) => {
          if (cfg.tipo === 'excel') {
            const archivo = excelCorregido ?? excelRaiz ?? null
            return {
              ...cfg,
              encontrado: !!archivo,
              esCorregido: !!excelCorregido,
              ruta: excelCorregido
                ? `${corregidosDir}/${excelCorregido}`
                : excelRaiz
                  ? `${dir}/${excelRaiz}`
                  : null
            }
          }
          if (cfg.corregido && enCorregidos.includes(cfg.corregido)) {
            return {
              ...cfg,
              encontrado: true,
              esCorregido: true,
              ruta: `${corregidosDir}/${cfg.corregido}`
            }
          }
          if (enRaiz.includes(cfg.original)) {
            return { ...cfg, encontrado: true, esCorregido: false, ruta: `${dir}/${cfg.original}` }
          }
          return { ...cfg, encontrado: false, esCorregido: false, ruta: null }
        })

        const esCsv = (f) => f.toLowerCase().endsWith('.csv')
        const extraFinal = [
          ...enCorregidos
            .filter((f) => !ARCHIVOS_CUBIERTOS.has(f) && esCsv(f))
            .map((f) => ({ nombre: f, esCorregido: true })),
          ...enRaiz
            .filter((f) => !ARCHIVOS_CUBIERTOS.has(f) && (esCsv(f) || esExcel(f)))
            .map((f) => ({ nombre: f, esCorregido: false }))
        ]

        setArchivosDetectados(detectados)
        setArchivosExtra(extraFinal)
        setSeleccionados(new Set(detectados.filter((a) => a.encontrado).map((a) => a.label)))
      } catch (err) {
        agregarLog(`ERROR al escanear carpeta: ${err.message}`)
      }
    },
    [agregarLog]
  )

  useEffect(() => {
    if (carpeta) escanearCarpeta(carpeta)
  }, [carpeta, escanearCarpeta])

  const toggleSeleccion = useCallback((label) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }, [])

  const elegirCarpeta = useCallback(async () => {
    const ruta = await window.api.seleccionarCarpeta()
    if (ruta) {
      setCarpeta(ruta)
      localStorage.setItem('carpeta_subida', ruta)
      setArchivosDetectados(null)
      setArchivosExtra([])
      setSeleccionados(new Set())
      setCompletado(false)
      await escanearCarpeta(ruta)
    }
  }, [escanearCarpeta])

  const handleSubir = useCallback(async () => {
    if (!archivosDetectados) return
    setSubiendo(true)
    setCompletado(false)
    setResultados({})
    agregarLog('Iniciando carga a base de datos...')

    try {
      for (const archivo of archivosDetectados) {
        if (!archivo.encontrado || !seleccionados.has(archivo.label)) {
          if (archivo.encontrado && !seleccionados.has(archivo.label))
            agregarLog(`OMITIDO: ${archivo.label} (deseleccionado)`)
          continue
        }
        agregarLog(`Leyendo ${archivo.label}...`)
        const rows =
          archivo.tipo === 'excel'
            ? await window.api.leerExcelRows(archivo.ruta)
            : await window.api.leerCsvRows(archivo.ruta)

        let result
        if (archivo.modo === 'simple') {
          result = await cargarSimple(
            rows,
            archivo.endpoint,
            archivo.truncarTabla,
            archivo.label,
            agregarLog
          )
        } else {
          result = await cargarSync(rows, archivo.endpoint, archivo.label, agregarLog)
        }
        setResultados((prev) => ({ ...prev, [archivo.label]: result }))
      }
      setCompletado(true)
      agregarLog('Proceso terminado.')

      if (cargarHistorial) {
        agregarLog('Iniciando carga de Historial de Posiciones...')
        await window.api.iniciarHistorialPos(carpeta, true)
        agregarLog('Historial de Posiciones completado.')
      }
    } catch (err) {
      agregarLog(`ERROR: ${err.message}`)
    } finally {
      setSubiendo(false)
    }
  }, [archivosDetectados, seleccionados, carpeta, cargarHistorial, agregarLog])

  const haySeleccion = archivosDetectados?.some((a) => a.encontrado && seleccionados.has(a.label))
  const posicionesDetectadas = archivosDetectados?.find((a) => a.label === 'Posiciones')?.encontrado

  return (
    <div className="min-h-screen bg-linear-to-br from-stone-950 via-neutral-900 to-stone-950 p-8 flex flex-col">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-teal-900/5 rounded-full blur-3xl" />
      </div>

      {/* Encabezado */}
      <div className="relative flex items-start justify-between mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shadow-lg bg-white/5 transition-all duration-200 hover:shadow-none hover:bg-white/10">
              <Database size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Carga a Base de Datos</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Trunca la tabla, inserta todo el CSV y elimina duplicados exactos.
          </p>
        </div>

        <Button
          onClick={handleSubir}
          disabled={!haySeleccion || subiendo}
          className="bg-linear-to-r from-emerald-700 to-emerald-500 hover:from-emerald-600 hover:to-emerald-400 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-700/20 disabled:opacity-30 disabled:shadow-none transition-all duration-200 flex items-center gap-2"
        >
          <Database size={16} />
          {subiendo ? 'Subiendo...' : `Subir a BD${haySeleccion ? ` (${seleccionados.size})` : ''}`}
        </Button>
      </div>

      {/* Selector de carpeta */}
      <div className="relative mb-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
        <button
          onClick={elegirCarpeta}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full"
        >
          <FolderOpen size={15} className="text-emerald-400 shrink-0" />
          <span className="truncate">{carpeta ?? 'Elegir carpeta con archivos...'}</span>
        </button>
      </div>

      {/* Toggle historial de posiciones */}
      {posicionesDetectadas && (
        <div className="relative mb-4 px-4 py-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
          <button
            onClick={() => setCargarHistorial((v) => !v)}
            disabled={subiendo}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            title="Al finalizar la carga, ejecutar Historial de Posiciones"
          >
            <div
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${cargarHistorial ? 'bg-violet-600' : 'bg-stone-600'}`}
            >
              <div
                className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${cargarHistorial ? 'left-4' : 'left-0.5'}`}
              />
            </div>
            <ClockArrowUp size={12} className={cargarHistorial ? 'text-violet-400' : 'text-stone-500'} />
            Cargar historial de posiciones al finalizar
          </button>
        </div>
      )}

      {/* Archivos detectados */}
      {archivosDetectados && (
        <>
          <p className="relative text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">
            Archivos
          </p>
          <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
            {archivosDetectados.map(({ label, encontrado, esCorregido, ruta }) => {
              const seleccionado = seleccionados.has(label)
              return (
                <button
                  key={label}
                  onClick={() => encontrado && !subiendo && toggleSeleccion(label)}
                  disabled={!encontrado || subiendo}
                  className={`group p-4 rounded-xl border text-left flex items-center gap-3 transition-all duration-200 ${
                    !encontrado
                      ? 'bg-white/3 border-white/8 opacity-35 cursor-default'
                      : seleccionado
                        ? esCorregido
                          ? 'bg-emerald-700/15 border-emerald-500/40 shadow-lg shadow-emerald-900/20 cursor-pointer'
                          : 'bg-amber-700/15 border-amber-500/40 shadow-lg shadow-amber-900/20 cursor-pointer'
                        : 'bg-white/5 border-white/10 opacity-50 cursor-pointer hover:opacity-70'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      !encontrado
                        ? 'bg-white/5'
                        : seleccionado
                          ? esCorregido
                            ? 'bg-emerald-600/20'
                            : 'bg-amber-600/20'
                          : 'bg-white/5'
                    }`}
                  >
                    {encontrado ? (
                      <FileSpreadsheet
                        size={20}
                        className={
                          seleccionado
                            ? esCorregido
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                            : 'text-slate-500'
                        }
                      />
                    ) : (
                      <AlertCircle size={20} className="text-stone-600" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${encontrado && seleccionado ? 'text-white' : 'text-stone-500'}`}
                    >
                      {label}
                    </p>
                    <p
                      className={`text-[10px] ${
                        !encontrado
                          ? 'text-stone-600'
                          : seleccionado
                            ? esCorregido
                              ? 'text-emerald-400'
                              : 'text-amber-400'
                            : 'text-stone-600'
                      }`}
                    >
                      {!encontrado ? 'No encontrado' : esCorregido ? 'Corregido' : 'Original'}
                    </p>
                    {encontrado && ruta && (
                      <p className="text-[9px] text-stone-500 truncate">
                        {ruta.split(/[/\\]/).slice(-2).join('/')}
                      </p>
                    )}
                  </div>

                  {encontrado && (
                    <div
                      className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                        seleccionado
                          ? esCorregido
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'bg-amber-500 border-amber-500'
                          : 'border-stone-600'
                      }`}
                    >
                      {seleccionado && <Check size={10} strokeWidth={3} className="text-white" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Archivos sin SP */}
          {archivosExtra.length > 0 && (
            <>
              <p className="relative text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-2">
                Sin SP configurado — solo lectura
              </p>
              <div className="relative grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
                {archivosExtra.map(({ nombre, esCorregido }) => (
                  <div
                    key={nombre}
                    className="p-4 rounded-xl border border-white/5 bg-white/3 opacity-30 flex items-center gap-3"
                  >
                    <div className="p-2 rounded-lg shrink-0 bg-white/5">
                      <FileSpreadsheet size={20} className="text-stone-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-500 truncate">{nombre}</p>
                      <p className="text-[10px] text-stone-700">
                        {esCorregido ? 'Corregido' : 'Original'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Logs */}
      {(subiendo || logs.length > 0) && (
        <div className="relative mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <Terminal size={14} className="text-emerald-400" />
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">
              Salida del proceso
            </span>
            {subiendo && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Subiendo a BD...
              </span>
            )}
            {completado && !subiendo && (
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Proceso terminado
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
                    : line.startsWith('✓')
                      ? 'text-emerald-400'
                      : line.startsWith('AVISO') || line.startsWith('OMITIDO')
                        ? 'text-amber-400'
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

      {/* Resumen */}
      {!subiendo && Object.keys(resultados).length > 0 && (
        <div className="relative mt-4 rounded-xl bg-white/5 border border-white/10 text-xs font-mono overflow-hidden">
          <p className="px-4 py-2.5 text-slate-400 font-semibold uppercase tracking-wider border-b border-white/10">
            Resumen BD
          </p>
          <div className="divide-y divide-white/5">
            {Object.entries(resultados).map(([label, { insertadas, eliminados }]) => (
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
    </div>
  )
}

export default PanelSubida
