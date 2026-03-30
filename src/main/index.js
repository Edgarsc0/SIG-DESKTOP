import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, dirname } from 'path'
import { spawn } from 'child_process'
import { mkdirSync, readdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

const activeChildren = new Set()

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
            "style-src 'self' 'unsafe-inline'; " +
            "connect-src 'self' http://127.0.0.1:8000 http://localhost:8000;"
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

  ipcMain.handle('abrir-carpeta', (_, ruta) => shell.openPath(ruta))

  ipcMain.handle('corregir-archivos', async (event, { downloadDir }) => {
    const exeName = process.platform === 'win32' ? 'corregir_heuristico.exe' : 'corregir_heuristico'
    const exePath = is.dev
      ? join(__dirname, '../../resources/scripts/', exeName)
      : join(process.resourcesPath, 'scripts/', exeName)

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

  ipcMain.handle('cancelar-descarga', () => {
    for (const child of activeChildren) child.kill()
    activeChildren.clear()
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
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodeModulesPath }
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
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodeModulesPath }
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
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodeModulesPath }
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
