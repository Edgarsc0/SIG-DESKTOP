import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Inicio from './pages/Inicio'
import PanelDescargas from './pages/PanelDescargas'
import DeteccionCorreccion from './pages/DeteccionCorreccion'

function App() {
  return (
    <div className="flex h-screen bg-slate-950">
      <Navbar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/descargas" element={<PanelDescargas />} />
          <Route path="/correcion_deteccion" element={<DeteccionCorreccion />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
