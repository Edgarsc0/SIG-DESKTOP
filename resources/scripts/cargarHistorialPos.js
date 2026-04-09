const { Builder, By, until } = require('selenium-webdriver')
const edge = require('selenium-webdriver/edge')
const fs = require('fs')
const path = require('path')
const os = require('os')

const ZAFIRO_USER = process.env.ZAFIRO_USER || 'RAAO81BA'
const ZAFIRO_PASS = process.env.ZAFIRO_PASS || 'M4rzo.2026'
const API_URL = process.env.VITE_API_URL || 'http://localhost:8080'
const DOWNLOAD_DIR = process.argv[2] || path.join(os.homedir(), 'Downloads', 'ZafiroDescargas')
const HEADLESS = process.argv[3] !== '0'
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 20
const NUM_WORKERS = parseInt(process.env.NUM_WORKERS) || Math.min(os.cpus().length, 4)

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

const progresoGlobal = { procesados: 0, fallos: 0, total: 0 }

function barraGlobal() {
  if (progresoGlobal.total === 0) return ''
  const intentados = progresoGlobal.procesados + progresoGlobal.fallos
  const pct = (intentados / progresoGlobal.total) * 100
  return `${pct.toFixed(1)}% | ${intentados}/${progresoGlobal.total} | Fallos: ${progresoGlobal.fallos}`
}

function actualizarProgresoGlobal() {
  console.log(barraGlobal())
}

// ─── XPaths ───────────────────────────────────────────────────────────────────
const XPATH_INPUT_POS =
  '/html/body/form/div[4]/div[2]/table/tbody/tr/td/table/tbody/tr[1]/td[3]/div/input'
const XPATH_BTN_BUSCAR = '/html/body/form/div[4]/div[3]/a[1]/span/input'
const SPAN_NO_EMPLEADO =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[2]/td[2]/div/span'
const SPAN_NOMBRE_EMP =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[2]/td[3]/div/span'
const SPAN_FECHA_ENT =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[5]/td[4]/div/span'
const SPAN_FECHA_FIN =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[7]/td[3]/div/span'
const SPAN_MOTIVO =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[9]/td[3]/div/span'
const SPAN_SAL_ENT =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[5]/td[5]/div/span'
const SPAN_SAL_FIN =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[7]/td[4]/div/span'
const SPAN_F_ENT_PLAN =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[5]/td[8]/div/span'
const SPAN_F_FIN_PLAN =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[7]/td[7]/div/span'
const SPAN_F_ENT_GRADO =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[5]/td[9]/div/span'
const SPAN_F_FIN_GRADO =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[7]/td[8]/div/span'
const SPAN_F_ENT_ESC =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[5]/td[10]/div/span'
const SPAN_F_FIN_ESC =
  '/html/body/form/div[4]/table/tbody/tr[1]/td/div/table/tbody/tr[5]/td[2]/div/table/tbody/tr[2]/td/table/tbody/tr[7]/td[9]/div/span'

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    await driver.sleep(500)
  }
  throw new Error(`No se encontró el enlace "${text}"`)
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
    await driver.sleep(500)
  }
  throw new Error(`No se encontró el selector "${selector}"`)
}

async function switchToWorkFrame(driver, frameId, timeoutMs = 15000) {
  await driver.switchTo().defaultContent()
  await driver.wait(until.elementLocated(By.id(frameId)), timeoutMs)
  await driver.switchTo().frame(await driver.findElement(By.id(frameId)))
}

async function getText(driver, xpath) {
  return (await (await driver.findElement(By.xpath(xpath))).getText()).trim()
}

async function flushBatch(buffer) {
  if (buffer.length === 0) return
  const res = await fetch(`${API_URL}/api/insertar-historial-pos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: buffer })
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`BD bulk: ${json.error}`)
  console.log(`✓ Lote de ${buffer.length} registros insertado.`)
}

function createDriver() {
  const options = new edge.Options()
  options.addArguments('--disable-blink-features=AutomationControlled')
  options.addArguments('--window-size=1920,1080')
  if (HEADLESS) options.addArguments('--headless=new')
  options.setUserPreferences({
    'download.default_directory': DOWNLOAD_DIR,
    'download.prompt_for_download': false,
    'download.directory_upgrade': true,
    'safebrowsing.enabled': true
  })
  return new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(options).build()
}

async function login(driver) {
  await driver.get('https://peanam.mat.sat.gob.mx/psp/anamhum/EMPLOYEE/HRMS/')
  await driver.wait(until.elementLocated(By.id('userid')), 10000)
  await driver.findElement(By.id('userid')).sendKeys(ZAFIRO_USER)
  await driver.wait(until.elementLocated(By.id('pwd')), 10000)
  await driver.findElement(By.id('pwd')).sendKeys(ZAFIRO_PASS)
  await driver.sleep(2000)
  await driver.executeScript(
    "document.querySelector('body > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > table > tbody > tr > td > table:nth-child(3) > tbody > tr:nth-child(4) > td:nth-child(3) > input').click();"
  )
  await driver.sleep(2500)
}

async function navegarAHistorial(driver) {
  await driver.wait(until.elementLocated(By.id('pthnavbca_PORTAL_ROOT_OBJECT')), 10000)
  await driver.findElement(By.id('pthnavbca_PORTAL_ROOT_OBJECT')).click()
  await driver.sleep(1500)
  await waitAndClick(driver, '#crefli_SAT_EO_WKCN > a', 10000)
  await driver.sleep(2000)
  await clickLinkByText(driver, 'Historial de Posición', 20000)
  await driver.sleep(2000)
  await switchToWorkFrame(driver, 'ptifrmtgtframe')
  await driver.wait(until.elementLocated(By.xpath(XPATH_INPUT_POS)), 15000)
}

async function procesarPosicion(driver, noPos) {
  const input = await driver.findElement(By.xpath(XPATH_INPUT_POS))
  await input.clear()
  await input.sendKeys(noPos)
  await driver.findElement(By.xpath(XPATH_BTN_BUSCAR)).click()

  await driver.switchTo().defaultContent()
  await switchToWorkFrame(driver, 'ptifrmtgtframe')

  const XPATH_NO_RESULTADOS = '/html/body/form/div[4]/div[4]/h2'
  await driver.wait(
    until.elementLocated(By.xpath(`${SPAN_NO_EMPLEADO} | ${XPATH_NO_RESULTADOS}`)),
    20000
  )

  const noResultados = await driver.findElements(By.xpath(XPATH_NO_RESULTADOS))
  if (noResultados.length > 0) {
    const texto = (await noResultados[0].getText()).trim()
    if (texto === 'No hay valores coincidentes.') {
      return { ok: false, noPos, error: 'No encontrada en el SIG' }
    }
  }

  await driver.wait(until.elementLocated(By.xpath(SPAN_NO_EMPLEADO)), 5000)

  return {
    ok: true,
    data: {
      no_pos: noPos,
      no_empleado: await getText(driver, SPAN_NO_EMPLEADO),
      nombre_empleado: await getText(driver, SPAN_NOMBRE_EMP),
      fecha_entrada: await getText(driver, SPAN_FECHA_ENT),
      fecha_fin: await getText(driver, SPAN_FECHA_FIN),
      motivo_salida: await getText(driver, SPAN_MOTIVO),
      salario_entrada: await getText(driver, SPAN_SAL_ENT),
      salario_fin: await getText(driver, SPAN_SAL_FIN),
      f_entrada_plan_sal: await getText(driver, SPAN_F_ENT_PLAN),
      f_fin_plan_sal: await getText(driver, SPAN_F_FIN_PLAN),
      grado_entrada: await getText(driver, SPAN_F_ENT_GRADO),
      grado_fin: await getText(driver, SPAN_F_FIN_GRADO),
      escala_entrada: await getText(driver, SPAN_F_ENT_ESC),
      escala_fin: await getText(driver, SPAN_F_FIN_ESC)
    }
  }
}

async function workerProcesarPosiciones(posiciones, workerId) {
  const driver = createDriver()
  const workerFallos = []
  const buffer = []
  let wAttempted = 0
  let wFallos = 0
  const wTotal = posiciones.length

  function emitWorkerProg() {
    const pct = wTotal > 0 ? ((wAttempted / wTotal) * 100).toFixed(1) : '0.0'
    process.stdout.write(`[WORKER_PROG:${workerId}:${pct}:${wAttempted}:${wTotal}:${wFallos}]\n`)
  }

  async function flushBuffer() {
    if (buffer.length === 0) return
    await flushBatch(buffer.splice(0))
  }

  try {
    await login(driver)
    await navegarAHistorial(driver)

    for (let i = 0; i < posiciones.length; i++) {
      const noPos = posiciones[i]

      try {
        const resultado = await procesarPosicion(driver, noPos)

        if (resultado.ok) {
          buffer.push(resultado.data)
          if (buffer.length >= BATCH_SIZE) await flushBuffer()
          progresoGlobal.procesados++
        } else {
          workerFallos.push({ noPos, error: resultado.error })
          progresoGlobal.fallos++
          wFallos++
        }
        wAttempted++
        actualizarProgresoGlobal()
        emitWorkerProg()

        await clickLinkByText(driver, 'Historial de Posición', 20000)
        await switchToWorkFrame(driver, 'ptifrmtgtframe')
        await driver.wait(until.elementLocated(By.xpath(XPATH_INPUT_POS)), 15000)
      } catch (err) {
        workerFallos.push({ noPos, error: err.message })
        progresoGlobal.fallos++
        progresoGlobal.procesados++
        wFallos++
        wAttempted++
        actualizarProgresoGlobal()
        emitWorkerProg()

        try {
          await clickLinkByText(driver, 'Historial de Posición', 20000)
          await switchToWorkFrame(driver, 'ptifrmtgtframe')
          await driver.wait(until.elementLocated(By.xpath(XPATH_INPUT_POS)), 15000)
        } catch (_) {}
      }
    }

    await flushBuffer()
  } finally {
    await driver.quit()
  }

  return { workerId, fallos: workerFallos }
}

async function runWorkers(posiciones) {
  progresoGlobal.total = posiciones.length
  progresoGlobal.procesados = 0
  progresoGlobal.fallos = 0

  const numWorkers = Math.min(NUM_WORKERS, posiciones.length)
  const chunkSize = Math.ceil(posiciones.length / numWorkers)
  const chunks = []

  for (let i = 0; i < numWorkers; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize, posiciones.length)
    if (start < posiciones.length) {
      chunks.push(posiciones.slice(start, end))
    }
  }

  console.log(`[WORKERS:${chunks.length}] Iniciando ${chunks.length} workers en paralelo...\n`)
  actualizarProgresoGlobal()

  const promises = chunks.map((chunk, idx) => workerProcesarPosiciones(chunk, idx))
  const results = await Promise.all(promises)

  console.log(barraGlobal())

  let allFallos = []
  let totalProcesados = 0

  for (const result of results) {
    allFallos = allFallos.concat(result.fallos.map((f) => ({ ...f, worker: result.workerId + 1 })))
    totalProcesados += chunks[result.workerId].length - result.fallos.length
  }

  return { exitosos: totalProcesados, fallos: allFallos }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  console.log('Truncando HISTORIAL_POS...')
  try {
    const res = await fetch(`${API_URL}/api/truncar-tabla/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabla: 'HISTORIAL_POS' })
    })
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    console.log('HISTORIAL_POS truncada.')
  } catch (err) {
    console.error(`ERROR al truncar: ${err.message}`)
    process.exit(1)
  }

  console.log('Obteniendo posiciones de MOV_POS...')
  let posiciones = []
  try {
    const res = await fetch(`${API_URL}/api/posiciones-mov-pos/`)
    const data = await res.json()
    if (!data.ok) throw new Error(data.error)
    posiciones = data.posiciones
    console.log(`${posiciones.length} posiciones encontradas.`)
  } catch (err) {
    console.error(`ERROR al obtener posiciones: ${err.message}`)
    process.exit(1)
  }

  if (posiciones.length === 0) {
    console.log('No hay posiciones en MOV_POS. Fin.')
    process.exit(0)
  }

  console.log(`Iniciando con ${NUM_WORKERS} navegadores en paralelo...`)

  const { exitosos, fallos } = await runWorkers(posiciones)

  console.log(`\n\nRESUMEN: ${exitosos}/${posiciones.length} posiciones procesadas correctamente.`)
  if (fallos.length > 0) {
    console.log(`FALLOS (${fallos.length}):`)
    for (const { worker, noPos, error } of fallos) {
      console.log(`  [W${worker}] ${noPos}: ${error}`)
    }
    process.exit(1)
  }
}

main()
