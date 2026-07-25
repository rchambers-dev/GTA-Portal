import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { getStandalonePorts } from "@/adapters/standalone";
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

  return (
    <html lang="en-GB" className={`${plusJakarta.variable} ${sourceSans.variable}`}>
      <body>
        {session ? (
          <PortalShell session={session}>{children}</PortalShell>
        ) : (
          children
        )}
        <Analytics />
      </body>
    </html>
  );
}
