import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:3100";
const outDir = "./pw-screens";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});

async function shot(name) {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log("screenshot:", name);
}

const email = `pw-${Date.now()}@example.com`;

console.log("nav /register");
await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
await shot("01-register");

await page.fill('input[name="name"]', "Playwright User");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', "hunter2222");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 15000 });
await shot("02-dashboard");

console.log("click + Create New Book");
await page.click('text=Create New Book');
await page.waitForURL("**/projects/new", { timeout: 10000 });
await shot("03-wizard-step1");

// Step 1: book type already defaults to Word Search - click it explicitly then Next
await page.click('button:has-text("Word Search")');
await page.click('button:has-text("Next")');
await shot("04-wizard-step2-topic");

await page.fill("#title", "Playwright Sports Word Search");
await page.fill("#topic", "Sports");
await page.click('button:has-text("Next")');
await shot("05-wizard-step3-audience");

await page.fill("#audience", "Adults");
await page.click('button:has-text("Next")');
await shot("06-wizard-step4-pages");

await page.fill("#pageCount", "12");
await page.click('button:has-text("Next")');
await shot("07-wizard-step5-size");

await page.click('button:has-text("Next")');
await shot("08-wizard-step6-review");

console.log("click Generate Book");
await page.click('button:has-text("Generate Book")');
await page.waitForURL(/\/projects\/[a-z0-9]+$/, { timeout: 60000 });
await page.waitForTimeout(1500);
await shot("09-editor");

console.log("errors during flow:", errors.length ? errors : "none");

await browser.close();
console.log("DONE");
