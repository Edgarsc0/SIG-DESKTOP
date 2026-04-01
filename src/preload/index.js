import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  isDev: process.env.NODE_ENV === 'development',
  getVersion: () => ipcRenderer.invoke('get-version'),
  seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
  crearCarpetaDescarga: (carpeta) => ipcRenderer.invoke('crear-carpeta-descarga', carpeta),
  iniciarDescarga: (ids, downloadDir, headless) =>
    ipcRenderer.invoke('iniciar-descarga', { ids, downloadDir, headless }),
  onDescargaLog: (callback) => {
    const handler = (_, msg) => callback(msg)
    ipcRenderer.on('descarga-log', handler)
    return () => ipcRenderer.off('descarga-log', handler)
  },
  iniciarDescargaMovimientosAnamXlsx: (downloadDir, headless) =>
    ipcRenderer.invoke('iniciar-descarga-movimientos-anam-xlsx', { downloadDir, headless }),
  cancelarDescarga: () => ipcRenderer.invoke('cancelar-descarga'),
  abrirCarpeta: (ruta) => ipcRenderer.invoke('abrir-carpeta', ruta),
  corregirArchivos: (downloadDir) => ipcRenderer.invoke('corregir-archivos', { downloadDir }),
  listarDirectorio: (ruta) => ipcRenderer.invoke('listar-directorio', ruta),
  leerCsvRows: (ruta) => ipcRenderer.invoke('leer-csv-rows', ruta),
  leerExcelRows: (ruta) => ipcRenderer.invoke('leer-excel-rows', ruta),
  seleccionarArchivoCsv: () => ipcRenderer.invoke('seleccionar-archivo-csv')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
