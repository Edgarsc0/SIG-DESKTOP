import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  seleccionarCarpeta: () => ipcRenderer.invoke('seleccionar-carpeta'),
  iniciarDescarga: (ids, carpeta, headless) => ipcRenderer.invoke('iniciar-descarga', { ids, carpeta, headless }),
  onDescargaLog: (callback) => {
    const handler = (_, msg) => callback(msg)
    ipcRenderer.on('descarga-log', handler)
    return () => ipcRenderer.off('descarga-log', handler)
  }
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
