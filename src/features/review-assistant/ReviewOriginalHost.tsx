"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type Person = { id: string; name: string };
type PortalSession = {
  access_token: string;
  user: {
    id: string;
    email: string;
    app_metadata: { role: string; password_changed: boolean };
  };
};

const ORIGINAL_PAGES = new Set(["learners", "plan", "out", "reviews", "archive", "analytics", "settings"]);

function slugFromPath(pathname: string) {
  const slug = pathname.replace(/\/$/, "").split("/").pop() || "learners";
  return ORIGINAL_PAGES.has(slug) ? slug : "learners";
}

function showOriginalPage(slug: string) {
  const setPage = globalThis.__PORTAL_SET_REVIEW_PAGE__;
  if (typeof setPage !== "function") return;
  setPage(slug === "learners" || slug === "settings" ? "records" : slug, { skipHash: true });
  if (slug === "settings") globalThis.__PORTAL_OPEN_REVIEW_SETTINGS__?.();
  else globalThis.__PORTAL_CLOSE_REVIEW_SETTINGS__?.();
}

export function ReviewOriginalHost({
  html,
  session,
  staff,
  apprentices,
}: {
  html: string;
  session: PortalSession;
  staff: Person[];
  apprentices: Person[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    globalThis.__PORTAL_REVIEW_NAVIGATE__ = (href: string) => router.push(href);
  }, [router]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let root = globalThis.__REVIEW_ROOT;
    if (!root) {
      root = document.createElement("div");
      root.className = "gta-review-app";
      root.innerHTML = html;
      globalThis.__REVIEW_ROOT = root;
    }
    host.replaceChildren(root);
    globalThis.__PORTAL_REVIEW_SESSION__ = session;
    globalThis.__PORTAL_REVIEW_STAFF__ = staff;
    globalThis.__PORTAL_REVIEW_APPRENTICES__ = apprentices;
    if (!globalThis.__PORTAL_REVIEW_FETCH__) {
      const original = window.fetch.bind(window);
      window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
        const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        if (raw.startsWith("/api/") && !raw.startsWith("/api/reviews-assistant/")) {
          return original(`/api/reviews-assistant${raw.slice(4)}`, { ...init, credentials: "same-origin" });
        }
        return original(input, init);
      };
      globalThis.__PORTAL_REVIEW_FETCH__ = true;
    }
    const sync = () => showOriginalPage(slugFromPath(window.location.pathname));
    if (!globalThis.__REVIEW_APP_BOOTED) {
      globalThis.__REVIEW_APP_BOOTED = true;
      window.addEventListener("review-assistant-ready", sync, { once: true });
      const appearance = document.createElement("script");
      appearance.src = "/review-assistant/appearance.js";
      appearance.onload = () => {
        const app = document.createElement("script");
        app.type = "module";
        app.src = "/review-assistant/app.js";
        document.body.appendChild(app);
      };
      document.body.appendChild(appearance);
    } else {
      sync();
    }
  }, [pathname, html, session, staff, apprentices]);

  return (
    <>
      <link rel="stylesheet" href="/review-assistant/app.scoped.css" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Fraunces:opsz,wght@9..144,500;9..144,650&family=Outfit:wght@400;500;600&display=swap"
      />
      <div ref={hostRef} />
    </>
  );
}
