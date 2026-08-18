"use client";

import { useEffect } from "react";

function isMetaMaskExtensionError(value: unknown): boolean {
  if (!value) return false;

  const maybeError = value as {
    message?: unknown;
    stack?: unknown;
    reason?: unknown;
  };

  const reason = maybeError.reason as
    | { message?: unknown; stack?: unknown }
    | undefined;
  const message = String(
    reason?.message ?? maybeError.message ?? "",
  ).toLowerCase();
  const stack = String(reason?.stack ?? maybeError.stack ?? "").toLowerCase();

  return (
    message.includes("failed to connect to metamask") &&
    stack.includes("chrome-extension://")
  );
}

/**
 * Ignores known third-party browser-extension promise rejections that are not
 * caused by GTA Portal code. This prevents injected MetaMask failures from
 * surfacing as app runtime errors in development.
 */
export function BrowserExtensionErrorGuard() {
  useEffect(() => {
    function onUnhandledRejection(event: PromiseRejectionEvent) {
      if (!isMetaMaskExtensionError(event.reason)) return;
      event.stopImmediatePropagation();
      event.preventDefault();
    }

    function onError(event: ErrorEvent) {
      const filename = String(event.filename ?? "").toLowerCase();
      const message = String(event.message ?? "").toLowerCase();
      if (
        message.includes("failed to connect to metamask") &&
        filename.includes("chrome-extension://")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onError);
    };
  }, []);

  return null;
}
