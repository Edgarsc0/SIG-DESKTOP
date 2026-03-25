const { Builder, By, until } = require('selenium-webdriver')
const edge = require('selenium-webdriver/edge')
require('edgedriver')
const fs = require('fs')
const path = require('path')
const os = require('os')

const DOWNLOAD_DIR = process.argv[3] || path.join(os.homedir(), 'Downloads', 'ZafiroDescargas')
const HEADLESS = process.argv[4] !== '0'

const CHECKBOX_IDS = [
  {
    checkboxId: 'ZAFIRO_WRK_FLAG1', //Posiciones
    id: 1,
    name: 'Posiciones'
  },
  {
    checkboxId: 'ZAFIRO_WRK_FLAG2', //Empleados Activos
    id: 2,
    name: 'Empleados Activos'
  },
  {
    checkboxId: 'ZAFIRO_WRK_FLAG3', //Empleados bajas
    id: 3,
    name: 'Empleados bajas'
  },
  {
    checkboxId: 'ZAFIRO_WRK_FLAG4', //Familiares
    id: 4,
    name: 'Familiares'
  },
  {
    checkboxId: 'ZAFIRO_WRK_FLAG7', //Escolaridad
    id: 7,
    name: 'Escolaridad'
  }
]

const argIndex = parseInt(process.argv[2])
console.log('ArgIndex: ' + argIndex + '\n')
const TARGET_ID = CHECKBOX_IDS.find((item) => item.id === argIndex).checkboxId
console.log('TargetID: ' + TARGET_ID + '\n')
const LABEL_ID = TARGET_ID + '_LBL'
console.log('LabelID: ' + LABEL_ID + '\n')

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

function snapshotArchivos(dir) {
  if (!fs.existsSync(dir)) return new Set()
  return new Set(fs.readdirSync(dir))
}

async function waitForNewDownload(dir, previos, timeoutMs = 180000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const actuales = fs.readdirSync(dir)
    const enProgreso = actuales.some((f) => f.endsWith('.crdownload') || f.endsWith('.tmp'))
    const nuevosCompletos = actuales.filter(
      (f) => !previos.has(f) && !f.endsWith('.crdownload') && !f.endsWith('.tmp')
    )
    if (nuevosCompletos.length > 0 && !enProgreso) return nuevosCompletos[0]
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timeout: descarga no completó en ${timeoutMs / 1000}s`)
}

async function clickLinkByText(driver, text, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await driver.switchTo().defaultContent()
    try {
      const link = await driver.findElement(By.xpath(`//a[contains(., '${text}')]`))
      await driver.executeScript('arguments[0].scrollIntoView(true);', link)
      await driver.sleep(300)
      await link.click()
      return
    } catch (_) {}
    for (const iframe of await driver.findElements(By.css('iframe'))) {
      try {
        await driver.switchTo().frame(iframe)
        const link = await driver.findElement(By.xpath(`//a[contains(., '${text}')]`))
        await driver.executeScript('arguments[0].scrollIntoView(true);', link)
        await driver.sleep(300)
        await link.click()
        await driver.switchTo().defaultContent()
        return
      } catch (_) {
        await driver.switchTo().defaultContent()
      }
    }
    await driver.sleep(1000)
  }
  throw new Error(`No se encontró el enlace "${text}" en ${timeoutMs}ms`)
}

async function waitAndClick(driver, selector, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await driver.switchTo().defaultContent()
    try {
      await driver.wait(until.elementLocated(By.css(selector)), 2000)
      const el = await driver.findElement(By.css(selector))
      await driver.executeScript('arguments[0].scrollIntoView(true);', el)
      await driver.sleep(200)
      await el.click()
      return
    } catch (_) {}
    for (const iframe of await driver.findElements(By.css('iframe'))) {
      try {
        await driver.switchTo().frame(iframe)
        const el = await driver.findElement(By.css(selector))
        await driver.executeScript('arguments[0].scrollIntoView(true);', el)
        await driver.sleep(200)
        await el.click()
        await driver.switchTo().defaultContent()
        return
      } catch (_) {
        await driver.switchTo().defaultContent()
      }
    }
    await driver.sleep(1000)
  }
  throw new Error(`No se encontró el selector "${selector}" en ${timeoutMs}ms`)
}

async function switchToWorkFrame(driver, frameId, timeoutMs = 15000) {
  await driver.switchTo().defaultContent()
  await driver.wait(until.elementLocated(By.id(frameId)), timeoutMs)
  await driver.switchTo().frame(await driver.findElement(By.id(frameId)))
}

const main = async () => {
  console.log(`Procesando checkbox ${argIndex}...`)
  const options = new edge.Options()
  options.addArguments('--disable-blink-features=AutomationControlled')
  options.addArguments('--start-maximized')
  options.addArguments('--window-size=1920,1080')
  if (HEADLESS) options.addArguments('--headless=new')
  options.setUserPreferences({
    'download.default_directory': DOWNLOAD_DIR,
    'download.prompt_for_download': false,
    'download.directory_upgrade': true,
    'safebrowsing.enabled': true
  })

  const driver = await new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(options).build()

  try {
    await driver.get('https://peanam.mat.sat.gob.mx/psp/anamhum/EMPLOYEE/HRMS/')

    await driver.wait(until.elementLocated(By.id('userid')), 10000)
    await driver.findElement(By.id('userid')).sendKeys('RAAO81BA')
    await driver.wait(until.elementLocated(By.id('pwd')), 10000)
    await driver.findElement(By.id('pwd')).sendKeys('M4rzo.2026')
    await driver.sleep(2000)
    await driver.executeScript(
      "document.querySelector('body > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > table > tbody > tr > td > table:nth-child(3) > tbody > tr:nth-child(4) > td:nth-child(3) > input').click();"
    )
    await driver.sleep(2500)

    await driver.wait(until.elementLocated(By.id('pthnavbca_PORTAL_ROOT_OBJECT')), 10000)
    await driver.findElement(By.id('pthnavbca_PORTAL_ROOT_OBJECT')).click()
    await driver.sleep(1500)

    await waitAndClick(driver, '#crefli_SAT_EO_WKCN > a', 10000)
    await driver.sleep(2500)

    await clickLinkByText(driver, 'Informacion ZAFIRO', 20000)
    await driver.sleep(2000)

    await switchToWorkFrame(driver, 'ptifrmtgtframe')

    await driver.wait(until.elementLocated(By.id(LABEL_ID)), 10000)
    const labelEl = await driver.findElement(By.id(LABEL_ID))
    const labelText = (await labelEl.getText())
      .trim()
      .replace(/[^a-zA-Z0-9_\-áéíóúÁÉÍÓÚñÑ ]/g, '')
      .replace(/\s+/g, '_')

    for (const id of CHECKBOX_IDS) {
      try {
        const cb = await driver.findElement(By.id(id))
        if (await cb.isSelected()) await cb.click()
      } catch (_) {}
    }

    const checkbox = await driver.findElement(By.id(TARGET_ID))
    if (!(await checkbox.isSelected())) await checkbox.click()
    await driver.sleep(300)

    const previos = snapshotArchivos(DOWNLOAD_DIR)
    const btn = await driver.findElement(By.id('ZAFIRO_WRK_EXECUTE_PB'))
    await driver.executeScript('arguments[0].scrollIntoView(true);', btn)
    await driver.sleep(2000)
    await btn.click()

    const archivoDescargado = await waitForNewDownload(DOWNLOAD_DIR, previos)
    const nombreFinal = `zafiro_info_${labelText}.csv`
    fs.renameSync(path.join(DOWNLOAD_DIR, archivoDescargado), path.join(DOWNLOAD_DIR, nombreFinal))
    console.log(`Archivo guardado: ${nombreFinal}`)
    console.log(`Proceso terminado: checkbox ${argIndex}`)
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await driver.quit()
  }
}

main()
