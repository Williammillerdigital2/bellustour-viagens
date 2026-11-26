// Local Dev Server for Bellustour (Serves public/ + persists /api/config to disk)
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "assets", "uploads");
const JSON_PATH = path.join(PUBLIC_DIR, "data", "site-config.json");
const PREV_JSON_PATH = path.join(PUBLIC_DIR, "data", "site-config.prev.json");
const JS_CONFIG_PATH = path.join(PUBLIC_DIR, "js", "default-config.js");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split("?")[0];

  // Local API persistence for /api/image (Mirrors Cloudflare KV /api/image behavior)
  if (urlPath === "/api/image") {
    if (req.method === "GET") {
      const fullUrl = new URL(req.url, `http://localhost:${PORT}`);
      const id = (fullUrl.searchParams.get("id") || "").replace(/[^a-zA-Z0-9_.-]/g, "");
      const metaPath = path.join(UPLOADS_DIR, `${id}.json`);
      if (id && fs.existsSync(metaPath)) {
        const record = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
        const buf = Buffer.from(record.base64, "base64");
        res.writeHead(200, {
          "Content-Type": record.mime || "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable"
        });
        return res.end(buf);
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Image not found");
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const match = (parsed.dataUrl || "").match(
            /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/
          );
          if (!match) {
            res.writeHead(400, { "Content-Type": MIME[".json"] });
            return res.end(JSON.stringify({ error: "Invalid dataUrl" }));
          }
          const mime = match[1];
          const base64 = match[2];
          const id =
            (parsed.id || "photo").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) +
            "_" +
            Date.now();
          fs.writeFileSync(
            path.join(UPLOADS_DIR, `${id}.json`),
            JSON.stringify({ mime, base64, createdAt: Date.now() }),
            "utf-8"
          );
          res.writeHead(200, { "Content-Type": MIME[".json"] });
          res.end(
            JSON.stringify({
              ok: true,
              id,
              url: `/api/image?id=${id}`,
              storage: "local_disk_kv"
            })
          );
        } catch (e) {
          res.writeHead(500, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // Local API persistence for /api/config (including ?rollback=1 backup snapshot)
  if (urlPath === "/api/config") {
    const isRollbackReq = req.url.includes("rollback=1");
    if (req.method === "GET") {
      const targetFile = isRollbackReq && fs.existsSync(PREV_JSON_PATH) ? PREV_JSON_PATH : JSON_PATH;
      if (fs.existsSync(targetFile)) {
        res.writeHead(200, { "Content-Type": MIME[".json"], "Cache-Control": "no-store" });
        return res.end(fs.readFileSync(targetFile, "utf-8"));
      }
      res.writeHead(404, { "Content-Type": MIME[".json"] });
      return res.end(JSON.stringify({ status: "default" }));
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          if (fs.existsSync(JSON_PATH)) {
            fs.copyFileSync(JSON_PATH, PREV_JSON_PATH);
          }
          fs.writeFileSync(JSON_PATH, JSON.stringify(parsed, null, 2), "utf-8");
          fs.writeFileSync(
            JS_CONFIG_PATH,
            "// Auto-updated via Admin Panel\nwindow.BELLUSTOUR_DEFAULT_CONFIG = " +
              JSON.stringify(parsed, null, 2) +
              ";\n",
            "utf-8"
          );
          res.writeHead(200, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ ok: true, storage: "disk_and_json" }));
        } catch (e) {
          res.writeHead(400, { "Content-Type": MIME[".json"] });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  let filePath = path.join(
    PUBLIC_DIR,
    urlPath === "/" ? "index.html" : urlPath === "/admin" ? "admin.html" : urlPath
  );

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
});

server.listen(PORT, () => {
  console.log(`Bellustour local server running at http://localhost:${PORT}`);
});
