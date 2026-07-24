import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Sans_3 } from "next/font/google";
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

export const metadata: Metadata = {
  title: "GTA Learner Lifecycle",
  description:
    "Standalone design shell for the GTA Learner Lifecycle and Evidence Pack module",
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
      </body>
    </html>
  );
}
