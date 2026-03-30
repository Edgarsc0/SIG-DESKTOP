import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { FileDown, Home, Database, FileScan } from 'lucide-react'
import anamLogo from '../assets/anam_logo.png'

const links = [
  { to: '/', icon: Home, label: 'Inicio' },
  { to: '/descargas', icon: FileDown, label: 'Descargas' }
]

function Navbar() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.getVersion().then(setVersion)
  }, [])

  return (
    <aside className="w-16 hover:w-64 transition-all duration-300 ease-in-out group flex flex-col bg-stone-950 border-r border-white/5 h-screen shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-amber-700 to-amber-500 flex items-center justify-center shrink-0">
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
                  ? 'bg-amber-700/20 text-amber-400'
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

      {/* Footer con logo */}
      <div className="px-3 py-4 border-t border-white/5 flex flex-col items-center gap-2">
        <img
          src={anamLogo}
          alt="ANAM"
          className="w-full opacity-60 group-hover:opacity-90 transition-opacity duration-300 object-contain px-1"
        />
        <span className="text-stone-600 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          v{version}
        </span>
      </div>
    </aside>
  )
}

export default Navbar
