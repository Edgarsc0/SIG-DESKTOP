import { useState, useRef } from 'react'
import { FileUp, Upload, X, CheckCircle, AlertCircle, FileSpreadsheet, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

const DRF_BASE_URL = 'http://127.0.0.1:8000'
const CHUNK_SIZE = 500

const TABLAS = [
  {
    id: 'domicilios',
    label: 'Domicilios',
    endpoint: '/api/cargar-domicilios-csv/',
    tabla: 'domicilios'
  },
  { id: 'familiar', label: 'Familiar', endpoint: '/api/cargar-familiar-csv/', tabla: 'FAMILIAR' }
]

function CargaDomicilios() {
  const [tablaId, setTablaId] = useState('domicilios')
  const [rutaArchivo, setRutaArchivo] = useState(null)
  const [nombreArchivo, setNombreArchivo] = useState(null)
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [logs, setLogs] = useState([])
  const [resumen, setResumen] = useState(null)
  const logsEndRef = useRef(null)

  const tabla = TABLAS.find((t) => t.id === tablaId)

  const cambiarTabla = (id) => {
    setTablaId(id)
    setRutaArchivo(null)
    setNombreArchivo(null)
    setFilas([])
    setLogs([])
    setResumen(null)
  }

  const agregarLog = (msg) =>
    setLogs((prev) => {
      const next = [...prev, msg]
      setTimeout(() => logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      return next
    })

  const elegirArchivo = async () => {
    const ruta = await window.api.seleccionarArchivoCsv()
    if (!ruta) return
    const nombre = ruta.split(/[\\/]/).pop()
    const rows = await window.api.leerCsvRows(ruta)
    setRutaArchivo(ruta)
    setNombreArchivo(nombre)
    setFilas(rows)
    setLogs([])
    setResumen(null)
  }

  const limpiar = () => {
    setRutaArchivo(null)
    setNombreArchivo(null)
    setFilas([])
    setLogs([])
    setResumen(null)
  }

  const handleTruncar = async () => {
    const confirmado = window.confirm(
      `¿Seguro que deseas truncar la tabla "${tabla.tabla}"?\nEsta acción eliminará todos los registros y no se puede deshacer.`
    )
    if (!confirmado) return

    try {
      const res = await fetch(`${DRF_BASE_URL}/api/truncar-tabla/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tabla: tabla.tabla })
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        alert(`Error al truncar: ${data.error ?? 'Error desconocido'}`)
      } else {
        limpiar()
        setLogs([`Tabla "${tabla.tabla}" truncada correctamente.`])
      }
    } catch (err) {
      alert(`Error de red: ${err.message}`)
    }
  }

  const handleCargar = async () => {
    if (!filas.length) return
    setCargando(true)
    setLogs([])
    setResumen(null)

    const total = filas.length
    const totalChunks = Math.ceil(total / CHUNK_SIZE)
    let insertadas = 0
    let errores = 0

    agregarLog(`Iniciando carga: ${total} filas en ${totalChunks} lote(s)`)

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunkNum = Math.floor(i / CHUNK_SIZE) + 1
      const chunk = filas.slice(i, i + CHUNK_SIZE)

      try {
        const res = await fetch(`${DRF_BASE_URL}${tabla.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk })
        })
        const data = await res.json()

        if (!res.ok || !data.ok) {
          agregarLog(`ERROR lote ${chunkNum}/${totalChunks}: ${data.error ?? 'Error desconocido'}`)
          errores += chunk.length
        } else {
          insertadas += data.insertadas
          agregarLog(
            `  Lote ${chunkNum}/${totalChunks}: filas ${i + 1}–${Math.min(i + CHUNK_SIZE, total)} OK`
          )
        }
      } catch (err) {
        agregarLog(`ERROR lote ${chunkNum}/${totalChunks}: ${err.message}`)
        errores += chunk.length
      }
    }

    agregarLog('Carga finalizada.')
    setResumen({ total, insertadas, errores })
    setCargando(false)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-stone-950 via-neutral-900 to-stone-950 p-8 flex flex-col">
      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-red-900/5 rounded-full blur-3xl" />
      </div>

      {/* Encabezado */}
      <div className="relative flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/5">
              <FileUp size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Carga Directa</h1>
          </div>
          <p className="text-slate-400 text-sm ml-12">
            Inserta el CSV completo a la tabla{' '}
            <span className="text-amber-400 font-mono">{tabla.tabla}</span>. Asegúrate de haber
            truncado la tabla antes de cargar.
          </p>
        </div>

        <Button
          onClick={handleCargar}
          disabled={!filas.length || cargando}
          className="bg-linear-to-r from-amber-700 to-amber-500 hover:from-amber-600 hover:to-amber-400 text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-amber-700/20 disabled:opacity-30 disabled:shadow-none transition-all duration-200 flex items-center gap-2"
        >
          <Upload size={16} />
          {cargando ? 'Cargando...' : 'Cargar a BD'}
        </Button>
      </div>

      {/* Selector de tabla */}
      <div className="relative mb-6 flex items-center gap-2">
        {TABLAS.map((t) => (
          <button
            key={t.id}
            onClick={() => cambiarTabla(t.id)}
            disabled={cargando}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              tablaId === t.id
                ? 'bg-amber-700/30 text-amber-400 border border-amber-600/40'
                : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white hover:bg-white/10'
            } disabled:opacity-40`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={handleTruncar}
          disabled={cargando}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-900/20 text-red-400 border border-red-800/40 hover:bg-red-900/40 hover:text-red-300 transition-all duration-200 disabled:opacity-40"
        >
          <Trash2 size={14} />
          Truncar tabla
        </button>
      </div>

      {/* Zona de selección de archivo */}
      <div className="relative mb-6">
        {!rutaArchivo ? (
          <button
            onClick={elegirArchivo}
            className="w-full p-10 rounded-xl border-2 border-dashed border-white/10 hover:border-amber-600/40 hover:bg-amber-600/5 transition-all duration-200 flex flex-col items-center gap-3 text-slate-500 hover:text-slate-300"
          >
            <FileSpreadsheet size={36} />
            <span className="text-sm font-medium">
              Haz clic para seleccionar el CSV de{' '}
              <span className="text-amber-400">{tabla.label}</span>
            </span>
            <span className="text-xs">Formato separado por | (pipe)</span>
          </button>
        ) : (
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-amber-600/20">
              <FileSpreadsheet size={22} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm truncate">{nombreArchivo}</p>
              <p className="text-slate-400 text-xs mt-0.5">
                {filas.length.toLocaleString()} filas leídas —{' '}
                {Math.ceil(filas.length / CHUNK_SIZE)} lote(s) de {CHUNK_SIZE}
              </p>
            </div>
            {!cargando && (
              <button
                onClick={limpiar}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Logs */}
      {logs.length > 0 && (
        <div className="relative mb-4">
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs">
            {logs.map((line, i) => (
              <p
                key={i}
                className={`leading-relaxed ${
                  line.startsWith('ERROR')
                    ? 'text-red-400'
                    : line.startsWith('Carga finalizada')
                      ? 'text-emerald-400'
                      : 'text-green-400'
                }`}
              >
                <span className="text-slate-600 select-none mr-2">{'>'}</span>
                {line}
              </p>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Barra de progreso mientras carga */}
      {cargando && filas.length > 0 && (
        <div className="relative mb-4">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-linear-to-r from-amber-700 to-amber-400 rounded-full animate-pulse w-full" />
          </div>
        </div>
      )}

      {/* Resumen final */}
      {resumen && (
        <div className="relative mt-2 p-5 rounded-xl bg-white/5 border border-white/10">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4">
            Resumen de carga
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg bg-white/5">
              <p className="text-2xl font-bold text-white">{resumen.total.toLocaleString()}</p>
              <p className="text-slate-400 text-xs mt-1">Total filas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-emerald-500/10">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <CheckCircle size={14} className="text-emerald-400" />
                <p className="text-2xl font-bold text-emerald-400">
                  {resumen.insertadas.toLocaleString()}
                </p>
              </div>
              <p className="text-slate-400 text-xs">Insertadas</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <AlertCircle size={14} className="text-red-400" />
                <p className="text-2xl font-bold text-red-400">
                  {resumen.errores.toLocaleString()}
                </p>
              </div>
              <p className="text-slate-400 text-xs">Errores</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CargaDomicilios
