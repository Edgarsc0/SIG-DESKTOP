import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { spawn } from 'child_process'
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'fs'
import { readdir } from 'fs/promises'
import * as XLSX from 'xlsx'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

const activeChildren = new Set()
const fileCache = new Map()
const MAX_CACHE_ENTRIES = 100

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'ANAM - Sistema de Gestión Automatizada',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false // ← permite fetch a http://127.0.0.1:8000 desde file://
    }
  })

  // Permite que el renderer conecte al servidor DRF local
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
            'worker-src blob:; ' +
            "style-src 'self' 'unsafe-inline'; " +
            "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000 http://127.0.0.1:8080 http://localhost:8080 https://sig-desktop-api.onrender.com ws://localhost:5173 ws://127.0.0.1:5173;"
        ]
      }
    })
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('get-version', () => app.getVersion())

  ipcMain.handle('seleccionar-carpeta', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('seleccionar-archivo-csv', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('abrir-carpeta', (_, ruta) => shell.openPath(ruta))

  ipcMain.handle('corregir-archivos', async (event, { downloadDir }) => {
    const exeName = process.platform === 'win32' ? 'corregir_heuristico.exe' : 'corregir_heuristico'
    const exePath = is.dev
      ? join(__dirname, '../../resources/scripts/', exeName)
      : join(process.resourcesPath, 'scripts/', exeName)

    if (!existsSync(exePath)) {
      event.sender.send(
        'descarga-log',
        `AVISO: corrector no disponible en este sistema (${process.platform}) — se omite la corrección.`
      )
      return
    }

    const outputDir = join(downloadDir, 'Corregidos')
    mkdirSync(outputDir, { recursive: true })

    const csvFiles = readdirSync(downloadDir).filter((f) => f.endsWith('.csv'))

    for (const csvFile of csvFiles) {
      const inputPath = join(downloadDir, csvFile)
      const baseName = csvFile.replace(/\.csv$/i, '')
      const outputPath = join(outputDir, `${baseName}_Corregido.csv`)

      event.sender.send('descarga-log', `Corrigiendo: ${csvFile}`)
      await new Promise((resolve, reject) => {
        const child = spawn(exePath, [inputPath, '--corregir', '--salida', outputPath], {
          cwd: dirname(exePath)
        })
        activeChildren.add(child)

        child.on('error', (err) => {
          activeChildren.delete(child)
          event.sender.send('descarga-log', `ERROR al ejecutar corrector: ${err.message}`)
          resolve() // continuar con el siguiente archivo
        })

        child.stdout.on('data', (data) => event.sender.send('descarga-log', data.toString()))
        child.stderr.on('data', (data) =>
          event.sender.send('descarga-log', `ERROR: ${data.toString()}`)
        )

        child.on('close', (code) => {
          activeChildren.delete(child)
          if (code === 0) resolve()
          else reject(new Error(`corregir_heuristico.py terminó con código ${code}`))
        })
      })
    }
  })

  ipcMain.handle('listar-directorio', async (_, ruta) => {
    try {
      return await readdir(ruta)
    } catch {
      return []
    }
  })

  ipcMain.handle('leer-csv-rows', (_, ruta) => {
    if (fileCache.has(ruta)) return fileCache.get(ruta)

    const encodings = ['latin1', 'utf-8']
    let contenido = null
    for (const enc of encodings) {
      try {
        contenido = readFileSync(ruta, enc)
        if (contenido.includes('\n')) break
      } catch {
        continue
      }
    }
    if (!contenido) return []

    const lineas = contenido.split(/\r?\n/)
    if (lineas.length < 2) return []

    const headers = lineas[0].split('|').map((h) => h.trim())

    const rows = []
    for (let i = 1; i < lineas.length; i++) {
      const linea = lineas[i]
      if (!linea.trim()) continue
      const cols = linea.split('|')
      const obj = {}
      headers.forEach((h, j) => {
        obj[h] = (cols[j] ?? '').trim()
      })
      rows.push(obj)
    }

    if (fileCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = fileCache.keys().next().value
      fileCache.delete(firstKey)
    }
    fileCache.set(ruta, rows)
    return rows
  })

  ipcMain.handle('leer-excel-rows', (_, ruta) => {
    if (fileCache.has(ruta)) return fileCache.get(ruta)

    const wb = XLSX.readFile(ruta)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false })
    if (data.length < 1) return []
    const headers = data[0].map((h) => String(h).trim())
    const rows = data
      .slice(1)
      .filter((row) => row.some((v) => v !== ''))
      .map((row) => Object.fromEntries(headers.map((h, i) => [h, String(row[i] ?? '')])))

    if (fileCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = fileCache.keys().next().value
      fileCache.delete(firstKey)
    }
    fileCache.set(ruta, rows)
    return rows
  })

  ipcMain.handle('cancelar-descarga', () => {
    for (const child of activeChildren) child.kill()
    activeChildren.clear()
  })

  ipcMain.handle('iniciar-historial-pos', async (event, { downloadDir, headless, workers }) => {
    const scriptPath = is.dev
      ? join(__dirname, '../../resources/scripts/cargarHistorialPos.js')
      : join(process.resourcesPath, 'scripts/cargarHistorialPos.js')

    const sep = process.platform === 'win32' ? ';' : ':'
    const nodeModulesPath = is.dev
      ? join(__dirname, '../../node_modules')
      : `${join(process.resourcesPath, 'app.asar.unpacked/node_modules')}${sep}${join(process.resourcesPath, 'app.asar/node_modules')}`

    await new Promise((resolve) => {
      const child = spawn(process.execPath, [scriptPath, downloadDir, headless ? '1' : '0'], {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          NODE_PATH: nodeModulesPath,
          NUM_WORKERS: workers.toString(),
          VITE_API_URL: import.meta.env.VITE_API_URL
        }
      })
      activeChildren.add(child)

      child.stdout.on('data', (data) => event.sender.send('descarga-log', data.toString()))
      child.stderr.on('data', (data) =>
        event.sender.send('descarga-log', `ERROR: ${data.toString()}`)
      )

      child.on('close', (code) => {
        activeChildren.delete(child)
        // código 1 = hubo fallos parciales pero el script terminó — no rechazar
        resolve(code)
      })
    })
  })

  ipcMain.handle('crear-carpeta-descarga', (_, carpeta) => {
    const now = new Date()
    const fecha = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`
    const downloadDir = join(carpeta, fecha)
    mkdirSync(downloadDir, { recursive: true })
    return downloadDir
  })

  ipcMain.handle('iniciar-descarga', async (event, { ids, downloadDir, headless }) => {
    const scriptPath = is.dev
      ? join(__dirname, '../../resources/scripts/index.js')
      : join(process.resourcesPath, 'scripts/index.js')

    for (const id of ids) {
      await new Promise((resolve, reject) => {
        const sep = process.platform === 'win32' ? ';' : ':'
        const nodeModulesPath = is.dev
          ? join(__dirname, '../../node_modules')
          : `${join(process.resourcesPath, 'app.asar.unpacked/node_modules')}${sep}${join(process.resourcesPath, 'app.asar/node_modules')}`

        const child = spawn(process.execPath, [scriptPath, id, downloadDir, headless ? '1' : '0'], {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: nodeModulesPath,
            VITE_API_URL: import.meta.env.VITE_API_URL
          }
        })
        activeChildren.add(child)

        child.stdout.on('data', (data) => event.sender.send('descarga-log', data.toString()))
        child.stderr.on('data', (data) =>
          event.sender.send('descarga-log', `ERROR: ${data.toString()}`)
        )

        child.on('close', (code) => {
          activeChildren.delete(child)
          if (code === 0) resolve()
          else reject(new Error(`Proceso terminó con código ${code}`))
        })
      })
    }
  })

  ipcMain.handle(
    'iniciar-descarga-movimientos-anam-xlsx',
    async (event, { downloadDir, headless }) => {
      let scriptPath = is.dev
        ? join(__dirname, '../../resources/scripts/consultas.js')
        : join(process.resourcesPath, 'scripts/consultas.js')

      const sep = process.platform === 'win32' ? ';' : ':'
      const nodeModulesPath = is.dev
        ? join(__dirname, '../../node_modules')
        : `${join(process.resourcesPath, 'app.asar.unpacked/node_modules')}${sep}${join(process.resourcesPath, 'app.asar/node_modules')}`

      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath, downloadDir, headless ? '1' : '0'], {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: nodeModulesPath,
            VITE_API_URL: import.meta.env.VITE_API_URL
          }
        })
        activeChildren.add(child)

        child.stdout.on('data', (data) => event.sender.send('descarga-log', data.toString()))
        child.stderr.on('data', (data) =>
          event.sender.send('descarga-log', `ERROR: ${data.toString()}`)
        )

        child.on('close', (code) => {
          activeChildren.delete(child)
          if (code === 0) resolve()
          else reject(new Error(`Proceso terminó con código ${code}`))
        })
      })

      scriptPath = is.dev
        ? join(__dirname, '../../resources/scripts/descargarExcel.js')
        : join(process.resourcesPath, 'scripts/descargarExcel.js')

      await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [scriptPath, downloadDir, headless ? '1' : '0'], {
          env: {
            ...process.env,
            ELECTRON_RUN_AS_NODE: '1',
            NODE_PATH: nodeModulesPath,
            VITE_API_URL: import.meta.env.VITE_API_URL
          }
        })
        activeChildren.add(child)

        child.stdout.on('data', (data) => event.sender.send('descarga-log', data.toString()))
        child.stderr.on('data', (data) =>
          event.sender.send('descarga-log', `ERROR: ${data.toString()}`)
        )

        child.on('close', (code) => {
          activeChildren.delete(child)
          if (code === 0) resolve()
          else reject(new Error(`Proceso terminó con código ${code}`))
        })
      })

      // Eliminar la primera fila (basura del reporte) del xlsx descargado
      const xlsxFile = readdirSync(downloadDir).find(
        (f) =>
          !f.startsWith('~$') &&
          !f.startsWith('.~lock') &&
          ['.xlsx', '.xls'].includes(f.slice(f.lastIndexOf('.')).toLowerCase())
      )
      if (xlsxFile) {
        const xlsxPath = join(downloadDir, xlsxFile)
        const wb = XLSX.readFile(xlsxPath)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const range = XLSX.utils.decode_range(ws['!ref'])
        // Subir todas las filas un lugar (elimina la fila 0)
        for (let R = range.s.r; R < range.e.r; R++) {
          for (let C = range.s.c; C <= range.e.c; C++) {
            const next = ws[XLSX.utils.encode_cell({ r: R + 1, c: C })]
            if (next) {
              ws[XLSX.utils.encode_cell({ r: R, c: C })] = next
            } else {
              delete ws[XLSX.utils.encode_cell({ r: R, c: C })]
            }
          }
        }
        range.e.r--
        ws['!ref'] = XLSX.utils.encode_range(range)
        XLSX.writeFile(wb, xlsxPath)
        event.sender.send('descarga-log', 'Fila de encabezado de reporte eliminada del xlsx.')
      }
    }
  )

  createWindow()

  autoUpdater.on('error', (err) => console.error('Update error:', err.message))
  autoUpdater.on('checking-for-update', () => console.log('Buscando actualizaciones...'))
  autoUpdater.on('update-available', (info) =>
    console.log('Actualización disponible:', info.version)
  )
  autoUpdater.on('update-not-available', () => console.log('No hay actualizaciones'))
  autoUpdater.on('update-downloaded', () => {
    console.log('Descarga completa, reiniciando...')
    autoUpdater.quitAndInstall()
  })
  autoUpdater.checkForUpdatesAndNotify()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
