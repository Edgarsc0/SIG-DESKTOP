import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { mkdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { autoUpdater } from 'electron-updater'

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    title: 'ANAM - Sistema de Gestión Automatizada',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.handle('get-version', () => app.getVersion())

  ipcMain.handle('seleccionar-carpeta', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    return canceled ? null : filePaths[0]
  })

  ipcMain.handle('iniciar-descarga', async (event, { ids, carpeta, headless }) => {
    const scriptPath = is.dev
      ? join(__dirname, '../../resources/scripts/index.js')
      : join(process.resourcesPath, 'scripts/index.js')

    const now = new Date()
    const fecha = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}`
    const downloadDir = join(carpeta, fecha)
    mkdirSync(downloadDir, { recursive: true })

    for (const id of ids) {
      await new Promise((resolve, reject) => {
        const nodeModulesPath = is.dev
          ? join(__dirname, '../../node_modules')
          : join(process.resourcesPath, 'app.asar/node_modules')

        const child = spawn(process.execPath, [scriptPath, id, downloadDir, headless ? '1' : '0'], {
          env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', NODE_PATH: nodeModulesPath }
        })

        child.stdout.on('data', (data) => {
          event.sender.send('descarga-log', data.toString())
        })

        child.stderr.on('data', (data) => {
          event.sender.send('descarga-log', `ERROR: ${data.toString()}`)
        })

        child.on('close', (code) => {
          if (code === 0) resolve()
          else reject(new Error(`Proceso terminó con código ${code}`))
        })
      })
    }
  })

  createWindow()
  autoUpdater.requestHeaders = { Authorization: `token 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` }
  autoUpdater.checkForUpdatesAndNotify()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
