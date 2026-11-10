import path from "node:path";
import { createAppServer } from "./http.js";
import { loadEnv, root } from "./env.js";

loadEnv();
const staticDir = path.join(root, "dist");
const port = Number(process.env.PORT) || 4173;

const started = await createAppServer({ staticDir, port });
console.log(`Review Assistant website: http://localhost:${started.port}`);
