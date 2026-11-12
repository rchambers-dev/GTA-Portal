import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import playwright from "/tmp/pw/node_modules/playwright-core/index.js";

const { chromium } = playwright;
const require = createRequire(import.meta.url);
const { staffApi } = require("/tmp/staff-api.cjs");
const artifacts = "/opt/cursor/artifacts";
await mkdir(artifacts, { recursive: true });
const report = [];
function record(name, ok, detail) {
  report.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/staff-page-access") {
    const canEdit = url.searchParams.get("editor") !== "0";
    let body = {};
    if (request.method === "POST") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    }
    const result = staffApi(request.method || "GET", body, canEdit);
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
    return;
  }
  if (url.pathname === "/staff-preview.js") {
    response.writeHead(200, { "content-type": "text/javascript" });
    response.end(readFileSync("/tmp/staff-preview.js"));
    return;
  }
  if (url.pathname === "/staff-preview.css") {
    response.writeHead(200, { "content-type": "text/css" });
    response.end(readFileSync("/tmp/staff-preview.css"));
    return;
  }
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<!doctype html><html><head><meta charset="utf-8"><title>Permissions</title>
<link rel="stylesheet" href="/staff-preview.css">
<style>body{font-family:system-ui;margin:24px;background:#f6f1e8;color:#1c2430}</style>
</head><body><div id="root"></div><script type="module" src="/staff-preview.js"></script></body></html>`);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: "/usr/local/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
try {
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Permissions" }).waitFor({ timeout: 15000 });
  await page.locator("select").first().selectOption("staff");
  await page.getByRole("checkbox", { name: "Read" }).first().check();
  await page.getByRole("button", { name: "Save workspace default" }).click();
  await page.getByText("Workspace default saved").waitFor({ timeout: 8000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("select").first().selectOption("staff");
  const afterReload = await page.locator("body").innerText();
  record("workspace default reload", afterReload.includes("page map is on"), "map stayed on after reload");
  await page.getByRole("checkbox", { name: "Read" }).first().check();
  await page.getByLabel("Bundle name").fill("Synthetic readers");
  await page.locator("select[multiple] option").first().click();
  await page.getByRole("button", { name: "Save page bundle" }).click();
  await page.getByText("Page bundle saved").waitFor({ timeout: 8000 });
  const bundled = await page.locator("body").innerText();
  record("page bundle", bundled.includes("Synthetic readers"), "bundle name visible");
  await page.getByLabel("Staff member").nth(0).selectOption({ label: "Synthetic Tutor · Tutor" });
  await page.getByRole("button", { name: "Save direct pages" }).click();
  await page.getByText("Direct page assignment saved.").waitFor({ timeout: 8000 });
  const effective = await page.locator("body").innerText();
  record("effective provenance", /workspace default|page bundle|direct assignment/.test(effective), "origins visible");
  await page.screenshot({ path: "/opt/cursor/artifacts/staff-permissions.png", fullPage: true });
  const denied = await page.evaluate(async (base) => {
    const current = await fetch(`${base}/api/staff-page-access`).then((response) => response.json());
    const response = await fetch(`${base}/api/staff-page-access?editor=0`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "saveWorkspace", workspaceId: "staff", grants: [], expectedVersion: current.version }),
    });
    return response.status;
  }, origin);
  record("read-only API denial", denied === 403, `status ${denied}`);
  const immediate = await page.evaluate(async (base) => {
    const before = await fetch(`${base}/api/staff-page-access`).then((response) => response.json());
    const saved = await fetch(`${base}/api/staff-page-access`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "saveWorkspace",
        workspaceId: "staff",
        grants: [{ pageId: "staff.lifecycle", level: "read" }],
        expectedVersion: before.version,
      }),
    });
    const after = await fetch(`${base}/api/staff-page-access`).then((response) => response.json());
    return { status: saved.status, version: after.version, before: before.version };
  }, origin);
  record("immediate revocation read", immediate.status === 200 && immediate.version === immediate.before + 1, JSON.stringify(immediate));
} catch (error) {
  record("staff editor", false, error instanceof Error ? error.message : String(error));
  await page.screenshot({ path: "/opt/cursor/artifacts/staff-permissions-error.png", fullPage: true }).catch(() => undefined);
} finally {
  await browser.close();
  server.close();
}
await writeFile("/opt/cursor/artifacts/staff-permissions-report.json", JSON.stringify({ origin, report }, null, 2));
if (report.some((item) => !item.ok)) process.exitCode = 1;
