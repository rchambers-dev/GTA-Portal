// Vercel sets VERCEL=1 for serverless functions. The desktop server does not.
export function onVercel() {
  return Boolean(process.env.VERCEL);
}
