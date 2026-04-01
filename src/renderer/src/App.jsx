import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Inicio from './pages/Inicio'
import PanelDescargas from './pages/PanelDescargas'
import DeteccionCorreccion from './pages/DeteccionCorreccion'
import PanelSubida from './pages/PanelSubida'
import CargaDomicilios from './pages/CargaDomicilios'
import { Fade } from 'react-awesome-reveal'

function App() {
  return (
    <div className="flex h-screen bg-slate-950">
      <Navbar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route
            path="/"
            element={
              <Fade
                delay={200} // Wait before starting
                duration={1000} // Animation duration
                fraction={0.5} // Trigger when 50% visible
              >
                <Inicio />
              </Fade>
            }
          />
          <Route
            path="/descargas"
            element={
              <Fade
                delay={200} // Wait before starting
                duration={1000} // Animation duration
                fraction={0.5} // Trigger when 50% visible
              >
                <PanelDescargas />
              </Fade>
            }
          />
          <Route
            path="/subida"
            element={
              <Fade delay={200} duration={1000} fraction={0.5}>
                <PanelSubida />
              </Fade>
            }
          />
          <Route
            path="/carga-domicilios"
            element={
              <Fade delay={200} duration={1000} fraction={0.5}>
                <CargaDomicilios />
              </Fade>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default App
