import { FileDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function Inicio() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center py-8">
      <div className="relative z-10 text-center px-8 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-3 leading-tight tracking-tight">
          Bienvenido al Sistema de
        </h1>
        <h2 className="text-4xl font-bold mb-5 leading-tight">
          <span className="bg-linear-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Automatización de Descargas
          </span>
        </h2>
        <h3 className="text-2xl font-light text-slate-400 mb-8">
          y Sincronización de Base de Datos
        </h3>

        <div className="flex items-center gap-4 mb-8 justify-center">
          <div className="h-px w-24 bg-linear-to-r from-transparent to-blue-500/50" />
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <div className="h-px w-24 bg-linear-to-l from-transparent to-blue-500/50" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-10 max-w-sm mx-auto w-full">
          <button
            onClick={() => navigate('/descargas')}
            className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-pointer text-left"
          >
            <div className="text-cyan-400 mb-3">
              <FileDown size={20} />
            </div>
            <div className="text-white font-semibold text-sm mb-1">Panel de descargas</div>
            <div className="text-slate-500 text-xs">Descarga automatizada de archivos del sistema</div>
          </button>

          <button
            onClick={() => navigate('/descargas')}
            className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-pointer text-left"
          >
            <div className="text-cyan-400 mb-3">
              <FileDown size={20} />
            </div>
            <div className="text-white font-semibold text-sm mb-1">Corregir archivos .csv</div>
            <div className="text-slate-500 text-xs">Detecta filas desplazadas e inconsistencias en columnas</div>
          </button>
        </div>

        <p className="text-slate-600 text-xs">ANAM · Sistema de Gestión Automatizada</p>
      </div>
    </div>
  )
}

export default Inicio
