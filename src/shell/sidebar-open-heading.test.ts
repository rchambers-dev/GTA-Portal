import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("open category heading", () => {
  it("centers the expanded heading, hides its icon, and keeps the back arrow on the left", async () => {
    const chrome = await launchChrome();
    try {
      const layout = await measureHeading(chrome);
      expect(layout.collapsed.iconDisplay).toBe("grid");
      expect(layout.collapsed.iconWidth).toBeGreaterThan(0);
      expect(layout.collapsed.chevronDisplay).toBe("none");

      expect(layout.open.iconDisplay).toBe("none");
      expect(layout.open.chevronDisplay).not.toBe("none");
      expect(Math.abs(layout.open.textCenter - layout.open.buttonCenter)).toBeLessThan(1.5);
      expect(layout.open.chevronRight).toBeLessThan(layout.open.textLeft);
      expect(layout.open.chevronLeft).toBeLessThan(layout.open.buttonCenter);
      expect(layout.open.whiteSpace).toBe("normal");

      expect(layout.long.iconDisplay).toBe("none");
      expect(layout.long.lineCount).toBeGreaterThan(1);
      expect(Math.abs(layout.long.textCenter - layout.long.buttonCenter)).toBeLessThan(1.5);
      expect(layout.long.chevronRight).toBeLessThan(layout.long.textLeft);

      expect(layout.focused.iconDisplay).toBe("none");
      expect(Math.abs(layout.focused.textCenter - layout.focused.buttonCenter)).toBeLessThan(1.5);
      expect(layout.focused.chevronRight).toBeLessThan(layout.focused.textLeft);
      expect(layout.focused.active).toBe("open");

      expect(layout.closed.iconDisplay).toBe("grid");
      expect(layout.closed.iconLeft).toBeLessThan(layout.closed.textLeft);
      expect(layout.closed.chevronLeft).toBeGreaterThan(layout.closed.textRight);
      expect(layout.closed.chevronRight).toBeGreaterThan(layout.closed.buttonCenter);
    } finally {
      await chrome.close();
    }
  }, 30000);
});

type Box = {
  iconDisplay: string;
  iconWidth: number;
  iconLeft: number;
  chevronDisplay: string;
  chevronLeft: number;
  chevronRight: number;
  textLeft: number;
  textRight: number;
  textCenter: number;
  buttonCenter: number;
  whiteSpace: string;
  lineCount: number;
  active: string;
};

async function measureHeading(chrome: ChromeSession) {
  const tokens = readFileSync(path.join(process.cwd(), "src/styles/tokens.css"), "utf8");
  const css = readFileSync(path.join(process.cwd(), "src/shell/SidebarNavigation.module.css"), "utf8");
  const dir = await mkdtemp(path.join(tmpdir(), "open-heading-"));
  const htmlPath = path.join(dir, "index.html");
  await writeFile(htmlPath, page(tokens, css));
  await chrome.send("Page.enable");
  const loaded = chrome.once("Page.loadEventFired");
  await chrome.send("Page.navigate", { url: `file://${htmlPath}` });
  await loaded;
  const evalJs = async (expression: string) => {
    const result = (await chrome.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
    })) as { result?: { value?: unknown }; exceptionDetails?: unknown };
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  };
  const read = (id: string) => evalJs(`measure(${JSON.stringify(id)})`) as Promise<Box>;
  const point = async (id: string) =>
    (await evalJs(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2 }; })()`)) as {
      x: number;
      y: number;
    };
  const mouse = async (x: number, y: number) => {
    await chrome.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none", clickCount: 0 });
  };

  const collapsed = await read("open");
  const openAt = await point("open");
  await mouse(openAt.x, openAt.y);
  const open = await read("open");
  const longAt = await point("long");
  await mouse(longAt.x, longAt.y);
  const long = await read("long");
  await mouse(640, 20);
  await evalJs(`document.getElementById("open").focus()`);
  const focused = await read("open");
  await evalJs(`document.getElementById("open").blur()`);
  const closedAt = await point("closed");
  await mouse(closedAt.x, closedAt.y);
  const closed = await read("closed");
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  return { collapsed, open, long, focused, closed };
}

function page(tokens: string, css: string) {
  return `<!doctype html><html><head><style>
${tokens}
${css}
.sidebarSlot { height: auto; min-height: 7rem; transition: none !important; }
#openSlot { position: absolute; top: 140px; }
#longSlot { position: absolute; top: 280px; }
#closedSlot { position: absolute; top: 460px; }
</style></head><body>
${rail("openSlot", "open", "categoryButtonOpen", "Onboarding", "left")}
${rail("longSlot", "long", "categoryButtonOpen", "Apprenticeship Management and programme records", "left")}
${rail("closedSlot", "closed", "categoryButton", "Staff", "right")}
<script>
function measure(id) {
  const button = document.getElementById(id);
  const icon = button.querySelector(".icon");
  const label = button.querySelector(".categoryLabel");
  const chevron = button.querySelector(".chevronTrail");
  const range = document.createRange();
  range.selectNodeContents(label);
  const text = range.getBoundingClientRect();
  const lines = range.getClientRects();
  const buttonBox = button.getBoundingClientRect();
  const iconBox = icon.getBoundingClientRect();
  const chevronBox = chevron.getBoundingClientRect();
  return {
    iconDisplay: getComputedStyle(icon).display,
    iconWidth: iconBox.width,
    iconLeft: iconBox.left,
    chevronDisplay: getComputedStyle(chevron).display,
    chevronLeft: chevronBox.left,
    chevronRight: chevronBox.right,
    textLeft: text.left,
    textRight: text.right,
    textCenter: text.left + text.width / 2,
    buttonCenter: buttonBox.left + buttonBox.width / 2,
    whiteSpace: getComputedStyle(label).whiteSpace,
    lineCount: lines.length,
    active: document.activeElement && document.activeElement.id
  };
}
</script>
</body></html>`;
}

function rail(slotId: string, buttonId: string, buttonClass: string, label: string, chevron: string) {
  return `<div id="${slotId}" class="sidebarSlot"><aside class="sidebar"><button id="${buttonId}" type="button" class="${buttonClass}"><span class="icon" data-category-icon="${label}">+</span><span class="categoryLabel">${label}</span><span class="chevronTrail" data-chevron="${chevron}">${chevron === "left" ? "‹" : "›"}</span></button></aside></div>`;
}

type ChromeSession = {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  once(method: string): Promise<void>;
  close(): Promise<void>;
};

async function launchChrome(): Promise<ChromeSession> {
  const dir = await mkdtemp(path.join(tmpdir(), "heading-chrome-"));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const chrome = spawn(
    "google-chrome",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${path.join(dir, "profile")}`,
      "--no-first-run",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  try {
    await waitForChrome(port);
    const pages = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
      type: string;
      webSocketDebuggerUrl: string;
    }[];
    const pageTarget = pages.find((entry) => entry.type === "page");
    if (!pageTarget) throw new Error("Chrome opened without a page");
    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error("Chrome debugger connection failed"));
    });
    let seq = 0;
    const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
    const events: ((message: { method?: string }) => void)[] = [];
    ws.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number;
        method?: string;
        result?: Record<string, unknown>;
        error?: { message: string };
      };
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id)!;
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(message.error.message));
        else waiter.resolve(message.result ?? {});
      } else {
        for (const notify of [...events]) notify(message);
      }
    };
    return {
      send(method, params = {}) {
        const id = ++seq;
        return new Promise((resolve, reject) => {
          pending.set(id, { resolve, reject });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      once(method) {
        return new Promise((resolve) => {
          const notify = (message: { method?: string }) => {
            if (message.method !== method) return;
            events.splice(events.indexOf(notify), 1);
            resolve();
          };
          events.push(notify);
        });
      },
      async close() {
        ws.close();
        await stopChrome(chrome);
        await rm(dir, { recursive: true, force: true }).catch(() => undefined);
      },
    };
  } catch (error) {
    await stopChrome(chrome);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

async function waitForChrome(port: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok) return;
    } catch {
      // Chrome is still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome did not start");
}

async function stopChrome(chrome: ChildProcess) {
  if (chrome.exitCode !== null) return;
  chrome.kill("SIGKILL");
  await new Promise((resolve) => chrome.once("exit", resolve));
}
