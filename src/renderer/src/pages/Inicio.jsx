import { useState, useEffect } from 'react'
import { FileDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function Inicio() {
  const navigate = useNavigate()
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.getVersion().then(setVersion)
  }, [])

  return (
    <div className="min-h-screen bg-linear-to-br from-stone-950 via-neutral-900 to-stone-950 flex items-center justify-center py-8">
      <div className="relative z-10 text-center px-8 max-w-3xl mx-auto">
        <h1 className="text-5xl font-bold text-white mb-3 leading-tight tracking-tight">
          Bienvenido al Sistema de
        </h1>
        <h2 className="text-4xl font-bold mb-5 leading-tight">
          <span className="bg-linear-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            Automatización de Descargas
          </span>
        </h2>
        <h3 className="text-2xl font-light text-stone-400 mb-8">
          y Sincronización de Base de Datos
        </h3>

        <div className="flex items-center gap-4 mb-8 justify-center">
          <div className="h-px w-24 bg-linear-to-r from-transparent to-amber-600/50" />
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <div className="h-px w-24 bg-linear-to-l from-transparent to-amber-600/50" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-10 max-w-sm mx-auto w-full">
          <button
            onClick={() => navigate('/descargas')}
            className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-amber-700/10 hover:border-amber-700/30 transition-colors cursor-pointer text-left"
          >
            <div className="text-amber-400 mb-3">
              <FileDown size={20} />
            </div>
            <div className="text-white font-semibold text-sm mb-1">Panel de descargas</div>
            <div className="text-stone-500 text-xs">
              Descarga automatizada de archivos del sistema
            </div>
          </button>

          <button
            onClick={() => navigate('/descargas')}
            className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-amber-700/10 hover:border-amber-700/30 transition-colors cursor-pointer text-left"
          >
            <div className="text-amber-400 mb-3">
              <FileDown size={20} />
            </div>
            <div className="text-white font-semibold text-sm mb-1">Corregir archivos .csv</div>
            <div className="text-stone-500 text-xs">
              Detecta filas desplazadas e inconsistencias en columnas
            </div>
          </button>
        </div>

        <p className="text-stone-600 text-xs">
          ANAM · Agencia Nacional de Aduanas de México · v
          <span className="text-amber-400">{version}</span>
        </p>
      </div>
    </div>
  )
}

export default Inicio
