import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { chromium } from "@playwright/test";
const root = resolve("dist");
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const relative = pathname.startsWith("/readme-studio/")
      ? pathname.slice("/readme-studio/".length)
      : pathname.slice(1);
    const file = resolve(root, relative || "index.html");
    if (file !== root && !file.startsWith(root + sep))
      throw new Error("Outside dist");
    const body = await readFile(file);
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
      }[extname(file)] || "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch();
  for (const path of ["/", "/readme-studio/"]) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("https://**/*", (route) => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}${path}`);
    await page
      .getByRole("button", { name: "Explore the sample profile" })
      .click();
    await page
      .getByRole("textbox", { name: "Markdown editor", exact: true })
      .fill("# Static hosting");
    await page
      .locator("github-preview h1")
      .filter({ hasText: "Static hosting" })
      .waitFor();
    await page.getByRole("button", { name: "Health", exact: true }).click();
    await page.locator("readme-health .stats").waitFor();
    if (errors.length) throw new Error(errors.join("\n"));
    console.log(`Static smoke passed: ${path} (preview and Health Worker)`);
    await page.close();
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
