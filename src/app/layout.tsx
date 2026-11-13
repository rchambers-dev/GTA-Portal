import type { Metadata } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getStandalonePorts } from "@/adapters/standalone";
import { BrowserExtensionErrorGuard } from "@/components/BrowserExtensionErrorGuard";
import { PortalShell } from "@/shell/PortalShell";
import "@/styles/globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const SITE_URL = "https://gta-portal.vercel.app";
const SITE_TITLE = "GTA Apprenticeship Portal";
const SITE_DESCRIPTION =
  "Manage apprentice progress, evidence, reviews and gateway activity securely in one place.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_TITLE}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_TITLE,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

/**
 * TEMPORARY root layout for standalone development.
 * Portal integration will replace this shell and inject real adapters.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const ports = getStandalonePorts();
  const session = await ports.auth.getEffectiveSession();
  const pathname = (await headers()).get("x-pathname") ?? "";
  const bareForm = pathname.startsWith("/tutor-review");

  return (
    <html lang="en-GB" className={`${plusJakarta.variable} ${sourceSans.variable}`}>
      <head>
        <Script
          id="ignore-metamask-extension-errors"
          strategy="beforeInteractive"
        >{`
          (function () {
            function isMetaMaskExtensionError(value) {
              if (!value) return false;
              var reason = value.reason || value;
              var message = String(reason && reason.message || value.message || "").toLowerCase();
              var stack = String(reason && reason.stack || value.stack || "").toLowerCase();
              return message.indexOf("failed to connect to metamask") !== -1 &&
                stack.indexOf("chrome-extension://") !== -1;
            }

            var originalConsoleError = console.error;
            console.error = function () {
              var joined = "";
              for (var i = 0; i < arguments.length; i += 1) {
                joined += " " + String(arguments[i] || "");
              }
              var lower = joined.toLowerCase();
              if (
                lower.indexOf("failed to connect to metamask") !== -1 &&
                lower.indexOf("chrome-extension://") !== -1
              ) {
                return;
              }
              return originalConsoleError.apply(console, arguments);
            };

            window.addEventListener("unhandledrejection", function (event) {
              if (!isMetaMaskExtensionError(event.reason)) return;
              if (typeof event.stopImmediatePropagation === "function") {
                event.stopImmediatePropagation();
              }
              event.preventDefault();
            }, true);

            window.addEventListener("error", function (event) {
              var message = String(event.message || "").toLowerCase();
              var filename = String(event.filename || "").toLowerCase();
              if (
                message.indexOf("failed to connect to metamask") !== -1 &&
                filename.indexOf("chrome-extension://") !== -1
              ) {
                if (typeof event.stopImmediatePropagation === "function") {
                  event.stopImmediatePropagation();
                }
                event.preventDefault();
              }
            }, true);
          })();
        `}</Script>
      </head>
      <body>
        <BrowserExtensionErrorGuard />
        {session && !bareForm ? (
          <PortalShell session={session}>{children}</PortalShell>
        ) : (
          children
        )}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
