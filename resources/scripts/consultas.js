const { Builder, By, until } = require('selenium-webdriver')
const edge = require('selenium-webdriver/edge')
require('edgedriver')
const fs = require('fs')
const path = require('path')
const os = require('os')

const ZAFIRO_USER = process.env.ZAFIRO_USER || 'RAAO81BA'
const ZAFIRO_PASS = process.env.ZAFIRO_PASS || 'M4rzo.2026'
const DOWNLOAD_DIR = process.argv[2] || path.join(os.homedir(), 'Downloads', 'ZafiroDescargas')
const HEADLESS = process.argv[3] !== '0'
const CONSULTA_NAME = 'ANAM_EMPLEADOS_OMAR_ANI'

if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })

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

async function switchToWorkFrame(driver, frameId, timeoutMs = 15000) {
  await driver.switchTo().defaultContent()
  await driver.wait(until.elementLocated(By.id(frameId)), timeoutMs)
  await driver.switchTo().frame(await driver.findElement(By.id(frameId)))
}

const main = async () => {
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
    console.log('Creando consulta...')

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

    await driver.wait(until.elementLocated(By.id('pthnavbca_PORTAL_ROOT_OBJECT')), 10000)
    await driver.findElement(By.id('pthnavbca_PORTAL_ROOT_OBJECT')).click()
    await driver.sleep(1500)

    await waitAndClick(driver, '#crefli_SAT_EO_WKCN > a', 10000)
    await driver.sleep(2500)

    await clickLinkByText(driver, 'Consultas', 20000)
    await driver.sleep(2000)

    await switchToWorkFrame(driver, 'ptalPgltAreaFrame')

    await driver.wait(until.elementLocated(By.css('.EOPP_SCCHILDCONTENTLINK')), 10000)
    let links = await driver.findElements(By.css('.EOPP_SCCHILDCONTENTLINK'))
    await links[0].click()
    await driver.sleep(2000)

    await switchToWorkFrame(driver, 'ptifrmtgtframe')

    await driver.wait(until.elementLocated(By.id('QRYSELECT_WRK_QRYSEARCHTEXT254')), 10000)
    const input = await driver.findElement(By.id('QRYSELECT_WRK_QRYSEARCHTEXT254'))
    await input.sendKeys(CONSULTA_NAME)

    await driver.wait(until.elementLocated(By.id('QRYSELECT_WRK_QRYSEARCHBTN')), 10000)
    await driver.findElement(By.id('QRYSELECT_WRK_QRYSEARCHBTN')).click()
    await driver.sleep(2500)

    await driver.wait(until.elementLocated(By.id('QRYSELECT_WRK_QRYSCHEDULE$0')), 10000)
    await driver.findElement(By.id('QRYSELECT_WRK_QRYSCHEDULE$0')).click()
    await driver.sleep(4000)

    await driver.wait(until.elementLocated(By.id('SEARCH_RESULT1')), 10000)
    await driver.findElement(By.id('SEARCH_RESULT1')).click()
    await driver.sleep(2000)

    await driver.wait(until.elementLocated(By.css('.PSPUSHBUTTON')), 10000)
    const buttons = await driver.findElements(By.css('.PSPUSHBUTTON'))
    await buttons[0].click()
    await driver.sleep(2000)

    await driver.switchTo().defaultContent()
    await driver.wait(
      until.elementLocated(By.xpath('/html/body/div[9]/div[2]/div/div[2]/iframe')),
      10000
    )
    const modalFrame = await driver.findElement(
      By.xpath('/html/body/div[9]/div[2]/div/div[2]/iframe')
    )
    await driver.switchTo().frame(modalFrame)

    await driver.wait(
      until.elementLocated(By.xpath('/html/body/form/div[3]/div[2]/span/a[1]/span/input')),
      10000
    )
    const buttonAceptar = await driver.findElement(
      By.xpath('/html/body/form/div[3]/div[2]/span/a[1]/span/input')
    )
    await buttonAceptar.click()
    await driver.sleep(5000)

    await driver.switchTo().defaultContent()
    await switchToWorkFrame(driver, 'ptalPgltAreaFrame')
    await driver.wait(until.elementLocated(By.css('.EOPP_SCCHILDCONTENTLINK')), 10000)

    links = await driver.findElements(By.css('.EOPP_SCCHILDCONTENTLINK'))
    await links[3].click()
    await driver.sleep(2000)

    await driver.switchTo().defaultContent()
    await switchToWorkFrame(driver, 'ptifrmtgtframe')

    await driver.wait(until.elementLocated(By.id('REFRESH_BTN')), 10000)
    await driver.findElement(By.id('REFRESH_BTN')).click()
    await driver.wait(until.elementLocated(By.id('PMN_PRCSLIST_DISTSTATUS$0')), 10000)

    let span = await driver.findElement(By.id('PMN_PRCSLIST_DISTSTATUS$0'))
    let text = await span.getText()

    while (text !== 'Enviado') {
      await driver.sleep(2000)
      await driver.wait(until.elementLocated(By.id('REFRESH_BTN')), 10000)
      await driver.findElement(By.id('REFRESH_BTN')).click()
      await driver.wait(until.elementLocated(By.id('PMN_PRCSLIST_DISTSTATUS$0')), 10000)
      span = await driver.findElement(By.id('PMN_PRCSLIST_DISTSTATUS$0'))
      text = await span.getText()
      console.log(`Estado actual: ${text}`)
    }

    console.log(text)
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await driver.quit()
  }
}

main()
