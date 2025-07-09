const puppeteer = require("puppeteer");
const { sleep } = require("./utils");
const fs = require("fs");
const path = require("path");

function getRandomWatermarkImageBase64(pageWidth, pageHeight) {
  const watermarkDir = path.resolve(__dirname, "watermark");
  const files = fs.readdirSync(watermarkDir).filter((f) => f.endsWith(".png"));
  // 預設水印寬高
  const watermarkW = 300,
    watermarkH = 300;
  for (let i = 0; i < files.length; ++i) {
    const idx = Math.floor(Math.random() * files.length);
    const file = files[idx];
    if (pageWidth > watermarkW + 100 && pageHeight > watermarkH + 100) {
      const filePath = path.join(watermarkDir, file);
      const data = fs.readFileSync(filePath);
      const base64 = data.toString("base64");
      return `data:image/png;base64,${base64}`;
    }
  }
  return null;
}

async function generateImageFromHTML(html, outputPath) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ],
    });
    const page = await browser.newPage();
    // 預設寬度夠大，避免內容被壓縮
    await page.setViewport({ width: 2600, height: 1080 });
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await sleep(1000);
    // 自動偵測內容寬度
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewport({ width: bodyWidth, height: bodyHeight });
    await sleep(500);
    await page.screenshot({
      path: outputPath,
      fullPage: true,
      type: "png",
    });
    console.log(`[ODOG] 圖片已生成: ${outputPath}`);
  } catch (error) {
    console.error("[ODOG] 生成圖片時發生錯誤:", error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generateOdogImage(userStats, title, outputPath) {
  const { generateHTML } = require("./html-generator");
  try {
    // 預設寬高
    const pageWidth = 2400,
      pageHeight = 1400;
    const watermarkImage = getRandomWatermarkImageBase64(pageWidth, pageHeight);
    const html = generateHTML(userStats, title, watermarkImage);
    // 先存一份 HTML
    const htmlPath = outputPath.replace(/\.png$/, ".html");
    fs.writeFileSync(htmlPath, html, "utf8");
    // 再生成圖片
    await generateImageFromHTML(html, outputPath);
  } catch (error) {
    console.error("[ODOG] 生成歐狗圖片失敗:", error);
    throw error;
  }
}

module.exports = {
  generateImageFromHTML,
  generateOdogImage,
};
