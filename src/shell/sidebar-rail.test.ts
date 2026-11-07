import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pointerActivationRetainsFocus, shouldIgnorePointerFocus } from "./sidebar-rail";

describe("sidebar pointer focus", () => {
  it("keeps keyboard activation focused and releases pointer clicks", () => {
    expect(pointerActivationRetainsFocus(0)).toBe(true);
    expect(pointerActivationRetainsFocus(1)).toBe(false);
    expect(pointerActivationRetainsFocus(2)).toBe(false);
    expect(shouldIgnorePointerFocus("mouse", 0)).toBe(true);
    expect(shouldIgnorePointerFocus("mouse", 2)).toBe(false);
    expect(shouldIgnorePointerFocus("touch", 0)).toBe(false);
    expect(shouldIgnorePointerFocus("pen", 0)).toBe(false);

    const source = readFileSync(
      path.join(process.cwd(), "src/shell/SidebarNavigation.tsx"),
      "utf8",
    );
    expect(source).toContain("shouldIgnorePointerFocus(event.pointerType, event.button)");
    expect(source).toContain("if (!pointerActivationRetainsFocus(event.detail))");
    expect(source).toContain("onToggle(title)");
    const css = readFileSync(
      path.join(process.cwd(), "src/shell/SidebarNavigation.module.css"),
      "utf8",
    );
    expect(css).toContain(".sidebarSlot:hover,");
    expect(css).toContain(".sidebarSlot:focus-within");
    expect(css).toContain("transition: width");
    expect(css).toContain("@media (max-width: 720px)");
    expect(css).not.toMatch(/data-pinned|\.sidebarPinned|sidebar-pin/);
  });

  it("collapses after a mouse open or close, and stays open for keyboard focus", async () => {
    const chrome = await launchChrome();
    try {
      const widths = await exerciseRail(chrome);
      expect(widths.rest).toBe(widths.collapsed);
      expect(widths.hovered).toBe(widths.expanded);
      expect(widths.afterOpen.active).not.toBe("cat");
      expect(widths.afterOpen.expanded).toBe("true");
      expect(widths.afterOpen.detail).toBe("1");
      expect(widths.afterOpenLeave).toBe(widths.collapsed);
      expect(widths.reentry).toBe(widths.expanded);
      expect(widths.afterClose.expanded).toBe("false");
      expect(widths.afterClose.active).not.toBe("cat");
      expect(widths.afterCloseLeave).toBe(widths.collapsed);
      expect(widths.keyboard.active).toBe("cat");
      expect(widths.keyboard.width).toBe(widths.expanded);
      expect(widths.afterEnter.detail).toBe("0");
      expect(widths.afterEnter.active).toBe("cat");
      expect(widths.afterEnter.expanded).toBe("true");
      expect(widths.afterEnter.width).toBe(widths.expanded);
      expect(widths.afterSpace.detail).toBe("0");
      expect(widths.afterSpace.active).toBe("cat");
      expect(widths.afterKeyboardBlur).toBe(widths.collapsed);
      expect(widths.stuckAfterLeave).toBe(widths.expanded);
      expect(widths.stuckActive).toBe("stuck");
      expect(widths.mobileRest).toBe(widths.mobileCollapsed);
      expect(widths.mobileHovered).toBe(widths.mobileExpanded);
    } finally {
      await chrome.close();
    }
  }, 30000);
});

type ChromeSession = {
  send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
  once(method: string): Promise<void>;
  close(): Promise<void>;
};

async function launchChrome(): Promise<ChromeSession> {
  const dir = await mkdtemp(path.join(tmpdir(), "sidebar-rail-"));
  const port = 18000 + Math.floor(Math.random() * 20000);
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
    const page = pages.find((entry) => entry.type === "page");
    if (!page) throw new Error("Chrome opened without a page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
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
    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    const once = (method: string) =>
      new Promise<void>((resolve) => {
        const notify = (message: { method?: string }) => {
          if (message.method !== method) return;
          events.splice(events.indexOf(notify), 1);
          resolve();
        };
        events.push(notify);
      });
    return {
      send,
      once,
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

async function exerciseRail(chrome: ChromeSession) {
  const tokens = readFileSync(path.join(process.cwd(), "src/styles/tokens.css"), "utf8");
  const css = readFileSync(path.join(process.cwd(), "src/shell/SidebarNavigation.module.css"), "utf8");
  const dir = await mkdtemp(path.join(tmpdir(), "sidebar-rail-page-"));
  const htmlPath = path.join(dir, "index.html");
  await writeFile(htmlPath, harness(tokens, css));
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
  const widthOf = async (id: string) => Number(await evalJs(`document.getElementById(${JSON.stringify(id)}).offsetWidth`));
  const mouse = async (type: string, x: number, y: number) => {
    await chrome.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: type === "mouseMoved" ? 0 : 1,
    });
  };
  const key = async (type: string, keyName: string, code: string, keyCode: number, text?: string) => {
    await chrome.send("Input.dispatchKeyEvent", {
      type,
      key: keyName,
      code,
      windowsVirtualKeyCode: keyCode,
      nativeVirtualKeyCode: keyCode,
      ...(text !== undefined ? { text } : {}),
    });
  };
  const point = async (id: string) =>
    (await evalJs(`(() => { const r = document.getElementById(${JSON.stringify(id)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`)) as {
      x: number;
      y: number;
    };
  const state = async (id: string) =>
    (await evalJs(`(() => { const el = document.getElementById(${JSON.stringify(id)}); return { active: document.activeElement && document.activeElement.id, expanded: el.getAttribute("aria-expanded"), detail: el.dataset.detail || "", width: el.parentElement.offsetWidth }; })()`)) as {
      active: string;
      expanded: string;
      detail: string;
      width: number;
    };

  const collapsed = await widthOf("collapsedProbe");
  const expanded = await widthOf("expandedProbe");
  const rest = await widthOf("slot");
  const cat = await point("cat");
  await mouse("mouseMoved", cat.x, cat.y);
  const hovered = await widthOf("slot");
  await mouse("mousePressed", cat.x, cat.y);
  await mouse("mouseReleased", cat.x, cat.y);
  const afterOpen = await state("cat");
  await mouse("mouseMoved", 640, 30);
  const afterOpenLeave = await widthOf("slot");
  await mouse("mouseMoved", cat.x, cat.y);
  const reentry = await widthOf("slot");
  await mouse("mousePressed", cat.x, cat.y);
  await mouse("mouseReleased", cat.x, cat.y);
  const afterClose = await state("cat");
  await mouse("mouseMoved", 640, 30);
  const afterCloseLeave = await widthOf("slot");

  await evalJs(`document.getElementById("cat").focus()`);
  const keyboard = await state("cat");
  await key("keyDown", "Enter", "Enter", 13, "\r");
  await key("keyUp", "Enter", "Enter", 13);
  const afterEnter = await state("cat");
  await key("keyDown", " ", "Space", 32, " ");
  await key("keyUp", " ", "Space", 32);
  const afterSpace = await state("cat");
  await evalJs(`document.getElementById("cat").blur()`);
  const afterKeyboardBlur = await widthOf("slot");

  const stuck = await point("stuck");
  await mouse("mouseMoved", stuck.x, stuck.y);
  await mouse("mousePressed", stuck.x, stuck.y);
  await mouse("mouseReleased", stuck.x, stuck.y);
  await mouse("mouseMoved", 640, 30);
  const stuckAfterLeave = await widthOf("stuckSlot");
  const stuckActive = String(await evalJs(`document.activeElement && document.activeElement.id`));

  await chrome.send("Emulation.setDeviceMetricsOverride", {
    width: 400,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await evalJs(`document.activeElement && document.activeElement.blur()`);
  await mouse("mouseMoved", 360, 700);
  const mobileCollapsed = await widthOf("collapsedProbe");
  const mobileExpanded = await widthOf("expandedProbe");
  const mobileRest = await widthOf("slot");
  const mobileCat = await point("cat");
  await mouse("mouseMoved", mobileCat.x, mobileCat.y);
  const mobileHovered = await widthOf("slot");

  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  return {
    collapsed,
    expanded,
    rest,
    hovered,
    afterOpen,
    afterOpenLeave,
    reentry,
    afterClose,
    afterCloseLeave,
    keyboard,
    afterEnter,
    afterSpace,
    afterKeyboardBlur,
    stuckAfterLeave,
    stuckActive,
    mobileCollapsed,
    mobileExpanded,
    mobileRest,
    mobileHovered,
  };
}

function harness(tokens: string, css: string): string {
  return `<!doctype html><html><head><style>
${tokens}
${css}
.sidebarSlot { transition: none !important; }
body { margin: 0; }
#stuckSlot { position: absolute; top: 180px; }
</style></head><body>
<div id="collapsedProbe" style="position:absolute;width:var(--sidebar-collapsed-width)"></div>
<div id="expandedProbe" style="position:absolute;width:var(--sidebar-width)"></div>
<div id="slot" class="sidebarSlot"><button id="cat" type="button" class="categoryButton" aria-expanded="false">Onboarding</button></div>
<div id="stuckSlot" class="sidebarSlot"><button id="stuck" type="button" class="categoryButton" aria-expanded="false">Marketing</button></div>
<script>
const pointerActivationRetainsFocus = ${pointerActivationRetainsFocus.toString()};
const shouldIgnorePointerFocus = ${shouldIgnorePointerFocus.toString()};
const cat = document.getElementById("cat");
cat.addEventListener("pointerdown", (event) => {
  if (shouldIgnorePointerFocus(event.pointerType, event.button)) event.preventDefault();
});
cat.addEventListener("click", (event) => {
  cat.dataset.detail = String(event.detail);
  cat.setAttribute("aria-expanded", cat.getAttribute("aria-expanded") === "true" ? "false" : "true");
  if (!pointerActivationRetainsFocus(event.detail)) cat.blur();
});
const stuck = document.getElementById("stuck");
stuck.addEventListener("click", () => {
  stuck.setAttribute("aria-expanded", "true");
});
</script>
</body></html>`;
}

async function waitForChrome(port: number) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return;
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
