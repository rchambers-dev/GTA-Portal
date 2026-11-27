import fs from "fs";
import path from "path";
import { fileURLToPath } from "node:url";

/** Project root from this module, so runtime reads do not depend on process.cwd(). */
export function projectRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "src"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find the portal project root.");
}
