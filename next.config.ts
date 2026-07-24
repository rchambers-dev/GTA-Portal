import type { NextConfig } from "next";

/**
 * Design-approval shell uses fictional demo accounts. Enable the switcher on
 * Vercel previews/production unless explicitly turned off.
 * (NODE_ENV=production alone used to hide the switcher on the live URL.)
 */
const demoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE ??
  (process.env.VERCEL === "1" || process.env.NODE_ENV !== "production"
    ? "true"
    : "false");

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_DEMO_MODE: demoMode,
  },
};

export default nextConfig;
