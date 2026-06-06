import { chromium } from 'playwright';

async function run() {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to browse page...");
  await page.goto('http://localhost:3000/browse');

  console.log("Clicking on Komiku source...");
  await page.click('text="Komiku"');
  await page.waitForTimeout(5000); // Wait for popular load

  console.log("Clicking on first manga in popular list...");
  await page.locator('div.bgei a').first().click();
  await page.waitForTimeout(3000);

  console.log("Clicking on the first chapter...");
  await page.click('text="Chapter 1"');
  
  console.log("Waiting for reader to load...");
  await page.waitForTimeout(5000);

  // Check if we have image tags with src
  const images = await page.$$eval('img', imgs => imgs.map(i => ({ src: i.src, w: i.width, h: i.height, display: i.style.display })));
  console.log("Images found in reader:", images.length);
  console.dir(images, { depth: null });
  
  // Take a screenshot of the reader
  await page.screenshot({ path: 'reader-screenshot.png' });
  console.log("Saved reader-screenshot.png");

  await browser.close();
}
run().catch(console.error);
