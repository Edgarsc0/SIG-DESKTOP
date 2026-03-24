import { NavLink } from 'react-router-dom'
import { FileDown, Home, Database, FileScan } from 'lucide-react'

const links = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/descargas', icon: FileDown, label: 'Descargas' },
  { to: '/base-datos', icon: Database, label: 'Base de Datos' },
  {
    to: '/correcion_deteccion',
    icon: FileScan,
    label: 'Correción de archivos .csv'
  }
]

function Navbar() {
  return (
    <aside className="w-16 hover:w-64 transition-all duration-300 ease-in-out group flex flex-col bg-slate-900 border-r border-white/5 h-screen shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-cyan-400 flex items-center justify-center shrink-0">
          <FileDown size={16} className="text-white" />
        </div>
        <span className="text-white font-semibold text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          ANAM
        </span>
      </div>

      {/* Links */}
      <nav className="flex flex-col gap-1 p-2 flex-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <Icon size={20} className="shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Versión */}
      <div className="px-4 py-4 border-t border-white/5">
        <span className="text-slate-600 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          v1.0.0
        </span>
      </div>
    </aside>
  )
}

export default Navbar
