import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import playwright from "/tmp/pw/node_modules/playwright-core/index.js";

const { chromium } = playwright;

const status = JSON.parse(readFileSync("/tmp/supabase-native-start.json", "utf8"));
if (status.runtime !== "native" || !String(status.env.API_URL).startsWith("http://127.0.0.1:")) {
  throw new Error("Refusing to drive the UI against a non-local stack.");
}
const staff = [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Synthetic Fixture Tutor" }];
const apprentices = [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Synthetic Fixture Apprentice" }];
const supabase = createClient(status.env.API_URL, status.env.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const publicDir = path.join(root, "public/review-assistant");
const artifacts = "/opt/cursor/artifacts";
await mkdir(artifacts, { recursive: true });

async function currentDocument() {
  const result = await supabase.from("app_state").select("payload").eq("id", "default").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data?.payload || { version: 1, learners: [], savedReviews: [], settings: {} };
}

await (async () => {
  const stored = await currentDocument();
  await supabase.from("app_state").update({
    payload: { ...stored, version: Number(stored.version) || 1, learners: [], savedReviews: [], followUps: [], archive: [] },
  }).eq("id", "default");
})();

async function saveDocument(next) {
  const stored = await currentDocument();
  const expected = Number(stored.version) || 1;
  const incoming = Number(next.version) || 1;
  if (incoming !== expected) {
    return { status: 409, body: { error: "Version conflict", clientVersion: incoming, storedVersion: expected, state: stored } };
  }
  const allowed = new Set(apprentices.map((item) => item.id));
  const unknown = (next.learners || []).some((item) => item?.id && !allowed.has(item.id));
  if (unknown) return { status: 400, body: { error: "Choose a Portal apprentice. This screen does not create one." } };
  const saved = { ...next, version: expected + 1, savedAt: new Date().toISOString() };
  const rpc = await supabase.rpc("save_app_state_if_version", {
    expected_version: expected,
    next_payload: saved,
    actor_id: null,
  });
  if (rpc.error) return { status: 500, body: { error: rpc.error.message } };
  if (rpc.data !== 1) {
    const latest = await currentDocument();
    return { status: 409, body: { error: "Version conflict", clientVersion: incoming, storedVersion: latest.version, state: latest } };
  }
  return { status: 200, body: { ok: true, version: saved.version, savedAt: saved.savedAt } };
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".mjs": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const candidates = [
    clean.replace(/^\/review-assistant\//, ""),
    clean.replace(/^\/forms\//, "forms/"),
    clean.replace(/^\//, ""),
  ];
  if (clean === "/pdf.worker.min.mjs") {
    const worker = path.join(root, "integrations/gta-reviews/node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
    try {
      return { full: worker, body: readFileSync(worker) };
    } catch {
      return null;
    }
  }
  for (const relative of candidates) {
    const full = path.normalize(path.join(publicDir, relative));
    if (full.startsWith(publicDir)) {
      try {
        return { full, body: readFileSync(full) };
      } catch {
        // try the next candidate
      }
    }
  }
  return null;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.pathname === "/api/state" || url.pathname === "/api/reviews-assistant/state") {
    if (request.method === "GET") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ state: await currentDocument() }));
      return;
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const result = await saveDocument(body);
    response.writeHead(result.status, { "content-type": "application/json" });
    response.end(JSON.stringify(result.body));
    return;
  }
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = readFileSync(path.join(publicDir, "index.html"), "utf8").replace(
      "</head>",
      `<script>window.__PORTAL_REVIEW_SESSION__=${JSON.stringify({
        access_token: "local-synthetic-session",
        user: {
          id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          email: "synthetic.fixture@example.test",
          app_metadata: { role: "admin", password_changed: true },
        },
      }).replace(/</g, "\\u003c")};window.__PORTAL_REVIEW_STAFF__=${JSON.stringify(staff).replace(/</g, "\\u003c")};window.__PORTAL_REVIEW_APPRENTICES__=${JSON.stringify(apprentices).replace(/</g, "\\u003c")};</script></head>`,
    );
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
    return;
  }
  const found = fileFor(url.pathname);
  if (!found) {
    response.writeHead(404);
    response.end("not found");
    return;
  }
  response.writeHead(200, { "content-type": types[path.extname(found.full)] || "application/octet-stream" });
  response.end(found.body);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const origin = `http://127.0.0.1:${port}`;
if (process.env.LOCAL_PREVIEW === "1") {
  console.log(`preview ${origin}`);
  await new Promise(() => {});
}
const report = [];
function record(name, ok, detail) {
  report.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => console.log("PAGE", error.message));
let consoleCount = 0;
page.on("console", (message) => {
  if (consoleCount++ < 25) console.log("C", message.type(), message.text().slice(0, 180));
});
await page.route("**/*", (route) => {
  const target = route.request().url();
  if (target.startsWith(`${origin}/`) || target.startsWith("data:") || target.startsWith("blob:")) return route.continue();
  return route.abort();
});
try {
  await page.goto(`${origin}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Review Assistant" }).waitFor({ timeout: 20000 });
  const signedIn = await page.locator("body").evaluate((body) => !body.classList.contains("signed-out"));
  record("original UI signed in", signedIn, signedIn ? "login screen hidden" : "still signed out");
  await page.screenshot({ path: path.join(artifacts, "review-ui-signed-in.png"), fullPage: true });

  const injected = await page.evaluate(() => ({
    staff: globalThis.__PORTAL_REVIEW_STAFF__ || null,
    apprentices: globalThis.__PORTAL_REVIEW_APPRENTICES__ || null,
  }));
  record("roster injected", Array.isArray(injected.staff) && injected.staff.length === 1, JSON.stringify(injected));
  await page.click("#records-add-toggle");
  await page.waitForSelector("#learner-portal-apprentice", { state: "visible", timeout: 10000 });
  const tutorOptions = await page.locator("[data-add-tutor] option").allTextContents();
  record("canonical tutor roster", tutorOptions.includes("Synthetic Fixture Tutor") && !tutorOptions.includes("John Pearson"), tutorOptions.join(", "));
  const apprenticeOptions = await page.locator("#learner-portal-apprentice option").evaluateAll((nodes) =>
    nodes.map((node) => `${node.value}:${node.textContent}`),
  );
  record("apprentice options", apprenticeOptions.some((item) => item.includes("Synthetic Fixture Apprentice")), apprenticeOptions.join(" | ") || "none");
  if (apprenticeOptions.some((item) => item.startsWith(apprentices[0].id))) {
    await page.selectOption("#learner-portal-apprentice", apprentices[0].id);
  }
  await page.fill("#learner-company", "Synthetic Fixture Workshop");
  await page.fill("#learner-postcode", "DN1 1AA");
  await page.selectOption("#learner-college", "Monday");
  if (tutorOptions.includes("Synthetic Fixture Tutor")) {
    await page.locator("[data-add-tutor]").selectOption(staff[0].id);
  }
  await page.click("#learner-form button[type=submit]");
  await page.waitForTimeout(1500);
  const listed = await page.locator("body").innerText();
  record("create learner", listed.includes("Synthetic Fixture Apprentice"), "canonical apprentice visible after add");
  await page.screenshot({ path: path.join(artifacts, "review-ui-learner-added.png"), fullPage: true });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const reloaded = await page.locator("body").innerText();
  record(
    "reload",
    reloaded.includes("Synthetic Fixture Apprentice"),
    "canonical apprentice visible after reload",
  );
  await page.getByRole("button", { name: "Show learner details" }).first().click({ timeout: 8000 });
  await page.locator("[data-records-company]").fill("Synthetic Fixture Workshop Edited");
  await page.locator("#records-list").getByRole("button", { name: "Save details" }).click();
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Show learner details" }).first().click({ timeout: 8000 });
  const company = await page.locator("[data-records-company]").inputValue();
  record("edit details", company === "Synthetic Fixture Workshop Edited", company);
  const preview = page.locator("[data-preview-review-form]").first();
  await preview.click();
  await page.locator("#pdf-preview-layer").waitFor({ state: "visible", timeout: 15000 });
  await page.click("#pdf-preview-populate-pdf");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(artifacts, "review-ui-filled-pdf.png"), fullPage: true });
  const previewTitle = await page.locator("#pdf-preview-title").innerText();
  const previewBody = await page.locator("#pdf-preview").innerText();
  record("filled PDF preview", previewBody.includes("Synthetic Fixture Apprentice"), previewTitle);
  await page.click("#pdf-preview-populate-word");
  await page.waitForTimeout(1500);
  const wordStatus = await page.locator("#status").innerText().catch(() => "");
  record("filled Word preview", /Word/i.test(wordStatus), wordStatus || "no status");
  await page.screenshot({ path: path.join(artifacts, "review-ui-filled-word.png"), fullPage: true });
  await page.locator("#pdf-preview-layer").evaluate((node) => {
    node.hidden = true;
  });

  const conflict = await page.evaluate(async () => {
    const response = await fetch("/api/state", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: 1, learners: [] }),
    });
    return response.status;
  });
  record("stale save conflict", conflict === 409, `status ${conflict}`);

  await page.click("[data-nav-page=plan]");
  await page.waitForTimeout(800);
  const planVisible = await page.locator("#page-plan").isVisible();
  record("planner page", planVisible, planVisible ? "plan page visible" : "plan page hidden");
  await page.screenshot({ path: path.join(artifacts, "review-ui-planner.png"), fullPage: true });

  const pdfResponse = await page.request.get(`${origin}/forms/GTA_Tripartite_Progress_Review_Form_V1.2.pdf`);
  const pdf = await pdfResponse.body();
  await writeFile(path.join(artifacts, "review-form-template.pdf"), pdf);
  record("PDF template", pdf.subarray(0, 5).toString() === "%PDF-", `${pdf.length} bytes`);
  const wordResponse = await page.request.get(`${origin}/forms/GTA_Review_Form.docx`);
  const word = await wordResponse.body();
  await writeFile(path.join(artifacts, "review-form-template.docx"), word);
  record("DOCX template", word.subarray(0, 2).toString() === "PK", `${word.length} bytes`);

  const history = await supabase.from("app_state_history").select("version");
  record("history rows", !history.error && (history.data?.length || 0) > 0, history.error?.message || `${history.data?.length || 0} rows`);
} catch (error) {
  record("browser flow", false, error instanceof Error ? error.message : String(error));
  await page.screenshot({ path: path.join(artifacts, "review-ui-error.png"), fullPage: true }).catch(() => undefined);
} finally {
  await browser.close();
  server.close();
}

await writeFile(path.join(artifacts, "review-ui-report.json"), JSON.stringify({ origin, report }, null, 2));
console.log(`preview ${origin}`);
if (report.some((item) => !item.ok)) process.exitCode = 1;
