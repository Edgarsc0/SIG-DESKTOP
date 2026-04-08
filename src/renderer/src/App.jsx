import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Inicio from './pages/Inicio'
import { Fade } from 'react-awesome-reveal'
import { VersionProvider } from './context/VersionContext'

const PanelDescargas = lazy(() => import('./pages/PanelDescargas'))
const PanelSubida = lazy(() => import('./pages/PanelSubida'))
const CargaDomicilios = lazy(() => import('./pages/CargaDomicilios'))
const CargarHistorialPos = lazy(() => import('./pages/CargarHistorialPos'))

const Loading = () => (
  <div className="flex items-center justify-center h-full">
    <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
)

function App() {
  return (
    <VersionProvider>
      <div className="flex h-screen bg-slate-950">
        <Navbar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route
              path="/"
              element={
                <Fade delay={200} duration={1000} fraction={0.5}>
                  <Inicio />
                </Fade>
              }
            />
            <Route
              path="/descargas"
              element={
                <Suspense fallback={<Loading />}>
                  <Fade delay={200} duration={1000} fraction={0.5}>
                    <PanelDescargas />
                  </Fade>
                </Suspense>
              }
            />
            <Route
              path="/subida"
              element={
                <Suspense fallback={<Loading />}>
                  <Fade delay={200} duration={1000} fraction={0.5}>
                    <PanelSubida />
                  </Fade>
                </Suspense>
              }
            />
            <Route
              path="/carga-domicilios"
              element={
                <Suspense fallback={<Loading />}>
                  <Fade delay={200} duration={1000} fraction={0.5}>
                    <CargaDomicilios />
                  </Fade>
                </Suspense>
              }
            />
            <Route
              path="/historial-pos"
              element={
                <Suspense fallback={<Loading />}>
                  <Fade delay={200} duration={1000} fraction={0.5}>
                    <CargarHistorialPos />
                  </Fade>
                </Suspense>
              }
            />
          </Routes>
        </main>
      </div>
    </VersionProvider>
  )
}

export default App
