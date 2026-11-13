import type { ReactNode } from "react";
import type { Viewport } from "next";
import { Open_Sans, Poppins } from "next/font/google";

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-open-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function TutorReviewLayout({ children }: { children: ReactNode }) {
  return <div className={`${openSans.variable} ${poppins.variable}`}>{children}</div>;
}
