const { Builder, By, until } = require("selenium-webdriver");
const edge = require("selenium-webdriver/edge");
require("edgedriver");
const fs = require("fs");
const path = require("path");
const os = require("os");

const DOWNLOAD_DIR =
  process.argv[2] || path.join(os.homedir(), "Downloads", "ZafiroDescargas");

if (!fs.existsSync(DOWNLOAD_DIR))
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

function snapshotArchivos(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir));
}

async function waitAndClick(driver, selector, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await driver.switchTo().defaultContent();
    try {
      await driver.wait(until.elementLocated(By.css(selector)), 2000);
      const el = await driver.findElement(By.css(selector));
      await driver.executeScript("arguments[0].scrollIntoView(true);", el);
      await driver.sleep(200);
      await el.click();
      return;
    } catch (_) {}
    for (const iframe of await driver.findElements(By.css("iframe"))) {
      try {
        await driver.switchTo().frame(iframe);
        const el = await driver.findElement(By.css(selector));
        await driver.executeScript("arguments[0].scrollIntoView(true);", el);
        await driver.sleep(200);
        await el.click();
        await driver.switchTo().defaultContent();
        return;
      } catch (_) {
        await driver.switchTo().defaultContent();
      }
    }
    await driver.sleep(1000);
  }
  throw new Error(`No se encontró el selector "${selector}" en ${timeoutMs}ms`);
}

async function waitForNewDownload(dir, previos, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const actuales = fs.readdirSync(dir);
    const enProgreso = actuales.some(
      (f) => f.endsWith(".crdownload") || f.endsWith(".tmp"),
    );
    const nuevosCompletos = actuales.filter(
      (f) =>
        !previos.has(f) && !f.endsWith(".crdownload") && !f.endsWith(".tmp"),
    );
    if (nuevosCompletos.length > 0 && !enProgreso) return nuevosCompletos[0];
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Timeout: descarga no completó en ${timeoutMs / 1000}s`);
}

async function clickLinkByText(driver, text, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await driver.switchTo().defaultContent();
    try {
      const link = await driver.findElement(
        By.xpath(`//a[contains(., '${text}')]`),
      );
      await driver.executeScript("arguments[0].scrollIntoView(true);", link);
      await driver.sleep(300);
      await link.click();
      return;
    } catch (_) {}
    for (const iframe of await driver.findElements(By.css("iframe"))) {
      try {
        await driver.switchTo().frame(iframe);
        const link = await driver.findElement(
          By.xpath(`//a[contains(., '${text}')]`),
        );
        await driver.executeScript("arguments[0].scrollIntoView(true);", link);
        await driver.sleep(300);
        await link.click();
        await driver.switchTo().defaultContent();
        return;
      } catch (_) {
        await driver.switchTo().defaultContent();
      }
    }
    await driver.sleep(1000);
  }
  throw new Error(`No se encontró el enlace "${text}" en ${timeoutMs}ms`);
}

async function switchToWorkFrame(driver, frameId, timeoutMs = 15000) {
  await driver.switchTo().defaultContent();
  await driver.wait(until.elementLocated(By.id(frameId)), timeoutMs);
  await driver.switchTo().frame(await driver.findElement(By.id(frameId)));
}

const main = async () => {
  const options = new edge.Options();
  options.addArguments("--disable-blink-features=AutomationControlled");
  options.addArguments("--start-maximized");
  options.addArguments("--window-size=1920,1080");
  //options.addArguments("--headless=new");
  options.setUserPreferences({
    "download.default_directory": DOWNLOAD_DIR,
    "download.prompt_for_download": false,
    "download.directory_upgrade": true,
    "safebrowsing.enabled": true,
  });

  const driver = await new Builder()
    .forBrowser("MicrosoftEdge")
    .setEdgeOptions(options)
    .build();

  try {
    await driver.get(
      "https://peanam.mat.sat.gob.mx/psp/anamhum/EMPLOYEE/HRMS/",
    );

    await driver.wait(until.elementLocated(By.id("userid")), 10000);
    await driver.findElement(By.id("userid")).sendKeys("RAAO81BA");
    await driver.wait(until.elementLocated(By.id("pwd")), 10000);
    await driver.findElement(By.id("pwd")).sendKeys("M4rzo.2026");
    await driver.sleep(2000);
    await driver.executeScript(
      "document.querySelector('body > table > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > table > tbody > tr > td > table > tbody > tr > td > table:nth-child(3) > tbody > tr:nth-child(4) > td:nth-child(3) > input').click();",
    );
    await driver.sleep(2500);

    await driver.wait(
      until.elementLocated(By.id("pthnavbca_PORTAL_ROOT_OBJECT")),
      10000,
    );
    await driver.findElement(By.id("pthnavbca_PORTAL_ROOT_OBJECT")).click();
    await driver.sleep(1500);

    await waitAndClick(driver, "#crefli_SAT_EO_WKCN > a", 10000);
    await driver.sleep(2500);

    await clickLinkByText(driver, "Consultas", 20000);
    await driver.sleep(2000);

    await switchToWorkFrame(driver, "ptalPgltAreaFrame");

    links = await driver.findElements(By.css(".EOPP_SCCHILDCONTENTLINK"));
    await links[3].click();
    await driver.sleep(2000);

    await driver.switchTo().defaultContent();
    await switchToWorkFrame(driver, "ptifrmtgtframe");

    await driver.sleep(5000);

    await driver.wait(until.elementLocated(By.id("PRCSDETAIL_BTN$0")), 10000);
    await driver.findElement(By.id("PRCSDETAIL_BTN$0")).click();
    await driver.sleep(2000);

    //Modal de Detalle de proceso
    await switchToWorkFrame(driver, "ptModFrame_0");
    await driver.wait(
      until.elementLocated(By.id("PMN_DERIVED_INDEX_BTN")),
      10000,
    );
    await driver.findElement(By.id("PMN_DERIVED_INDEX_BTN")).click();
    await driver.sleep(5000);

    await driver.switchTo().defaultContent();
    await switchToWorkFrame(driver, "ptModFrame_1");

    await driver.wait(until.elementLocated(By.id("URL$1")), 10000);
    const a = await driver.findElement(By.id("URL$1"));
    const fileName = await a.getText();
    const previos = snapshotArchivos(DOWNLOAD_DIR);
    await a.click();
    console.log(`Descargando: ${fileName}`);

    const archivoDescargado = await waitForNewDownload(DOWNLOAD_DIR, previos);
    const nombreFinal = `movimientos_${fileName}`;
    fs.renameSync(
      path.join(DOWNLOAD_DIR, archivoDescargado),
      path.join(DOWNLOAD_DIR, nombreFinal),
    );
    console.log(`Archivo guardado en: ${path.join(DOWNLOAD_DIR, nombreFinal)}`);

    await driver.sleep(5000);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await driver.quit();
  }
};

main();
