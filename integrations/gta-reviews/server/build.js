import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { loadEnv, root } from "./env.js";

const distDir = path.join(root, "dist");
const publicDir = path.join(root, "public");

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.copyFileSync(source, target);
  }
}

function writeIndex() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  fs.writeFileSync(path.join(distDir, "index.html"), html);
}

function copyPdfWorker() {
  const worker = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
  if (!fs.existsSync(worker)) return;
  fs.copyFileSync(worker, path.join(distDir, "pdf.worker.min.mjs"));
}

export function clientDefines() {
  const env = loadEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.warn("Supabase URL or publishable key is missing from the build environment.");
  }
  return {
    "import.meta.env.NODE_SUPABASE_URL": JSON.stringify(env.supabaseUrl),
    "import.meta.env.NODE_SUPABASE_ANON_KEY": JSON.stringify(env.supabaseAnonKey),
    "import.meta.env.DEV": JSON.stringify(process.env.NODE_ENV !== "production"),
  };
}

export function prepareDist() {
  fs.mkdirSync(distDir, { recursive: true });
  copyDir(publicDir, distDir);
  copyDir(path.join(root, "server", "forms"), path.join(distDir, "forms"));
  writeIndex();
  copyPdfWorker();
}

export function buildOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    absWorkingDir: root,
    entryPoints: [path.join(root, "src/main.js")],
    bundle: true,
    format: "esm",
    outfile: path.join(distDir, "app.js"),
    sourcemap: !isProduction,
    minify: isProduction,
    define: clientDefines(),
    loader: {
      ".png": "file",
      ".svg": "file",
      ".woff": "file",
      ".woff2": "file",
    },
    logLevel: "info",
  };
}

export async function buildClient() {
  prepareDist();
  await esbuild.build(buildOptions());
}

export async function watchClient() {
  prepareDist();
  const context = await esbuild.context(buildOptions());
  await context.watch();
  fs.watch(path.join(root, "index.html"), () => {
    try {
      writeIndex();
    } catch (error) {
      console.warn(error.message || error);
    }
  });
  return context;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildClient();
}
