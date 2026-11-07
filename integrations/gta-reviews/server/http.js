import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { handleReviewApi } from "./api.js";
import { logClientError } from "../shared/log-error.js";

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safeStaticPath(staticDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const relative = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const resolved = path.normalize(path.join(staticDir, relative));
  if (!resolved.startsWith(path.normalize(staticDir))) return "";
  return resolved;
}

function sendFile(res, filePath) {
  const type = TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  fs.createReadStream(filePath).pipe(res);
}

export function createAppServer({ staticDir = "", port = 0, host = "127.0.0.1" } = {}) {
  const server = http.createServer(async (req, res) => {
    try {
      if (await handleReviewApi(req, res)) return;
      if (!staticDir) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const requested = safeStaticPath(staticDir, req.url || "/");
      if (requested && fs.existsSync(requested) && fs.statSync(requested).isFile()) {
        sendFile(res, requested);
        return;
      }
      const fallback = path.join(staticDir, "index.html");
      if (fs.existsSync(fallback)) {
        sendFile(res, fallback);
        return;
      }
      res.statusCode = 404;
      res.end("Not found");
    } catch (error) {
      const pathOnly = String(req.url || "").split("?")[0].split("#")[0];
      logClientError("Request failed.", {
        status: 500,
        code: error?.code,
        route: pathOnly.startsWith("/") ? pathOnly : "",
      });
      if (res.writableEnded) return;
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "An error occurred." }));
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        host,
        port: typeof address === "object" && address ? address.port : port,
      });
    });
  });
}
