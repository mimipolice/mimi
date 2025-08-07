import puppeteer from "puppeteer";
import { marked } from "marked";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const CACHE_DIR = path.join(process.cwd(), ".cache", "help-images");

let tableCss: string | null = null;

async function getTableCss(): Promise<string> {
  if (tableCss) {
    return tableCss;
  }
  try {
    const cssPath = path.join(__dirname, "table-style.css");
    tableCss = await fs.readFile(cssPath, "utf-8");
    return tableCss;
  } catch (error) {
    console.error(
      "Could not read table-style.css, using default styles:",
      error
    );
    // Return a default style in case the file is missing
    return `
      body { background-color: #313338; color: #dbdee1; }
      table { border-collapse: collapse; }
      th, td { border: 1px solid #4e5058; padding: 8px; }
    `;
  }
}

function createCacheKey(
  sourceFilePath: string,
  tableIndex: number,
  markdown: string
): string {
  const hash = crypto
    .createHash("sha256")
    .update(sourceFilePath + tableIndex + markdown)
    .digest("hex");
  return `${hash}.png`;
}

export async function markdownTableToImage(
  markdown: string,
  sourceFilePath: string,
  tableIndex: number
): Promise<Buffer> {
  await fs.mkdir(CACHE_DIR, { recursive: true });

  const cacheFileName = createCacheKey(sourceFilePath, tableIndex, markdown);
  const cacheFilePath = path.join(CACHE_DIR, cacheFileName);

  try {
    // Check if the cached file exists
    await fs.access(cacheFilePath);
    // If it exists, read and return it
    return await fs.readFile(cacheFilePath);
  } catch (error) {
    // File does not exist, proceed to generate it
  }

  const html = marked(markdown);
  const css = await getTableCss();

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  await page.setContent(`
    <html>
      <head>
        <style>${css}</style>
      </head>
      <body>
        ${html}
      </body>
    </html>
  `);

  const element = await page.$("table");
  if (!element) {
    await browser.close();
    throw new Error("No table found in the provided markdown.");
  }

  const imageBuffer = (await element.screenshot({
    type: "png",
    omitBackground: true,
  })) as Buffer;

  await browser.close();

  await fs.writeFile(cacheFilePath, imageBuffer);

  return imageBuffer;
}
