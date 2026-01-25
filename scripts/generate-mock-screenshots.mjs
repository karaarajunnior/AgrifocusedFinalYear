import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.resolve(__dirname, "..");
const screensDir = path.join(root, "docs", "mockups", "screens");
const outDir = path.join(root, "docs", "screenshots");

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const files = (await fs.readdir(screensDir))
    .filter((f) => f.endsWith(".html"))
    .sort();

  const browser = await puppeteer.launch({
    headless: "new",
    defaultViewport: { width: 1080, height: 2400, deviceScaleFactor: 2 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    for (const f of files) {
      const abs = path.join(screensDir, f);
      await page.goto(`file://${abs}`, { waitUntil: "load" });
      await new Promise((r) => setTimeout(r, 100));
      const pngName = f.replace(/\.html$/, ".png");
      const outPath = path.join(outDir, pngName);
      await page.screenshot({ path: outPath, fullPage: false });
      // eslint-disable-next-line no-console
      console.log("Wrote", path.relative(root, outPath));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

